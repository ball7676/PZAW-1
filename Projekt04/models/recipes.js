import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'database', 'recipes.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    user_id INTEGER,
    posted INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    category TEXT DEFAULT '',
    cooking_time INTEGER DEFAULT 0,
    difficulty TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER,
    recipe_name TEXT,
    action TEXT NOT NULL,
    performed_by INTEGER,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recipe_id)
  )
`);

const columns = db.prepare("PRAGMA table_info(recipes)").all().map(c => c.name);
if (!columns.includes('user_id')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN user_id INTEGER`);
}
if (!columns.includes('created_at')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN created_at TEXT`);
}
if (!columns.includes('posted')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN posted INTEGER DEFAULT 0`);
}
if (!columns.includes('pending')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN pending INTEGER DEFAULT 0`);
}
if (!columns.includes('category')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN category TEXT DEFAULT ''`);
}
if (!columns.includes('cooking_time')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN cooking_time INTEGER DEFAULT 0`);
}
if (!columns.includes('difficulty')) {
  db.exec(`ALTER TABLE recipes ADD COLUMN difficulty TEXT DEFAULT ''`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)`);

const seedRecipes = [
  {
    name: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish with spaghetti in a sauce made from eggs, parmesan, bacon, and pepper.",
    instructions: "Cook spaghetti until al dente. On a pan, fry the bacon until crispy. In a bowl, mix eggs with grated parmesan and pepper. Toss the hot pasta with the bacon and remove from heat. Add the egg mixture and mix thoroughly to create a creamy sauce.",
    category: "Dinner",
    cooking_time: 30,
    difficulty: "Medium"
  },
  {
    name: "Chicken Curry",
    description: "Aromatic chicken curry in a creamy coconut sauce with Indian spices.",
    instructions: "Sauté onion, garlic, and ginger in oil. Add curry powder and turmeric. Add chicken pieces and brown on all sides. Pour in coconut milk and simmer covered for about 20 minutes until the sauce thickens.",
    category: "Dinner",
    cooking_time: 45,
    difficulty: "Medium"
  },
  {
    name: "Beef Stroganoff",
    description: "Russian dish with tender beef in a creamy mushroom sauce.",
    instructions: "Cut beef into thin strips and sauté in a pan. Add onion and mushrooms, fry until golden. Pour in broth, add mustard and cream, then simmer on low heat for a few minutes until the sauce thickens.",
    category: "Dinner",
    cooking_time: 35,
    difficulty: "Medium"
  },
  {
    name: "Pad Thai",
    description: "Traditional Thai dish with rice noodles fried with egg, tofu, shrimp, and tamarind sauce.",
    instructions: "Soak rice noodles in warm water. On a pan, sauté garlic, tofu, and shrimp. Add noodles, crack in egg and stir. Pour in tamarind sauce, fish sauce, and a bit of sugar. Serve with peanuts and lime.",
    category: "Dinner",
    cooking_time: 25,
    difficulty: "Medium"
  },
  {
    name: "Vegetable Stir Fry",
    description: "Colorful stir-fry with vegetables cooked in soy and sesame sauce.",
    instructions: "Cut vegetables (bell pepper, broccoli, carrots, zucchini). Heat a wok and fry vegetables on high heat for a few minutes. Add soy sauce, garlic, and a bit of sesame oil. Serve with rice or noodles.",
    category: "Dinner",
    cooking_time: 20,
    difficulty: "Easy"
  },
  {
    name: "Fish Tacos",
    description: "Mexican tacos with crispy fish, fresh vegetables, and creamy sauce.",
    instructions: "Cut fish fillets, coat in seasoned breadcrumbs and fry. In warmed tortillas, place fish, add cabbage, tomato, and yogurt-lime sauce. Roll up tacos and serve immediately.",
    category: "Dinner",
    cooking_time: 25,
    difficulty: "Easy"
  },
  {
    name: "Lentil Soup",
    description: "Nutritious red lentil soup with vegetables and spices.",
    instructions: "Sauté onion, garlic, and carrots. Add lentils, canned tomatoes, and vegetable broth. Cook for about 25 minutes until lentils soften. Season with cumin, paprika, and salt.",
    category: "Soup",
    cooking_time: 40,
    difficulty: "Easy"
  },
  {
    name: "Caesar Salad",
    description: "Classic salad with crispy romaine lettuce, croutons, parmesan, and Caesar dressing.",
    instructions: "Prepare dressing with mayonnaise, mustard, garlic, anchovies, lemon, and parmesan. Chop lettuce, add croutons and grated cheese. Drizzle with dressing and toss just before serving.",
    category: "Salad",
    cooking_time: 15,
    difficulty: "Easy"
  }
];

