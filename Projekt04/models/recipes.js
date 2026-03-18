import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'database', 'recipes.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    instructions TEXT
  )
`);

const existingCount = db.prepare('SELECT COUNT(*) as count FROM recipes').get();
if (existingCount.count === 0) {
  const seedRecipes = [
    {
      name: "Spaghetti Carbonara",
      description: "Classic Italian pasta dish with spaghetti in a sauce made from eggs, parmesan, bacon, and pepper.",
      instructions: "Cook spaghetti until al dente. On a pan, fry the bacon until crispy. In a bowl, mix eggs with grated parmesan and pepper. Toss the hot pasta with the bacon and remove from heat. Add the egg mixture and mix thoroughly to create a creamy sauce."
    },
    {
      name: "Chicken Curry",
      description: "Aromatic chicken curry in a creamy coconut sauce with Indian spices.",
      instructions: "Sauté onion, garlic, and ginger in oil. Add curry powder and turmeric. Add chicken pieces and brown on all sides. Pour in coconut milk and simmer covered for about 20 minutes until the sauce thickens."
    },
    {
      name: "Beef Stroganoff",
      description: "Russian dish with tender beef in a creamy mushroom sauce.",
      instructions: "Cut beef into thin strips and sauté in a pan. Add onion and mushrooms, fry until golden. Pour in broth, add mustard and cream, then simmer on low heat for a few minutes until the sauce thickens."
    },
    {
      name: "Pad Thai",
      description: "Traditional Thai dish with rice noodles fried with egg, tofu, shrimp, and tamarind sauce.",
      instructions: "Soak rice noodles in warm water. On a pan, sauté garlic, tofu, and shrimp. Add noodles, crack in egg and stir. Pour in tamarind sauce, fish sauce, and a bit of sugar. Serve with peanuts and lime."
    },
    {
      name: "Vegetable Stir Fry",
      description: "Colorful stir-fry with vegetables cooked in soy and sesame sauce.",
      instructions: "Cut vegetables (bell pepper, broccoli, carrots, zucchini). Heat a wok and fry vegetables on high heat for a few minutes. Add soy sauce, garlic, and a bit of sesame oil. Serve with rice or noodles."
    },
    {
      name: "Fish Tacos",
      description: "Mexican tacos with crispy fish, fresh vegetables, and creamy sauce.",
      instructions: "Cut fish fillets, coat in seasoned breadcrumbs and fry. In warmed tortillas, place fish, add cabbage, tomato, and yogurt-lime sauce. Roll up tacos and serve immediately."
    },
    {
      name: "Lentil Soup",
      description: "Nutritious red lentil soup with vegetables and spices.",
      instructions: "Sauté onion, garlic, and carrots. Add lentils, canned tomatoes, and vegetable broth. Cook for about 25 minutes until lentils soften. Season with cumin, paprika, and salt."
    },
    {
      name: "Caesar Salad",
      description: "Classic salad with crispy romaine lettuce, croutons, parmesan, and Caesar dressing.",
      instructions: "Prepare dressing with mayonnaise, mustard, garlic, anchovies, lemon, and parmesan. Chop lettuce, add croutons and grated cheese. Drizzle with dressing and toss just before serving."
    }
  ];

  const insert = db.prepare('INSERT INTO recipes (name, description, instructions) VALUES (?, ?, ?)');
  for (const recipe of seedRecipes) {
    insert.run(recipe.name, recipe.description, recipe.instructions);
  }
}

export function getAllRecipes() {
  const rows = db.prepare('SELECT id, name, description FROM recipes ORDER BY id').all();
  return rows;
}

export function getRecipe(idOrName) {
  let row;
  if (/^\d+$/.test(String(idOrName))) {
    row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(idOrName);
  } else {
    row = db.prepare('SELECT * FROM recipes WHERE LOWER(name) = LOWER(?)').get(String(idOrName));
  }
  return row || null;
}

export function addRecipe(payload) {
  const name = payload?.name?.trim();
  if (!name || !payload.description) return null;

  try {
    const result = db.prepare('INSERT INTO recipes (name, description, instructions) VALUES (?, ?, ?)').run(
      name,
      payload.description,
      payload.instructions || ''
    );
    return { id: result.lastInsertRowid, name, description: payload.description, instructions: payload.instructions || '' };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
    throw err;
  }
}

export function updateRecipe(idOrName, payload) {
  const existing = getRecipe(idOrName);
  if (!existing) return false;

  const name = payload.name?.trim() || existing.name;
  const description = payload.description || existing.description;
  const instructions = payload.instructions !== undefined ? payload.instructions : existing.instructions;

  try {
    db.prepare('UPDATE recipes SET name = ?, description = ?, instructions = ? WHERE id = ?').run(
      name,
      description,
      instructions,
      existing.id
    );
    return true;
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
    throw err;
  }
}

export function deleteRecipe(idOrName) {
  const existing = getRecipe(idOrName);
  if (!existing) return false;

  db.prepare('DELETE FROM recipes WHERE id = ?').run(existing.id);
  return true;
}

export default {
  getAllRecipes,
  getRecipe,
  addRecipe,
  updateRecipe,
  deleteRecipe
};
