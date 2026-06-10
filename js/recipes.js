import { loadIngredientCatalog } from "./ingredient-store.js";
import { loadProfileCatalog } from "./profile-store.js";
import { loadRecipeCatalog } from "./recipe-store.js";

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(`Cannot load ${path}`);
    }

    return response.json();
}

export async function loadRecipeData() {
    const [profiles, ingredients, categories, recipes] = await Promise.all([
        loadProfileCatalog(),
        loadIngredientCatalog(),
        readJson("data/categories.json"),
        loadRecipeCatalog()
    ]);

    return {
        profiles,
        ingredients,
        categories,
        recipes
    };
}
