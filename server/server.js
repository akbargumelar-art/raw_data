
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
import { createRequire } from 'module'; // Import createRequire to load CJS modules safely
import db from './db.js';

dotenv.config();

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Require for CJS modules (Bulletproof way to load xlsx)
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors()); 
app.use(express.json());

// SERVE STATIC FILES (React Frontend)
app.use(express.static(path.join(__dirname, '../dist')));

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_123';

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server_time: new Date().toISOString() });
});

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalid' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- Auth Routes ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ error: 'User not found' });
    
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// --- Admin Routes ---
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const [users] = await db.query('SELECT id, username, role, allowed_databases FROM users');
  const formattedUsers = users.map(u => ({
    ...u,
    allowedDatabases: u.allowed_databases ? JSON.parse(u.allowed_databases) : []
  }));
  res.json(formattedUsers);
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role, allowedDatabases } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    // Store allowed databases as JSON string
    const allowedDbString = allowedDatabases ? JSON.stringify(allowedDatabases) : '[]';
    
    await db.query(
      'INSERT INTO users (username, password, role, allowed_databases) VALUES (?, ?, ?, ?)', 
      [username, hashed, role, allowedDbString]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// --- Data Routes ---

// Helper: Get User's Allowed DBs
const getUserAllowedDatabases = async (userId) => {
  const [rows] = await db.query('SELECT role, allowed_databases FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) return { role: 'operator', allowed: [] };
  
  const user = rows[0];
  const allowed = user.allowed_databases ? JSON.parse(user.allowed_databases) : [];
  return { role: user.role, allowed };
};

app.get('/api/data/databases', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
    const allDatabases = rows
      .map(r => Object.values(r)[0])
      .filter(d => !systemDbs.includes(d));

    // Filter based on user permissions
    const { role, allowed } = await getUserAllowedDatabases(req.user.id);
    
    if (role === 'admin') {
      // Admin sees everything
      res.json({ databases: allDatabases });
    } else {
      // Operator only sees allowed databases
      // Also filter out any DBs that might have been deleted from server but still in user permission
      const userDbs = allDatabases.filter(db => allowed.includes(db));
      res.json({ databases: userDbs });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list databases' });
  }
});

app.post('/api/data/create-database', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName } = req.body;
  if (!databaseName) return res.status(400).json({ error: 'Database name required' });
  const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeName) return res.status(400).json({ error: 'Invalid database name' });

  try {
    await db.query(`CREATE DATABASE ${safeName}`);
    res.json({ success: true, databaseName: safeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/tables', authenticateToken, async (req, res) => {
  const dbName = req.query.db;
  if (!dbName) return res.status(400).json({ error: 'Database parameter required' });

  // Security Check
  const { role, allowed } = await getUserAllowedDatabases(req.user.id);
  if (role !== 'admin' && !allowed.includes(dbName)) {
    return res.status(403).json({ error: 'Access to this database is denied' });
  }

  try {
    const [rows] = await db.query(`SHOW TABLES FROM ${db.escapeId(dbName)}`);
    const tables = rows.map(r => Object.values(r)[0]);
    res.json({ tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

// HELPER: Smart Header Detection for Excel
function getExcelDataWithSmartHeader(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rawData.length === 0) throw new Error("Empty file");

  let maxCols = 0;
  let headerRowIndex = 0;
  const limit = Math.min(rawData.length, 15); // Scan first 15 rows

  for (let i = 0; i < limit; i++) {
    const row = rawData[i];
    if (Array.isArray(row)) {
      const nonEmptyCount = row.filter(cell => cell !== '' && cell !== null && cell !== undefined).length;
      if (nonEmptyCount > maxCols) {
        maxCols = nonEmptyCount;
        headerRowIndex = i;
      }
    }
  }

  // Get data starting from smart header
  return XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
}

// SCHEMA BUILDER: Analyze File (Smart Header Detection)
app.post('/api/data/analyze', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const jsonData = getExcelDataWithSmartHeader(req.file.path);
      if (jsonData.length === 0) throw new Error("No data found after header");
      
      const headers = Object.keys(jsonData[0]);
      const previewData = jsonData.slice(0, 5);
      analyzeAndResponse(headers, previewData, res, req.file.path);

    } catch (err) {
      console.error("Excel Parse Error:", err);
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'Failed to parse Excel file. Ensure it is valid.' });
    }

  } else {
    const results = [];
    const maxPreview = 5;
    let headers = null;

    const stream = fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        if (!headers) headers = Object.keys(data);
        if (results.length < maxPreview) {
          results.push(data);
        } else {
          stream.destroy(); 
        }
      })
      .on('close', () => {
         analyzeAndResponse(headers, results, res, req.file.path);
      })
      .on('error', (err) => {
         if(!headers) res.status(500).json({error: 'Failed to parse CSV'});
      })
      .on('end', () => {
         analyzeAndResponse(headers, results, res, req.file.path);
      });
  }

  function analyzeAndResponse(headers, results, res, filePath) {
    if (!headers || headers.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Could not detect headers" });
    }

    const columns = headers.map(header => {
      let isInt = true;
      let isFloat = true;
      let isDate = true;
      
      for (const row of results) {
        const val = row[header];
        if (!val) continue;
        if (isNaN(Number(val))) {
          isInt = false;
          isFloat = false;
        } else {
          if (!Number.isInteger(Number(val))) isInt = false;
        }
        if (isNaN(Date.parse(val))) isDate = false;
      }

      let type = 'VARCHAR(255)';
      if (isInt) type = 'INT';
      else if (isFloat) type = 'DECIMAL(10,2)';
      else if (isDate) type = 'DATE';

      const isPrimaryKey = /id|sku|code|no/i.test(header);

      return { name: header.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(), type, isPrimaryKey };
    });

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ columns, previewData: results });
  }
});

