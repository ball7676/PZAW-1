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
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!columns.includes('salt')) {
  db.exec(`ALTER TABLE users ADD COLUMN salt TEXT`);
}
if (!columns.includes('created_at')) {
  db.exec(`ALTER TABLE users ADD COLUMN created_at TEXT`);
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

export function getAllUsers() {
  return db.prepare('SELECT id, username FROM users').all();
}

export function searchUsers(query) {
  if (!query || query.trim() === '') {
    return getAllUsers();
  }
  return db.prepare('SELECT id, username FROM users WHERE LOWER(username) LIKE LOWER(?)').all('%' + query.trim() + '%');
}

export function deleteUser(id, username, password) {
  const user = getUserById(id);
  if (!user) return { success: false, error: 'User not found' };
  if (user.username !== username) return { success: false, error: 'Username mismatch' };
  
  const userData = getUser(username);
  if (!userData) return { success: false, error: 'User not found' };
  
  const hashedPassword = hashPassword(password, userData.salt);
  if (userData.password !== hashedPassword) return { success: false, error: 'Invalid password' };
  
  db.prepare('DELETE FROM recipes WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return { success: true };
}

export function updatePassword(userId, oldPassword, newPassword) {
  const user = getUserById(userId);
  if (!user) return { success: false, error: 'User not found' };
  
  const userData = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!userData) return { success: false, error: 'User not found' };
  
  const hashedOldPassword = hashPassword(oldPassword, userData.salt);
  if (userData.password !== hashedOldPassword) return { success: false, error: 'Invalid current password' };
  
  if (newPassword.length < 4) return { success: false, error: 'New password must be at least 4 characters' };
  
  const newSalt = generateSalt();
  const hashedNewPassword = hashPassword(newPassword, newSalt);
  
  db.prepare('UPDATE users SET password = ?, salt = ? WHERE id = ?').run(hashedNewPassword, newSalt, userId);
  return { success: true };
}

export function getUserCreatedAt(userId) {
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  return user ? user.created_at : null;
}

export function getUserFavorites(userId) {
  return db.prepare(`
    SELECT r.*, f.created_at as favorited_at 
    FROM favorites f 
    JOIN recipes r ON f.recipe_id = r.id 
    WHERE f.user_id = ?
  `).all(userId);
}

export function addFavorite(userId, recipeId) {
  try {
    db.prepare('INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)').run(userId, recipeId);
    return true;
  } catch {
    return false;
  }
}

export function removeFavorite(userId, recipeId) {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?').run(userId, recipeId);
}

export function isFavorited(userId, recipeId) {
  const result = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?').get(userId, recipeId);
  return !!result;
}

export default {
  getUser,
  getUserById,
  createUser,
  verifyUser,
  generateSalt,
  hashPassword,
  getAllUsers,
  searchUsers,
  deleteUser,
  updatePassword,
  getUserCreatedAt,
  getUserFavorites,
  addFavorite,
  removeFavorite,
  isFavorited
};