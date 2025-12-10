import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'database', 'data');
const DB_FILE = path.join(DB_DIR, 'recipes.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, '[]', 'utf8');
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

function save(data) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

export function getAll() {
  return load();
}

export function getByName(name) {
  const data = load();
  return data.find(
    r => r.name.toLowerCase() === name.toLowerCase()
  ) || null;
}

export function add(recipe) {
  const data = load();

  const exists = data.some(
    r => r.name.toLowerCase() === recipe.name.toLowerCase()
  );
  if (exists) return null;

  data.push(recipe);
  save(data);
  return recipe;
}

export function remove(name) {
  const data = load();
  const idx = data.findIndex(
    r => r.name.toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) return false;

  data.splice(idx, 1);
  save(data);
  return true;
}