app.post('/api/data/create-table', authenticateToken, requireAdmin, async (req, res) => {
  const { databaseName, tableName, columns } = req.body;
  if (!databaseName || !tableName || !columns) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const dbId = db.escapeId(databaseName);
  const tableId = db.escapeId(tableName);
  const fullTable = `${dbId}.${tableId}`;

  const colDefs = columns.map(c => {
    return `${db.escapeId(c.name)} ${c.type} ${c.isPrimaryKey ? 'PRIMARY KEY' : ''}`;
  });

  const sql = `CREATE TABLE ${fullTable} (${colDefs.join(', ')})`;

  try {
    await db.query(sql);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DATA UPLOAD: Supports CSV & Excel
app.post('/api/data/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const reqDb = req.body.databaseName;
  if (!req.file || !req.body.tableName || !reqDb) {
    return res.status(400).json({ error: 'File, Database, and Table Name required' });
  }

  // Security Check: Verify User Permission for this DB
  const { role, allowed } = await getUserAllowedDatabases(req.user.id);
  if (role !== 'admin' && !allowed.includes(reqDb)) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'You do not have permission to upload to this database.' });
  }

  const filePath = req.file.path;
  const databaseName = db.escapeId(reqDb);
  const tableName = db.escapeId(req.body.tableName);
  const fullTableName = `${databaseName}.${tableName}`;

  const BATCH_SIZE = 1000;
  let totalProcessed = 0;

  const processBatch = async (batchData) => {
    if (batchData.length === 0) return;
    const cols = Object.keys(batchData[0]);
    
    // Normalize keys to match safe column names
    const safeCols = cols.map(c => c.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
    
    const values = batchData.map(row => cols.map(c => row[c]));
    
    const escapedCols = safeCols.map(c => db.escapeId(c));
    const updateClause = escapedCols.map(c => `${c}=VALUES(${c})`).join(', ');
    
    const sql = `INSERT INTO ${fullTableName} (${escapedCols.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
    await db.query(sql, [values]);
    totalProcessed += batchData.length;
  };

  const ext = path.extname(req.file.originalname).toLowerCase();

  // --- EXCEL HANDLING ---
  if (ext === '.xlsx' || ext === '.xls') {
     try {
       const jsonData = getExcelDataWithSmartHeader(filePath);
       
       // Process in chunks to avoid memory spike
       for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
         const batch = jsonData.slice(i, i + BATCH_SIZE);
         await processBatch(batch);
       }
       
       fs.unlinkSync(filePath);
       res.json({ success: true, rowsProcessed: totalProcessed });

     } catch (err) {
       console.error("Excel Upload Error:", err);
       if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
       res.status(500).json({ 
         error: err.code === 'ER_NO_SUCH_TABLE' 
           ? `Table ${fullTableName} does not exist.` 
           : `Excel Error: ${err.message}` 
       });
     }

  // --- CSV HANDLING ---
  } else {
    let rows = [];
    let headers = null;

    const stream = fs.createReadStream(filePath)
      .pipe(csv());

    const streamPromise = new Promise((resolve, reject) => {
      stream.on('data', async (data) => {
        if (!headers) headers = Object.keys(data);
        rows.push(data);
        if (rows.length >= BATCH_SIZE) {
          stream.pause();
          try {
            await processBatch(rows);
            rows = [];
            stream.resume();
          } catch (err) {
            stream.destroy();
            reject(err);
          }
        }
      });
      stream.on('end', async () => {
        try {
          if (rows.length > 0) await processBatch(rows);
          fs.unlinkSync(filePath);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      stream.on('error', (err) => {
        reject(err);
      });
    });

    try {
      await streamPromise;
      res.json({ success: true, rowsProcessed: totalProcessed });
    } catch (err) {
      console.error("CSV Upload processing failed:", err);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: err.code === 'ER_NO_SUCH_TABLE' ? `Table ${fullTableName} does not exist` : 'Format error or DB connection lost' });
    }
  }
});

const seedAdmin = async () => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'operator') NOT NULL DEFAULT 'operator',
        allowed_databases TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.query(createTableQuery);
    
    // Auto-migrate: Add allowed_databases column if missing for existing installs
    try {
      await db.query("SELECT allowed_databases FROM users LIMIT 1");
    } catch (e) {
      console.log("ℹ️ Migrating DB: Adding allowed_databases column...");
      await db.query("ALTER TABLE users ADD COLUMN allowed_databases TEXT NULL");
    }

    const [users] = await db.query("SELECT * FROM users WHERE role='admin'");
    if (users.length === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await db.query("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashed, 'admin']);
      console.log("✅ System Initialized: Default admin user created (admin / admin123).");
    } else {
      console.log("✅ System Ready: Admin user exists.");
    }
  } catch (e) {
    console.error("ℹ️ DB Initialization Skipped:", e.code || e.message);
  }
};

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

const PORT = process.env.APP_PORT || 6002;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  await seedAdmin();
});
