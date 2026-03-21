import express from 'express';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import {
  createUser,
  verifyUser,
  getUserById,
  getUser,
  generateSalt,
  hashPassword,
  getAllUsers,
  deleteUser
} from './models/users.js';
import {
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
  getUserPostedCount
} from './models/recipes.js';

const db = new Database(path.join(process.cwd(), 'database', 'recipes.db'));

function ensureAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get('admin');
  if (!existing) {
    const salt = generateSalt();
    const hashedPassword = hashPassword('admin123', salt);
    db.prepare('INSERT INTO users (username, password, salt) VALUES (?, ?, ?)').run(
      'admin',
      hashedPassword,
      salt
    );
    console.log('Admin user created');
  }
}

const app = express();
const port = 8000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'cookbook-secret-key-change-in-production';

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.urlencoded({ extended: false }));

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie || '');
  next();
});

function createSessionToken(userId) {
  const payload = String(userId);
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function verifySessionToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payload, signature] = decoded.split(':');
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (signature === expectedSignature) {
      return parseInt(payload, 10);
    }
    return null;
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const token = req.cookies?.session;
  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      req.user = getUserById(userId);
    }
  }
  res.locals.user = req.user || null;
  next();
});

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home - CookBook',
    error: !!req.query.error
  });
});

app.get('/account', (req, res) => {
  if (req.user) {
    const seedRecipes = getSeedRecipes();
    const userRecipes = getUserRecipes(req.user.id);
    const postedCount = getUserPostedCount(req.user.id);
    res.render('account', { title: 'Account', user: req.user, seedRecipes, userRecipes, postedCount });
  } else {
    res.render('account', { title: 'Account', user: null });
  }
});

app.get('/my-recipes', (req, res) => {
  if (!req.user) return res.redirect('/login');
  const userRecipes = getUserRecipes(req.user.id);
  res.render('myRecipes', { title: 'My Recipes', userRecipes });
});

app.get('/admin/users', (req, res) => {
  if (!req.user || req.user.username !== 'admin') {
    return res.redirect('/');
  }
  const users = getAllUsers();
  res.render('users', { title: 'User List', users });
});

app.get('/postconfirm', (req, res) => {
  if (!req.user || req.user.username !== 'admin') {
    return res.redirect('/');
  }
  const pendingRecipes = getPendingRecipes();
  res.render('postconfirm', { title: 'Post Confirm', pendingRecipes });
});

app.post('/admin/pending/:id/accept', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  db.prepare('UPDATE recipes SET pending = 0, posted = 1 WHERE id = ?').run(id);

  res.redirect('/postconfirm');
});

app.post('/admin/pending/:id/decline', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  db.prepare('UPDATE recipes SET pending = 0 WHERE id = ?').run(id);

  res.redirect('/postconfirm');
});

app.get('/admin/users/:id', (req, res) => {
  if (!req.user || req.user.username !== 'admin') {
    return res.redirect('/');
  }
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).send('User not found');
  res.render('userDetail', { title: `User: ${user.username}`, user });
});

app.get('/admin/users/:id/recipes', (req, res) => {
  if (!req.user || req.user.username !== 'admin') {
    return res.redirect('/');
  }
  const user = getUserById(req.params.id);
  if (!user) return res.status(404).send('User not found');
  const recipes = getUserOnlyRecipes(user.id);
  res.render('userRecipes', { title: `${user.username}'s Recipes`, user, recipes });
});

app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('register', { title: 'Register' });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { title: 'Register', error: 'Username and password are required' });
  }

  if (password.length < 4) {
    return res.render('register', { title: 'Register', error: 'Password must be at least 4 characters' });
  }

  const result = createUser(username, password);
  if (!result.success) {
    return res.render('register', { title: 'Register', error: result.error });
  }

  const token = createSessionToken(result.user.id);
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.redirect('/account');
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('login', { title: 'Login' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { title: 'Login', error: 'Username and password are required' });
  }

  const user = verifyUser(username, password);
  if (!user) {
    return res.render('login', { title: 'Login', error: 'Invalid username or password' });
  }

  const token = createSessionToken(user.id);
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.redirect('/account');
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/login');
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/login');
});

app.get('/delete-account', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.username === 'admin') return res.redirect('/account');
  res.render('deleteAccount', { title: 'Delete Account', error: null });
});

app.post('/delete-account', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.username === 'admin') return res.redirect('/account');

  const { username, password } = req.body;

  if (username !== req.user.username) {
    return res.render('deleteAccount', { title: 'Delete Account', error: 'Username does not match' });
  }

  const result = deleteUser(req.user.id, username, password);
  if (!result.success) {
    return res.render('deleteAccount', { title: 'Delete Account', error: result.error });
  }

  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/');
});

