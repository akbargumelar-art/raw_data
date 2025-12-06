import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import csv from 'csv-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module'; 
import db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_123';

// --- AUTH & ADMIN ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Sesi habis. Silakan login ulang.' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid.' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak.' });
  next();
};

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ error: 'Username tidak ditemukan.' });
    const user = users[0];
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Password salah.' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const [users] = await db.query('SELECT id, username, role, allowed_databases FROM users');
  res.json(users.map(u => ({ ...u, allowedDatabases: u.allowed_databases ? JSON.parse(u.allowed_databases) : [] })));
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role, allowedDatabases } = req.body;
  try {
    await db.query('INSERT INTO users (username, password, role, allowed_databases) VALUES (?, ?, ?, ?)', 
      [username, await bcrypt.hash(password, 10), role, allowedDatabases ? JSON.stringify(allowedDatabases) : '[]']);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// --- DATA ROUTES ---

const getUserAllowedDatabases = async (userId) => {
  const [rows] = await db.query('SELECT role, allowed_databases FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) return { role: 'operator', allowed: [] };
  const user = rows[0];
  return { role: user.role, allowed: user.allowed_databases ? JSON.parse(user.allowed_databases) : [] };
};

app.get('/api/data/databases', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
    const all = rows.map(r => Object.values(r)[0]).filter(d => !systemDbs.includes(d));
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    res.json({ databases: role === 'admin' ? all : all.filter(db => allowed.includes(db)) });
  } catch (err) { res.status(500).json({ error: 'Gagal memuat database.' }); }
});

app.post('/api/data/create-database', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName } = req.body;
  const safeName = databaseName?.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeName) return res.status(400).json({ error: 'Nama database tidak valid.' });
  try { await db.query(`CREATE DATABASE ${safeName}`); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/data/tables', authenticateToken, async (req, res) => {
  const { db: dbName } = req.query;
  const { role, allowed } = await getUserAllowedDatabases(req.user.id);
  if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });
  try {
    const [rows] = await db.query(`SHOW TABLES FROM ${db.escapeId(dbName)}`);
    res.json({ tables: rows.map(r => Object.values(r)[0]) });
  } catch (err) { res.status(500).json({ error: 'Gagal memuat tabel.' }); }
});

app.get('/api/data/table-stats', authenticateToken, async (req, res) => {
  const { db: dbName, table: tableName } = req.query;
  if (!dbName || !tableName) return res.status(400).json({ error: 'Parameter wajib.' });

  try {
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

    const fullTable = `${db.escapeId(dbName)}.${db.escapeId(tableName)}`;
    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM ${fullTable}`);
    
    // Get Metadata (Size, Create Time, Update Time) from Information Schema
    const [meta] = await db.query(`
      SELECT 
        DATA_LENGTH, INDEX_LENGTH, CREATE_TIME, UPDATE_TIME, TABLE_COLLATION 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [dbName, tableName]);

    if (meta.length === 0) return res.status(404).json({ error: 'Tabel tidak ditemukan' });
    const info = meta[0];

    res.json({
      rows: countRows[0].total,
      dataLength: info.DATA_LENGTH,
      indexLength: info.INDEX_LENGTH,
      createdAt: info.CREATE_TIME,
      updatedAt: info.UPDATE_TIME, 
      collation: info.TABLE_COLLATION
    });
  } catch (err) { res.status(500).json({ error: 'Gagal memuat statistik.' }); }
});

app.get('/api/data/preview', authenticateToken, async (req, res) => {
  const { db: dbName, table: tableName, page = 1, limit = 20, sort, dir } = req.query;
  try {
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

    const fullTable = `${db.escapeId(dbName)}.${db.escapeId(tableName)}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `SELECT * FROM ${fullTable}`;
    if (sort) {
      const safeSort = db.escapeId(sort);
      const direction = dir === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${safeSort} ${direction}`;
    }
    sql += ` LIMIT ? OFFSET ?`;

    const [rows] = await db.query(sql, [parseInt(limit), offset]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: 'Gagal memuat data.' }); }
});

