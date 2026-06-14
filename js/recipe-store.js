import { readUserChanges, writeUserChanges } from "./user-data-store.js";

const BASE_IDS = ["pork_classic", "pork_new", "pork_black_garlic", "beef", "turkey", "duck"];

export async function loadRecipeCatalog() {
    const baseRecipes = await Promise.all(BASE_IDS.map((id) => readJson(`recipes/${id}.json`)));
    const changes = await readUserChanges("recipes");
    const recipes = {};

    baseRecipes.forEach((recipe) => {
        if (!changes.deleted.includes(recipe.id)) recipes[recipe.id] = { ...recipe, ...changes.updated[recipe.id] };
    });
    Object.entries(changes.added).forEach(([id, recipe]) => {
        recipes[id] = { ...recipe, id };
    });
    return Object.values(recipes);
}

export async function saveRecipe(id, recipe, isExisting) {
    const changes = await readUserChanges("recipes");
    if (isExisting && !changes.added[id]) changes.updated[id] = recipe;
    else changes.added[id] = recipe;
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    await writeUserChanges("recipes", changes);
}

export async function deleteRecipe(id) {
    const changes = await readUserChanges("recipes");
    if (changes.added[id]) delete changes.added[id];
    else if (!changes.deleted.includes(id)) changes.deleted.push(id);
    delete changes.updated[id];
    await writeUserChanges("recipes", changes);
}

export function getRecipeName(recipe, locale, fallback) {
    return recipe?.names?.[locale] || recipe?.names?.en || fallback;
}

export function getRecipeDescription(recipe, locale, fallback = "") {
    return recipe?.descriptions?.[locale] || fallback || recipe?.descriptions?.en || "";
}

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}
