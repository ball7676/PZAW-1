import fs from 'fs';
import path from 'path';

const recipes = [
  {
    name: "Spaghetti Carbonara",
    description: "Klasyczne włoskie danie z makaronu spaghetti z sosem na bazie jajek, parmezanu, boczku i pieprzu.",
    instructions: "Ugotuj spaghetti al dente. Na patelni podsmaż boczek, aż będzie chrupiący. W misce wymieszaj jajka z tartym parmezanem i pieprzem. Gorący makaron wymieszaj z boczkiem i zdejmij z ognia. Dodaj mieszankę jajeczną i dokładnie wymieszaj, aby powstał kremowy sos."
  },
  {
    name: "Chicken Curry",
    description: "Aromatyczne curry z kurczaka w kremowym sosie kokosowym z przyprawami indyjskimi.",
    instructions: "Podsmaż cebulę, czosnek i imbir na oleju. Dodaj przyprawy curry i kurkumę. Wrzuć kawałki kurczaka i obsmaż ze wszystkich stron. Wlej mleko kokosowe i duś pod przykryciem ok. 20 minut, aż sos zgęstnieje."
  },
  {
    name: "Beef Stroganoff",
    description: "Rosyjskie danie z delikatnej wołowiny w sosie śmietanowo-grzybowym.",
    instructions: "Pokrój wołowinę w cienkie paski i podsmaż na patelni. Dodaj cebulę i pieczarki, smaż do zarumienienia. Wlej bulion, dodaj musztardę i śmietanę, a następnie gotuj na małym ogniu przez kilka minut, aż sos się zagęści."
  },
  {
    name: "Pad Thai",
    description: "Tradycyjne tajskie danie z makaronu ryżowego smażonego z jajkiem, tofu, krewetkami i sosem tamaryndowym.",
    instructions: "Namocz makaron ryżowy w ciepłej wodzie. Na patelni podsmaż czosnek, tofu i krewetki. Dodaj makaron, wbij jajko i mieszaj. Wlej sos tamaryndowy, sos rybny i odrobinę cukru. Podawaj z orzeszkami ziemnymi i limonką."
  },
  {
    name: "Vegetable Stir Fry",
    description: "Kolorowy stir-fry z warzyw smażonych w sosie sojowym i sezamowym.",
    instructions: "Pokrój warzywa (paprykę, brokuły, marchewkę, cukinię). Rozgrzej wok i smaż warzywa na dużym ogniu przez kilka minut. Dodaj sos sojowy, czosnek i odrobinę oleju sezamowego. Podawaj z ryżem lub makaronem."
  },
  {
    name: "Fish Tacos",
    description: "Meksykańskie tacos z chrupiącą rybą, świeżymi warzywami i kremowym sosem.",
    instructions: "Pokrój filety rybne, obtocz w przyprawionej panierce i usmaż. W podgrzanych tortillach ułóż rybę, dodaj kapustę, pomidora i sos jogurtowo-limonkowy. Zwiń tacos i podawaj od razu."
  },
  {
    name: "Lentil Soup",
    description: "Pożywna zupa z czerwonej soczewicy z warzywami i przyprawami.",
    instructions: "Podsmaż cebulę, czosnek i marchewkę. Dodaj soczewicę, pomidory z puszki i bulion warzywny. Gotuj ok. 25 minut, aż soczewica zmięknie. Dopraw kuminem, papryką i solą."
  },
  {
    name: "Caesar Salad",
    description: "Klasyczna sałatka z chrupiącą sałatą rzymską, grzankami, parmezanem i sosem Cezar.",
    instructions: "Przygotuj sos z majonezu, musztardy, czosnku, anchois, cytryny i parmezanu. Pokrój sałatę, dodaj grzanki i starty ser. Polej sosem i wymieszaj tuż przed podaniem."
  }
];


const DB_DIR = path.join(process.cwd(), 'database', 'data');
const DB_FILE = path.join(DB_DIR, 'recipes.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function loadRecipes() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(recipes, null, 2));
    return recipes;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const data = JSON.parse(raw);

  if (Array.isArray(data) && data.length > 0) {
    return data;
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(recipes, null, 2));
  return recipes;
}

function saveRecipes(data) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function getAllRecipes() {
  return loadRecipes().map(r => ({
    id: r.name,
    name: r.name,
    description: r.description
  }));
}

export function getRecipe(idOrName) {
  const target = String(idOrName).toLowerCase();
  return loadRecipes().find(
    r => r.name.toLowerCase() === target
  ) || null;
}

export function addRecipe(payload) {
  const data = loadRecipes();
  const name = payload?.name?.trim();
  if (!name || !payload.description) return null;

  if (data.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    return null;
  }

  const newRecipe = {
    name,
    description: payload.description,
    instructions: payload.instructions || ''
  };

  data.push(newRecipe);
  saveRecipes(data);
  return newRecipe;
}

export function deleteRecipe(idOrName) {
  const data = loadRecipes();
  const target = String(idOrName).toLowerCase();

  const index = data.findIndex(
    r => r.name.toLowerCase() === target
  );
  if (index === -1) return false;

  data.splice(index, 1);
  saveRecipes(data);
  return true;
}

export default {
  getAllRecipes,
  getRecipe,
  addRecipe,
  deleteRecipe,
  loadRecipes
};
