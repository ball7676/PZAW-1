import express from 'express';
import path from 'path';
import {
  getAllRecipes,
  getRecipe,
  addRecipe,
  deleteRecipe
} from './models/recipes.js';

const app = express();
const port = 8000;

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Strona główna - Projekt03',
    error: !!req.query.error
  });
});

app.get('/add', (req, res) => {
  res.render('add', { title: 'Add Recipe' });
});

app.post('/add', (req, res) => {
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

  const created = addRecipe(newRecipe);
  if (!created) return res.redirect('/?error=1');

  res.redirect('/recipes');
});

app.get('/recipes', (req, res) => {
  res.render('recipes', {
    title: 'Recipes',
    recipes: getAllRecipes()
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
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const deleted = deleteRecipe(id);
  if (!deleted) return res.status(404).send('Recipe not found');

  res.redirect('/recipes');
});

app.get('/edit/:id', (req, res) => {
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const recipe = getRecipe(id);
  if (!recipe) return res.status(404).send('Recipe not found');

  res.render('edit', {
    title: `Edit: ${recipe.name}`,
    recipe
  });
});

app.post('/edit/:id', (req, res) => {
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch {}

  const existing = getRecipe(id);
  if (!existing) return res.status(404).send('Recipe not found');

  const { title, ingredients, instructions } = req.body;

  const updatedRecipe = {
    name: (title || existing.name).trim(),
    description: (ingredients || existing.description)
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .join(', '),
    instructions: (instructions || existing.instructions).trim()
  };

  deleteRecipe(id);
  addRecipe(updatedRecipe);

  res.redirect('/recipes');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});