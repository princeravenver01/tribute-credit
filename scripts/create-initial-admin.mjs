import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const requiredVariables = [
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
];

for (const variable of requiredVariables) {
  if (!process.env[variable]?.trim()) {
    throw new Error(`${variable} is required.`);
  }
}

const email = process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'Administrator';
const memberNumber = process.env.INITIAL_ADMIN_MEMBER_NO?.trim() || 'ADM-001';
const knownDemoPasswords = new Set(['Password123!', 'Pass123']);

if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('INITIAL_ADMIN_EMAIL must be a valid email address.');
if (password.length < 12) throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters.');
if (knownDemoPasswords.has(password)) throw new Error('INITIAL_ADMIN_PASSWORD cannot use a known demo password.');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? {} : undefined,
});

try {
  const passwordHash = await bcrypt.hash(password, 12);
  await connection.execute(
    `INSERT INTO users (member_no, name, email, password, role, status)
     VALUES (?, ?, ?, ?, 'admin', 'active')
     ON DUPLICATE KEY UPDATE
       member_no = VALUES(member_no),
       name = VALUES(name),
       password = VALUES(password),
       role = 'admin',
       status = 'active'`,
    [memberNumber, name, email, passwordHash],
  );

  console.log(`Initial administrator is ready: ${email}`);
} finally {
  await connection.end();
}
