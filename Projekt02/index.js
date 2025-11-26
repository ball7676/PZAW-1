import express from 'express';
import path from 'path';
import { getAllRecipes, getRecipe, addRecipe } from './models/recipes.js';

const app = express();
const port = 8000;

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.static(path.join(process.cwd(), 'public')));

app.use(express.urlencoded({ extended: false }));

app.get('/add', (req, res) => {
  res.render('add', { title: 'Add recipe' });
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

  if (!created) {
    return res.redirect('/?error=1');
  }

  res.redirect('/recipes/');
});

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Strona główna - Projekt02',
    error: !!req.query.error
  });
});

app.get('/recipes', (req, res) => {
  res.render('recipes', { 
    title: "Recipes",
    recipes: getAllRecipes()
  });
});

app.post('/recipes', (req, res) => {
  const { name, description, instructions } = req.body;
  const created = addRecipe({ name, description, instructions });
  if (!created) {
    return res.redirect('/?error=1');
  }
  return res.redirect('/recipes/' + encodeURIComponent(created.name));
});

app.get('/recipes/:id', (req, res) => {
  let id = req.params.id;
  try { id = decodeURIComponent(id); } catch (e) {}

  const found = getRecipe(id);
  if (!found) {
    return res.status(404).send('Recipe not found');
  }

  res.render('recipe', {
    title: found.name,
    recipe: found
  });
});

app.listen(port, () => {
   console.log(`Server running on http://localhost:${port}`);
});