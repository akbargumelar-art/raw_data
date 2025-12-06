import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'agrabudi.com',
  user: process.env.DB_USER || 'akbar',
  password: process.env.DB_PASS || 'Ciraya@555',
  // Defaulting DB_NAME to 'db_raw' as requested
  database: process.env.DB_NAME || 'db_raw', 
  port: parseInt(process.env.DB_PORT || '52306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Simple check to warn about connection issues immediately
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ DATABASE CONNECTION FAILED:", err.message);
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error("   Hint: The database name might be wrong. Check DB_NAME in .env");
    }
  } else {
    console.log("✅ Database connected successfully to " + (process.env.DB_HOST || 'agrabudi.com'));
    connection.release();
  }
});

export default promisePool;