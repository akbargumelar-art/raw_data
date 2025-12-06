
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors()); // Allow all CORS for development ease
app.use(express.json());

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
    // Ensure we are checking the users table
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
  const [users] = await db.query('SELECT id, username, role FROM users');
  res.json(users);
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, role]);
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
app.get('/api/data/databases', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SHOW DATABASES');
    // Filter out system schemas usually not needed
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
    const databases = rows
      .map(r => Object.values(r)[0])
      .filter(d => !systemDbs.includes(d));
    res.json({ databases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list databases' });
  }
});

app.get('/api/data/tables', authenticateToken, async (req, res) => {
  const dbName = req.query.db;
  if (!dbName) return res.status(400).json({ error: 'Database parameter required' });

  try {
    // Use the specific database to show tables
    const [rows] = await db.query(`SHOW TABLES FROM ${db.escapeId(dbName)}`);
    const tables = rows.map(r => Object.values(r)[0]);
    res.json({ tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

// SCHEMA BUILDER: Analyze File
app.post('/api/data/analyze', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });

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
        // Destroy stream after we have enough preview data
        stream.destroy(); 
      }
    })
    .on('close', () => {
       finishAnalysis();
    })
    .on('error', (err) => {
       // 'close' might be called after destroy, handling error just in case
       if(!headers) res.status(500).json({error: 'Failed to parse CSV'});
    })
    .on('end', () => {
       finishAnalysis();
    });

  function finishAnalysis() {
    // Infer types
    const columns = headers.map(header => {
      let isInt = true;
      let isFloat = true;
      let isDate = true;
      
      // Check first few rows to guess type
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

      // Default ID or SKU to primary key guess
      const isPrimaryKey = /id|sku|code/i.test(header);

      return { name: header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(), type, isPrimaryKey };
    });

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({ columns, previewData: results });
  }
});

// SCHEMA BUILDER: Create Table
app.post('/api/data/create-table', authenticateToken, async (req, res) => {
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

// STREAMING UPLOAD LOGIC
app.post('/api/data/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file || !req.body.tableName || !req.body.databaseName) {
    return res.status(400).json({ error: 'File, Database, and Table Name required' });
  }

  const filePath = req.file.path;
  const databaseName = db.escapeId(req.body.databaseName);
  const tableName = db.escapeId(req.body.tableName);
  const fullTableName = `${databaseName}.${tableName}`;

  const BATCH_SIZE = 1000;
  let rows = [];
  let totalProcessed = 0;
  let headers = null;

  const processBatch = async (batchData) => {
    if (batchData.length === 0) return;
    
    // Construct dynamic upsert query
    const cols = Object.keys(batchData[0]);
    const values = batchData.map(row => cols.map(c => row[c]));
    
    const escapedCols = cols.map(c => db.escapeId(c));
    const updateClause = escapedCols.map(c => `${c}=VALUES(${c})`).join(', ');
    
    const sql = `INSERT INTO ${fullTableName} (${escapedCols.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
    
    await db.query(sql, [values]);
    totalProcessed += batchData.length;
  };

  const stream = fs.createReadStream(filePath)
    .pipe(csv());

  // Wrap stream processing in a promise
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
        fs.unlinkSync(filePath); // Cleanup
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
    console.error("Upload processing failed:", err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.code === 'ER_NO_SUCH_TABLE' ? `Table ${fullTableName} does not exist` : 'Format error or DB connection lost' });
  }
});

// Seed default admin if not exists (Robust Version)
const seedAdmin = async () => {
  try {
    // 1. Ensure Users Table Exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'operator') NOT NULL DEFAULT 'operator',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.query(createTableQuery);

    // 2. Check if admin exists
    const [users] = await db.query("SELECT * FROM users WHERE role='admin'");
    if (users.length === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await db.query("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashed, 'admin']);
      console.log("✅ System Initialized: Default admin user created (admin / admin123).");
    } else {
      console.log("✅ System Ready: Admin user exists.");
    }
  } catch (e) {
    console.error("❌ DB Initialization Failed:", e.message);
    console.error("   Ensure the database defined in server/db.js exists on the remote host.");
  }
};

const PORT = process.env.APP_PORT || 6002;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await seedAdmin();
});
