const STORAGE_KEY = "jerkmaster-recipe-changes";
const BASE_IDS = ["pork_classic", "pork_new", "pork_black_garlic", "beef", "turkey", "duck"];

export async function loadRecipeCatalog() {
    const baseRecipes = await Promise.all(BASE_IDS.map((id) => readJson(`recipes/${id}.json`)));
    const changes = readChanges();
    const recipes = {};

    baseRecipes.forEach((recipe) => {
        if (!changes.deleted.includes(recipe.id)) recipes[recipe.id] = { ...recipe, ...changes.updated[recipe.id] };
    });
    Object.entries(changes.added).forEach(([id, recipe]) => {
        recipes[id] = { ...recipe, id };
    });
    return Object.values(recipes);
}

export function saveRecipe(id, recipe, isExisting) {
    const changes = readChanges();
    if (isExisting && !changes.added[id]) changes.updated[id] = recipe;
    else changes.added[id] = recipe;
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    writeChanges(changes);
}

export function deleteRecipe(id) {
    const changes = readChanges();
    if (changes.added[id]) delete changes.added[id];
    else if (!changes.deleted.includes(id)) changes.deleted.push(id);
    delete changes.updated[id];
    writeChanges(changes);
}

export function getRecipeName(recipe, locale, fallback) {
    return recipe?.names?.[locale] || recipe?.names?.en || fallback;
}

export function getRecipeDescription(recipe, locale, fallback = "") {
    return recipe?.descriptions?.[locale] || fallback || recipe?.descriptions?.en || "";
}

function readChanges() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return { added: saved.added ?? {}, updated: saved.updated ?? {}, deleted: saved.deleted ?? [] };
    } catch {
        return { added: {}, updated: {}, deleted: [] };
    }
}

function writeChanges(changes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
}

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}