// NEW: Export Table to Excel
app.get('/api/data/export', authenticateToken, async (req, res) => {
  const { db: dbName, table: tableName } = req.query;
  
  try {
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

    const fullTable = `${db.escapeId(dbName)}.${db.escapeId(tableName)}`;
    const [rows] = await db.query(`SELECT * FROM ${fullTable} LIMIT 100000`);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${tableName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Export Failed");
  }
});

// NEW: Raw SQL Query Runner
app.post('/api/data/query', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName, query } = req.body;
  if (!databaseName || !query) return res.status(400).json({ error: 'Database dan Query wajib diisi.' });

  if (query.toLowerCase().includes('information_schema') || query.toLowerCase().includes('mysql.')) {
    return res.status(403).json({ error: 'Query ke tabel sistem dilarang demi keamanan.' });
  }

  try {
    await db.query(`USE ${db.escapeId(databaseName)}`);
    const [results] = await db.query(query);
    
    // Explicitly handle BigInt serialization using replacer
    const safeResults = JSON.parse(JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
    
    res.json(safeResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/table-schema', authenticateToken, requireAdmin, async (req, res) => {
  const { db: dbName, table: tableName } = req.query;
  try {
    const [columns] = await db.query(`DESCRIBE ${db.escapeId(dbName)}.${db.escapeId(tableName)}`);
    res.json(columns.map(c => ({ name: c.Field, type: c.Type.toUpperCase(), isPrimaryKey: c.Key === 'PRI' })));
  } catch (err) { res.status(500).json({ error: 'Gagal.' }); }
});

app.post('/api/data/alter-table', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName, tableName, columnName, newType } = req.body;
  try {
    await db.query(`ALTER TABLE ${db.escapeId(databaseName)}.${db.escapeId(tableName)} MODIFY COLUMN ${db.escapeId(columnName)} ${newType}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function getExcelDataWithSmartHeader(filePath) {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (rawData.length === 0) throw new Error("File kosong.");

  let maxCols = 0, headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const nonEmpty = rawData[i].filter(c => c !== '' && c != null).length;
    if (nonEmpty > maxCols) { maxCols = nonEmpty; headerRowIndex = i; }
  }
  return XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
}

app.post('/api/data/analyze', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File wajib.' });
  
  const processData = (headers, results, filePath) => {
    if (!headers || headers.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Header tidak terdeteksi." });
    }
    const columns = headers.map(header => {
      let isInt = true, maxLen = 0;
      for (const row of results) {
        const val = String(row[header] || '').trim();
        maxLen = Math.max(maxLen, val.length);
        if (isNaN(Number(val)) || !Number.isInteger(Number(val))) isInt = false;
      }
      let type = 'VARCHAR(255)';
      if (isInt) type = maxLen > 9 ? 'VARCHAR(50)' : 'INT';
      else if (results.some(r => !isNaN(Date.parse(r[header])))) type = 'DATETIME'; 
      
      return { name: header.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(), type, isPrimaryKey: /id|sku|code/i.test(header) };
    });
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ columns, previewData: results });
  };

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const data = getExcelDataWithSmartHeader(req.file.path);
      processData(Object.keys(data[0] || {}), data.slice(0, 5), req.file.path);
    } catch (e) { res.status(500).json({ error: 'Excel Error' }); }
  } else {
    const results = [];
    let headers = null;
    fs.createReadStream(req.file.path).pipe(csv())
      .on('data', d => { if(!headers) headers=Object.keys(d); if(results.length<5) results.push(d); })
      .on('end', () => processData(headers, results, req.file.path));
  }
});

// UPDATED: Create Table (Composite Key Support)
app.post('/api/data/create-table', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName, tableName, columns } = req.body;
  
  // 1. Define Columns
  const colDefs = columns.map(c => `${db.escapeId(c.name)} ${c.type} ${c.type.includes('VARCHAR') || c.type === 'TEXT' ? 'NULL' : 'NOT NULL'}`);
  
  // 2. Define Primary Key (Composite)
  const primaryKeys = columns.filter(c => c.isPrimaryKey).map(c => db.escapeId(c.name));
  
  let pkDef = '';
  if (primaryKeys.length > 0) {
    pkDef = `, PRIMARY KEY (${primaryKeys.join(', ')})`;
  }

  try {
    await db.query(`CREATE TABLE ${db.escapeId(databaseName)}.${db.escapeId(tableName)} (${colDefs.join(', ')} ${pkDef})`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/data/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const reqDb = req.body.databaseName;
  if (!req.file || !reqDb) return res.status(400).json({ error: 'Data kurang.' });

  const { role, allowed } = await getUserAllowedDatabases(req.user.id);
  if (role !== 'admin' && !allowed.includes(reqDb)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const fullTable = `${db.escapeId(reqDb)}.${db.escapeId(req.body.tableName)}`;
  const BATCH_SIZE = 1000;
  let totalRows = 0;
  let changedRows = 0; 

  const processBatch = async (batchData) => {
    if (batchData.length === 0) return;
    const cols = Object.keys(batchData[0]);
    const safeCols = cols.map(c => c.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
    const values = batchData.map(row => cols.map(c => row[c]));
    
    const escapedCols = safeCols.map(c => db.escapeId(c));
    const updateClause = escapedCols.map(c => `${c}=VALUES(${c})`).join(', ');
    
    const sql = `INSERT INTO ${fullTable} (${escapedCols.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
    const [result] = await db.query(sql, [values]);
    
    totalRows += batchData.length;
    changedRows += result.affectedRows; 
  };

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      const data = getExcelDataWithSmartHeader(req.file.path);
      for (let i = 0; i < data.length; i += BATCH_SIZE) await processBatch(data.slice(i, i + BATCH_SIZE));
    } else {
       const results = [];
       const stream = fs.createReadStream(req.file.path).pipe(csv());
       for await (const row of stream) {
         results.push(row);
         if(results.length >= BATCH_SIZE) {
           await processBatch(results);
           results.length = 0;
         }
       }
       if(results.length > 0) await processBatch(results);
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, rowsProcessed: totalRows, changes: changedRows });
  
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    let msg = err.message;
    if (err.code === 'ER_WARN_DATA_OUT_OF_RANGE') msg = "Data angka terlalu besar. Ubah kolom jadi VARCHAR/BIGINT.";
    res.status(500).json({ error: msg });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) res.sendFile(path.join(__dirname, '../dist/index.html'));
  else next();
});

const PORT = process.env.APP_PORT || 6002;
app.listen(PORT, '0.0.0.0', async () => { console.log(`🚀 Server on ${PORT}`); await seedAdmin(); });