const existingCount = db.prepare('SELECT COUNT(*) as count FROM recipes').get();
if (existingCount.count === 0) {
  const insert = db.prepare("INSERT OR IGNORE INTO recipes (name, description, instructions, category, cooking_time, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))");
  for (const recipe of seedRecipes) {
    insert.run(recipe.name, recipe.description, recipe.instructions, recipe.category, recipe.cooking_time, recipe.difficulty);
  }
} else {
  const updateSeedRecipes = db.prepare("UPDATE recipes SET category = ?, cooking_time = ?, difficulty = ? WHERE LOWER(name) = LOWER(?)");
  for (const recipe of seedRecipes) {
    updateSeedRecipes.run(recipe.category, recipe.cooking_time, recipe.difficulty, recipe.name);
  }
}

export function getAllRecipes(page = 1, perPage = 12, search = '', sort = 'id', category = '', userId = null) {
  const offset = (page - 1) * perPage;
  let whereClause = 'WHERE (user_id IS NULL OR posted = 1)';
  const params = [];
  
  if (search) {
    whereClause += ' AND LOWER(name) LIKE LOWER(?)';
    params.push('%' + search + '%');
  }
  
  if (category) {
    whereClause += ' AND category = ?';
    params.push(category);
  }
  
  let orderColumn = 'id';
  let orderDir = 'DESC';
  
  if (sort === 'name') {
    orderColumn = 'name';
    orderDir = 'ASC';
  } else if (sort === 'created') {
    orderColumn = 'created_at';
    orderDir = 'DESC';
  }
  
  const query = `SELECT * FROM recipes ${whereClause} ORDER BY ${orderColumn} ${orderDir} LIMIT ? OFFSET ?`;
  const rows = db.prepare(query).all([...params, perPage, offset]);
  const countQuery = `SELECT COUNT(*) as count FROM recipes ${whereClause}`;
  const countResult = db.prepare(countQuery).get(params);
  
  if (userId) {
    const favoriteIds = db.prepare('SELECT recipe_id FROM favorites WHERE user_id = ?').all(userId).map(f => f.recipe_id);
    rows.forEach(recipe => {
      recipe.isFavorited = favoriteIds.includes(recipe.id);
    });
  }
  
  return {
    recipes: rows,
    total: countResult.count,
    page,
    perPage,
    totalPages: Math.ceil(countResult.count / perPage)
  };
}

export function getPendingRecipes() {
  return db.prepare('SELECT id, name, description, user_id FROM recipes WHERE pending = 1 ORDER BY id').all();
}

export function getUserPostedCount(userId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE user_id = ? AND posted = 1').get(userId);
  return result.count;
}

export function getUserRecipes(userId) {
  return db.prepare('SELECT id, name, description, user_id, category, cooking_time, difficulty FROM recipes WHERE user_id = ? ORDER BY id').all(userId);
}

export function getUserOnlyRecipes(userId) {
  return db.prepare('SELECT id, name, description, user_id FROM recipes WHERE user_id = ? ORDER BY id').all(userId);
}

export function getRecipe(idOrName, userId = null) {
  let row;
  if (/^\d+$/.test(String(idOrName))) {
    row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(idOrName);
  } else {
    row = db.prepare('SELECT * FROM recipes WHERE LOWER(name) = LOWER(?)').get(String(idOrName));
  }
  return row || null;
}

export function getRecipeById(id) {
  return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) || null;
}

export function deleteRecipeById(id) {
  const existing = getRecipeById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM favorites WHERE recipe_id = ?').run(id);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return true;
}

