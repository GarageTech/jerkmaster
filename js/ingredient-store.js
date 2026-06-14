import { readUserChanges, writeUserChanges } from "./user-data-store.js";

export async function loadIngredientCatalog() {
    const baseIngredients = await readJson("data/ingredients.json");
    const changes = await readUserChanges("ingredients");
    const ingredients = {};

    Object.entries(baseIngredients).forEach(([id, ingredient]) => {
        if (!changes.deleted.includes(id)) {
            ingredients[id] = mergeIngredient(id, ingredient, changes.updated[id]);
        }
    });
    Object.entries(changes.added).forEach(([id, ingredient]) => {
        ingredients[id] = mergeIngredient(id, ingredient, changes.updated[id]);
    });

    return ingredients;
}

export async function saveIngredient(id, ingredient, isExisting) {
    const changes = await readUserChanges("ingredients");

    if (isExisting && !changes.added[id]) {
        changes.updated[id] = ingredient;
    } else {
        changes.added[id] = ingredient;
        delete changes.updated[id];
    }
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    await writeUserChanges("ingredients", changes);
}

export async function deleteIngredient(id) {
    const changes = await readUserChanges("ingredients");

    if (changes.added[id]) {
        delete changes.added[id];
        delete changes.updated[id];
    } else if (!changes.deleted.includes(id)) {
        changes.deleted.push(id);
    }
    await writeUserChanges("ingredients", changes);
}

export function getIngredientName(ingredient, locale, fallback) {
    return ingredient?.names?.[locale] || ingredient?.names?.en || fallback;
}

export function getIngredientDescription(ingredient, locale, fallback = "") {
    return ingredient?.descriptions?.[locale] || fallback || ingredient?.descriptions?.en || "";
}

function mergeIngredient(id, base, override = {}) {
    return {
        ...base,
        ...override,
        id,
        names: { ...(base.names ?? {}), ...(override.names ?? {}) },
        descriptions: { ...(base.descriptions ?? {}), ...(override.descriptions ?? {}) }
    };
}

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}
