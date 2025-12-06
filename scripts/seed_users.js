
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../server/db');

const seedUsers = async () => {
  console.log("🌱 Starting User Seeding...");

  try {
    // 1. Pastikan tabel users ada
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
    console.log("✅ Table 'users' verified.");

    // 2. Siapkan data dummy
    const users = [
      {
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      },
      {
        username: 'operator',
        password: 'op123',
        role: 'operator'
      }
    ];

    // 3. Insert ke database
    for (const user of users) {
      // Cek apakah user sudah ada
      const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [user.username]);
      
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await db.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [user.username, hashedPassword, user.role]
        );
        console.log(`✅ Created user: ${user.username} (${user.role}) - Pass: ${user.password}`);
      } else {
        console.log(`ℹ️ User ${user.username} already exists. Skipping.`);
      }
    }

    console.log("\n🎉 Seeding Complete! You can now login.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Seeding Failed:", err);
    process.exit(1);
  }
};

seedUsers();
