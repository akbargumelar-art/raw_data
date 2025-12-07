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

// --- HELPER FUNCTION: FORMAT DATE FOR MYSQL ---
const formatToMysql = (val) => {
  if (val === null || val === undefined || val === '') return null;

  // 1. Handle JS Date objects (from Excel with cellDates: true)
  if (val instanceof Date) {
     if (isNaN(val.getTime())) return null;
     const y = val.getFullYear();
     const m = String(val.getMonth() + 1).padStart(2, '0');
     const d = String(val.getDate()).padStart(2, '0');
     const h = String(val.getHours()).padStart(2, '0');
     const min = String(val.getMinutes()).padStart(2, '0');
     const s = String(val.getSeconds()).padStart(2, '0');
     return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  // 2. Handle Strings
  if (typeof val === 'string') {
    const trimmed = val.trim();
    
    // A. DD/MM/YYYY or DD-MM-YYYY (Numeric)
    // Matches: 31/12/2024 10:00:00 or 31-12-2024
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (dmy) {
       const [_, d, m, y, h, min, s] = dmy;
       return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${h ? h.padStart(2, '0') : '00'}:${min ? min.padStart(2, '0') : '00'}:${s ? s.padStart(2, '0') : '00'}`;
    }

    // B. YYYY-MM-DD (Standard MySQL)
    // Matches: 2024-12-31 10:00:00
    const ymd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (ymd) {
        const [_, y, m, d, h, min, s] = ymd;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${h ? h.padStart(2, '0') : '00'}:${min ? min.padStart(2, '0') : '00'}:${s ? s.padStart(2, '0') : '00'}`;
    }

    // C. DD-MMM-YY or DD-MMM-YYYY (Text Month e.g. 04-DEC-25)
    // Matches: 04-DEC-25 09:59:32 or 04-Dec-2025
    const dMonY = trimmed.match(/^(\d{1,2})[\/\-]([a-zA-Z]{3})[\/\-](\d{2,4})(?:\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (dMonY) {
        const [_, d, monStr, yStr, h, min, s] = dMonY;
        
        const MONTH_MAP = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          // Indonesian / Alternative Variants
          mei: '05', ags: '08', okt: '10', des: '12', nop: '11'
        };

        const m = MONTH_MAP[monStr.toLowerCase()];
        
        // Only process if we recognize the month
        if (m) {
            let y = yStr;
            if (y.length === 2) {
                // Assume 20xx for 2-digit years. 
                // Adjust pivot if needed (e.g., if y > 80 assume 19xx), but for now 20xx is safe.
                y = '20' + y; 
            }

            return `${y}-${m}-${d.padStart(2, '0')} ${h ? h.padStart(2, '0') : '00'}:${min ? min.padStart(2, '0') : '00'}:${s ? s.padStart(2, '0') : '00'}`;
        }
    }
  }

  return val;
};

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
  const { db: dbName, table: tableName, page = 1, limit = 20, sort, dir, search, dateCol, start, end } = req.query;
  try {
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

    const fullTable = `${db.escapeId(dbName)}.${db.escapeId(tableName)}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `SELECT * FROM ${fullTable}`;
    let whereClauses = [];
    let params = [];

    // --- SEARCH LOGIC ---
    if (search) {
      const [columns] = await db.query(`DESCRIBE ${fullTable}`);
      const searchableCols = columns.map(c => c.Field);
      
      if (searchableCols.length > 0) {
        const searchConditions = searchableCols.map(col => `${db.escapeId(col)} LIKE ?`).join(' OR ');
        whereClauses.push(`(${searchConditions})`);
        searchableCols.forEach(() => params.push(`%${search}%`));
      }
    }

    // --- DATE FILTER LOGIC ---
    if (dateCol && start && end) {
      whereClauses.push(`${db.escapeId(dateCol)} BETWEEN ? AND ?`);
      params.push(`${start} 00:00:00`, `${end} 23:59:59`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    // --- SORT LOGIC ---
    if (sort) {
      const safeSort = db.escapeId(sort);
      const direction = dir === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${safeSort} ${direction}`;
    } else {
       // Default Sort: If 'updated_at' or 'created_at' exists, use it.
       const [cols] = await db.query(`DESCRIBE ${fullTable}`);
       const dateCol = cols.find(c => c.Field === 'updated_at' || c.Field === 'created_at' || c.Type.includes('datetime'));
       if (dateCol) {
          sql += ` ORDER BY ${db.escapeId(dateCol.Field)} DESC`;
       }
    }
    
    // Pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);
    res.json({ data: rows });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat data.' }); 
  }
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

// NEW: Download Template Excel
app.get('/api/data/template', authenticateToken, async (req, res) => {
  const { db: dbName, table: tableName } = req.query;
  
  try {
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

    // Get Table Schema to know columns
    const [columns] = await db.query(`DESCRIBE ${db.escapeId(dbName)}.${db.escapeId(tableName)}`);
    const headers = columns.map(c => c.Field);

    // Create a worksheet with only headers
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]); // Array of Arrays
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="TEMPLATE_${tableName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Template Generation Failed");
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

// Allow getting schema for standard users (Upload Page needs this for template/validation)
app.get('/api/data/table-schema-public', authenticateToken, async (req, res) => {
  const { db: dbName, table: tableName } = req.query;
  try {
     const { role, allowed } = await getUserAllowedDatabases(req.user.id);
     if (role !== 'admin' && !allowed.includes(dbName)) return res.status(403).json({ error: 'Akses ditolak.' });

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
  // CRITICAL: cellDates: true allows XLSX to parse date cells as Date objects
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (rawData.length === 0) throw new Error("File kosong.");

  let maxCols = 0, headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const nonEmpty = rawData[i].filter(c => c !== '' && c != null).length;
    if (nonEmpty > maxCols) { maxCols = nonEmpty; headerRowIndex = i; }
  }
  return XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: '' });
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
  const colDefs = columns.map(c => {
    // FIX: Primary Key columns MUST be NOT NULL in MySQL.
    // For non-PK columns, we default to NULL to allow flexible data import (empty cells).
    // Previous logic caused "All parts of a PRIMARY KEY must be NOT NULL" error for VARCHAR PKs.
    const isNullable = !c.isPrimaryKey; 
    return `${db.escapeId(c.name)} ${c.type} ${isNullable ? 'NULL' : 'NOT NULL'}`;
  });
  
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

  // CRITICAL: Disable timeout for large file uploads (millions of rows can take minutes)
  req.setTimeout(0); 

  const { role, allowed } = await getUserAllowedDatabases(req.user.id);
  if (role !== 'admin' && !allowed.includes(reqDb)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const fullTable = `${db.escapeId(reqDb)}.${db.escapeId(req.body.tableName)}`;
  const BATCH_SIZE = 5000; // Increased batch size for performance
  let totalInserted = 0;
  let totalProcessed = 0;

  const processBatch = async (batchData) => {
    if (batchData.length === 0) return;
    const cols = Object.keys(batchData[0]);
    const safeCols = cols.map(c => c.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
    
    // UPDATED: Apply formatToMysql on values to fix date issues
    const values = batchData.map(row => cols.map(c => formatToMysql(row[c])));
    
    const escapedCols = safeCols.map(c => db.escapeId(c));
    
    // UPDATED: Use INSERT IGNORE INTO
    // This accepts all data by ignoring duplicates (they won't be inserted, but no error thrown)
    const sql = `INSERT IGNORE INTO ${fullTable} (${escapedCols.join(', ')}) VALUES ?`;
    const [result] = await db.query(sql, [values]);
    
    totalInserted += result.affectedRows;
    totalProcessed += batchData.length;
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
    
    // Response: rowsProcessed is total file rows. changes is actual inserts (affectedRows).
    // With INSERT IGNORE, duplicates return 0 affectedRows.
    res.json({ success: true, rowsProcessed: totalProcessed, changes: totalInserted });
  
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    let msg = err.message;
    if (err.code === 'ER_WARN_DATA_OUT_OF_RANGE') msg = "Data angka terlalu besar. Ubah kolom jadi VARCHAR/BIGINT.";
    // ER_DUP_ENTRY shouldn't happen with INSERT IGNORE, but just in case
    if (err.code === 'ER_DUP_ENTRY') msg = "Gagal: Data duplikat ditemukan.";
    res.status(500).json({ error: msg });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) res.sendFile(path.join(__dirname, '../dist/index.html'));
  else next();
});

const PORT = process.env.APP_PORT || 6002;
app.listen(PORT, '0.0.0.0', async () => { console.log(`🚀 Server on ${PORT}`); });