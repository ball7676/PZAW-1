import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'database', 'recipes.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL
  )
`);

const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!columns.includes('salt')) {
  db.exec(`ALTER TABLE users ADD COLUMN salt TEXT`);
}

export function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function getUser(username) {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(String(username)) || null;
}

export function getUserById(id) {
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) || null;
}

export function createUser(username, password) {
  const existing = getUser(username);
  if (existing) return { success: false, error: 'Username already exists' };

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);
  try {
    const result = db.prepare('INSERT INTO users (username, password, salt) VALUES (?, ?, ?)').run(
      username.trim(),
      hashedPassword,
      salt
    );
    return { success: true, user: { id: result.lastInsertRowid, username: username.trim() } };
  } catch (err) {
    return { success: false, error: 'Failed to create user' };
  }
}

export function verifyUser(username, password) {
  const user = getUser(username);
  if (!user) return null;

  const hashedPassword = hashPassword(password, user.salt);
  if (user.password !== hashedPassword) return null;

  return { id: user.id, username: user.username };
}

export default {
  getUser,
  getUserById,
  createUser,
  verifyUser,
  generateSalt,
  hashPassword
};