const STORAGE_KEY = "jerkmaster-ingredient-changes";

export async function loadIngredientCatalog() {
    const baseIngredients = await readJson("data/ingredients.json");
    const changes = readChanges();
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

export function saveIngredient(id, ingredient, isExisting) {
    const changes = readChanges();

    if (isExisting && !changes.added[id]) {
        changes.updated[id] = ingredient;
    } else {
        changes.added[id] = ingredient;
        delete changes.updated[id];
    }
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    writeChanges(changes);
}

export function deleteIngredient(id) {
    const changes = readChanges();

    if (changes.added[id]) {
        delete changes.added[id];
        delete changes.updated[id];
    } else if (!changes.deleted.includes(id)) {
        changes.deleted.push(id);
    }
    writeChanges(changes);
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

function readChanges() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return {
            added: saved.added ?? {},
            updated: saved.updated ?? {},
            deleted: Array.isArray(saved.deleted) ? saved.deleted : []
        };
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