export function updateRecipeFull(id, payload) {
  const existing = getRecipeById(id);
  if (!existing) return null;
  
  db.prepare(`UPDATE recipes SET name = ?, description = ?, instructions = ?, category = ?, cooking_time = ?, difficulty = ? WHERE id = ?`).run(
    payload.name || existing.name,
    payload.description || existing.description,
    payload.instructions || existing.instructions,
    payload.category !== undefined ? payload.category : existing.category,
    payload.cooking_time !== undefined ? payload.cooking_time : existing.cooking_time,
    payload.difficulty !== undefined ? payload.difficulty : existing.difficulty,
    id
  );
  return getRecipeById(id);
}

export function getCategories() {
  const rows = db.prepare("SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category != '' ORDER BY category").all();
  return rows.map(r => r.category);
}

export function getUserRecipesWithFavorites(userId) {
  const recipes = db.prepare('SELECT id, name, description, user_id, category, cooking_time, difficulty FROM recipes WHERE user_id = ? ORDER BY id').all(userId);
  return recipes.map(recipe => ({
    ...recipe,
    isFavorited: false
  }));
}

export function getSeedRecipes() {
  return db.prepare('SELECT id, name, description, category, cooking_time, difficulty FROM recipes WHERE user_id IS NULL ORDER BY id').all();
}

export function duplicateRecipeForUser(recipeId, userId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe || recipe.user_id !== null) return null;
  
  const existing = db.prepare("SELECT id FROM recipes WHERE LOWER(name) = LOWER(?) AND user_id = ?").get(recipe.name, userId);
  if (existing) return existing.id;
  
  const result = db.prepare("INSERT INTO recipes (name, description, instructions, user_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(
    recipe.name,
    recipe.description,
    recipe.instructions,
    userId
  );
  return result.lastInsertRowid;
}

export function addRecipe(payload, userId = null) {
  const name = payload?.name?.trim();
  if (!name || !payload.description) return null;

  const result = db.prepare(`INSERT INTO recipes (name, description, instructions, user_id, category, cooking_time, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    name,
    payload.description,
    payload.instructions || '',
    userId,
    payload.category || '',
    payload.cooking_time || 0,
    payload.difficulty || ''
  );
  db.prepare(`INSERT INTO recipe_history (recipe_id, recipe_name, action, performed_by, details) VALUES (?, ?, ?, ?, ?)`).run(
    result.lastInsertRowid,
    name,
    'created',
    userId,
    null
  );
  return { id: result.lastInsertRowid, name, description: payload.description, instructions: payload.instructions || '', user_id: userId, category: payload.category || '', cooking_time: payload.cooking_time || 0, difficulty: payload.difficulty || '' };
}

export function getRecipeHistory() {
  return db.prepare(`
    SELECT rh.*, u.username 
    FROM recipe_history rh 
    LEFT JOIN users u ON rh.performed_by = u.id 
    ORDER BY rh.id DESC
  `).all();
}

export function getUserRecipeHistory(userId) {
  return db.prepare(`
    SELECT rh.*, u.username 
    FROM recipe_history rh 
    LEFT JOIN users u ON rh.performed_by = u.id 
    WHERE rh.performed_by = ? 
       OR rh.details LIKE ?
    ORDER BY rh.id DESC
  `).all(userId, `%user_id: ${userId}%`);
}

export function addRecipeHistory(recipeId, recipeName, action, performedBy, details = null) {
  db.prepare("INSERT INTO recipe_history (recipe_id, recipe_name, action, performed_by, details, performed_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").run(
    recipeId,
    recipeName,
    action,
    performedBy,
    details
  );
}

export function resetSeedRecipes() {
  db.prepare('DELETE FROM recipes WHERE user_id IS NULL').run();
  const insert = db.prepare("INSERT INTO recipes (name, description, instructions, created_at) VALUES (?, ?, ?, datetime('now'))");
  for (const recipe of seedRecipes) {
    insert.run(recipe.name, recipe.description, recipe.instructions);
  }
  return seedRecipes.length;
}

export default {
  getAllRecipes,
  getSeedRecipes,
  getUserRecipes,
  getUserOnlyRecipes,
  getRecipe,
  getRecipeById,
  addRecipe,
  deleteRecipeById,
  duplicateRecipeForUser,
  getPendingRecipes,
  getUserPostedCount,
  getRecipeHistory,
  getUserRecipeHistory,
  addRecipeHistory,
  resetSeedRecipes,
  updateRecipeFull,
  getCategories,
  getUserRecipesWithFavorites
};