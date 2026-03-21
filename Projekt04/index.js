import express from 'express';
import path from 'path';
import crypto from 'crypto';
import {
  getAllRecipes,
  getSeedRecipes,
  getUserRecipes,
  getRecipe,
  addRecipe,
  updateRecipe,
  deleteRecipe
} from './models/recipes.js';
import {
  createUser,
  verifyUser,
  getUserById
} from './models/users.js';

const app = express();
const port = 8000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'cookbook-secret-key-change-in-production';

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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

app.use((req, res, next) => {
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
    res.render('account', { title: 'Account', user: req.user, seedRecipes, userRecipes });
  } else {
    res.render('account', { title: 'Account', user: null });
  }
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

  res.redirect('/recipes');
});

app.get('/recipes', (req, res) => {
  const userId = req.user ? req.user.id : null;
  res.render('recipes', {
    title: 'Recipes',
    recipes: getAllRecipes(userId),
    isLoggedIn: !!req.user
  });
});

app.get('/recipes/:id', (req, res) => {
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const userId = req.user ? req.user.id : null;
  const recipe = getRecipe(id, userId);
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

  const deleted = deleteRecipe(id, req.user.id);
  if (!deleted) return res.status(404).send('Recipe not found');

  res.redirect('/recipes');
});

app.get('/edit/:id', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipe(id, req.user.id);
  if (!recipe) return res.status(404).send('Recipe not found');

  res.render('edit', {
    title: `Edit: ${recipe.name}`,
    recipe
  });
});

app.post('/edit/:id', (req, res) => {
  if (!req.user) return res.redirect('/login');

  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const { title, description, instructions } = req.body;

  const updatedRecipe = {
    name: (title || '').trim(),
    description: (description || '').trim(),
    instructions: (instructions || '').trim()
  };

  const success = updateRecipe(id, updatedRecipe, req.user.id);
  if (!success) return res.status(404).send('Recipe not found');

  res.redirect('/recipes');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});