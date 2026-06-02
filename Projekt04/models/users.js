import Database from 'better-sqlite3';
import path from 'path';
import argon2 from 'argon2';
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

// Legacy fields: existing DB may have `salt` and SHA-256 hashed passwords.
// New users and migrated passwords use Argon2. We keep `salt` column for
// backward-compatibility but it is no longer required for Argon2 hashes.

export function getUser(username) {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(String(username)) || null;
}

export function getUserById(id) {
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) || null;
}

export async function createUser(username, password) {
  const existing = getUser(username);
  if (existing) return { success: false, error: 'Username already exists' };

  try {
    const hashed = await argon2.hash(password);
    const result = db.prepare('INSERT INTO users (username, password, salt) VALUES (?, ?, ?)').run(
      username.trim(),
      hashed,
      ''
    );
    return { success: true, user: { id: result.lastInsertRowid, username: username.trim() } };
  } catch (err) {
    return { success: false, error: 'Failed to create user' };
  }
}

export async function verifyUser(username, password) {
  const user = getUser(username);
  if (!user) return null;

  // Legacy SHA-256 with salt
  if (user.salt && user.salt.length > 0) {
    const legacyHash = crypto.createHash('sha256').update(password + user.salt).digest('hex');
    if (legacyHash === user.password) {
      // Migrate: re-hash with argon2 and clear salt
      try {
        const newHash = await argon2.hash(password);
        db.prepare('UPDATE users SET password = ?, salt = ? WHERE id = ?').run(newHash, '', user.id);
      } catch (e) {
        // migration failed; ignore and continue to return success
        console.error('Password migration failed for user', user.username, e);
      }
      return { id: user.id, username: user.username };
    }
    return null;
  }

  // Argon2 verify
  try {
    const ok = await argon2.verify(user.password, password);
    if (!ok) return null;
    return { id: user.id, username: user.username };
  } catch (err) {
    return null;
  }
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

export async function deleteUser(id, username, password) {
  const user = getUserById(id);
  if (!user) return { success: false, error: 'User not found' };
  if (user.username !== username) return { success: false, error: 'Username mismatch' };

  const userData = getUser(username);
  if (!userData) return { success: false, error: 'User not found' };

  const verified = await verifyUser(username, password);
  if (!verified) return { success: false, error: 'Invalid password' };

  db.prepare('DELETE FROM recipes WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return { success: true };
}

export async function updatePassword(userId, oldPassword, newPassword) {
  const user = getUserById(userId);
  if (!user) return { success: false, error: 'User not found' };

  const userData = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!userData) return { success: false, error: 'User not found' };

  const verified = await (async () => {
    // reuse verifyUser to handle legacy and argon2
    const v = await verifyUser(userData.username, oldPassword);
    return !!v;
  })();
  if (!verified) return { success: false, error: 'Invalid current password' };

  if (newPassword.length < 4) return { success: false, error: 'New password must be at least 4 characters' };

  try {
    const newHash = await argon2.hash(newPassword);
    db.prepare('UPDATE users SET password = ?, salt = ? WHERE id = ?').run(newHash, '', userId);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to update password' };
  }
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