app.get('/add', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.render('add', { title: 'Add Recipe' });
});

app.post('/add', (req, res) => {
  if (!req.user) return res.redirect('/login');

  const { title, ingredients, instructions } = req.body;

  const newRecipe = {
    name: (title || '').trim(),
    description: (ingredients || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .join(', '),
    instructions: (instructions || '').trim()
  };

  const created = addRecipe(newRecipe, req.user.id);
  if (!created) return res.redirect('/?error=1');

  res.redirect('/my-recipes');
});

app.get('/recipes', (req, res) => {
  res.render('recipes', {
    title: 'Recipes',
    recipes: getAllRecipes(),
    isLoggedIn: !!req.user
  });
});

app.get('/recipes/:id', (req, res) => {
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipe(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  res.render('recipe', {
    title: recipe.name,
    recipe
  });
});

app.post('/recipes/:id/delete', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  if (recipe.user_id !== null) {
    db.prepare('UPDATE recipes SET posted = 0, pending = 0 WHERE id = ?').run(id);
  } else {
    deleteRecipeById(id);
  }

  res.redirect('/recipes');
});

app.post('/my-recipes/:id/post', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  if (recipe.user_id === req.user.id) {
    db.prepare('UPDATE recipes SET pending = 1 WHERE id = ?').run(id);
  }

  res.redirect('/my-recipes');
});

app.get('/edit/:id', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  if (recipe.user_id !== req.user.id && recipe.user_id !== null) {
    return res.status(403).send('You can only edit your own recipes');
  }

  const cancelUrl = '/my-recipes';

  res.render('edit', {
    title: `Edit: ${recipe.name}`,
    recipe,
    cancelUrl
  });
});

app.post('/edit/:id', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const { title, description, instructions } = req.body;

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  if (recipe.user_id !== req.user.id && recipe.user_id !== null) {
    return res.status(403).send('You can only edit your own recipes');
  }

  db.prepare('UPDATE recipes SET name = ?, description = ?, instructions = ? WHERE id = ?').run(
    (title || '').trim(),
    (description || '').trim(),
    (instructions || '').trim(),
    id
  );

  res.redirect('/recipes');
});

function isAdmin(req) {
  return req.user && req.user.username === 'admin';
}

app.get('/admin/recipes/:id/edit', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  res.render('edit', {
    title: `Edit: ${recipe.name}`,
    recipe,
    cancelUrl: '/recipes'
  });
});

app.post('/admin/recipes/:id/edit', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const { title, description, instructions } = req.body;

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  db.prepare('UPDATE recipes SET name = ?, description = ?, instructions = ? WHERE id = ?').run(
    (title || '').trim(),
    (description || '').trim(),
    (instructions || '').trim(),
    id
  );

  res.redirect('/recipes');
});

app.post('/admin/recipes/:id/delete', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipeById(id);
  if (recipe.user_id !== null) {
    db.prepare('UPDATE recipes SET posted = 0, pending = 0 WHERE id = ?').run(id);
  } else {
    deleteRecipeById(id);
  }

  res.redirect('/recipes');
});

app.get('/admin/users/:userId/recipes/:id/edit', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}
  const userId = parseInt(req.params.userId, 10);

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  let recipeToEdit = recipe;
  if (recipe.user_id === null) {
    const newId = duplicateRecipeForUser(recipe.id, userId);
    recipeToEdit = getRecipeById(newId);
  }

  res.render('edit', {
    title: `Edit: ${recipeToEdit.name}`,
    recipe: recipeToEdit,
    cancelUrl: '/admin/users/' + req.params.userId + '/recipes'
  });
});

app.post('/admin/users/:userId/recipes/:id/edit', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}
  const userId = parseInt(req.params.userId, 10);

  const { title, description, instructions } = req.body;

  const updatedRecipe = {
    name: (title || '').trim(),
    description: (description || '').trim(),
    instructions: (instructions || '').trim()
  };

  const existing = getRecipeById(id);
  if (!existing) return res.status(404).send('Recipe not found');

  db.prepare('UPDATE recipes SET name = ?, description = ?, instructions = ? WHERE id = ?').run(
    updatedRecipe.name,
    updatedRecipe.description,
    updatedRecipe.instructions,
    id
  );

  res.redirect('/admin/users/' + req.params.userId + '/recipes');
});

app.post('/admin/users/:userId/recipes/:id/delete', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}
  const userId = parseInt(req.params.userId, 10);

  const recipe = getRecipeById(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  if (recipe.user_id !== null && recipe.user_id === userId) {
    deleteRecipeById(id);
  }

  res.redirect('/admin/users/' + req.params.userId + '/recipes');
});

ensureAdminUser();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});