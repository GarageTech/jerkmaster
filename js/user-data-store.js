const API_ROOT = "/api/user-data";

export async function readUserChanges(name) {
    if (window.location.protocol === "file:") {
        return normalizeChanges();
    }

    const response = await fetch(`${API_ROOT}/${name}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load user ${name}: HTTP ${response.status}`);
    return normalizeChanges(await response.json());
}

export async function writeUserChanges(name, changes) {
    const response = await fetch(`${API_ROOT}/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeChanges(changes))
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Cannot save user ${name}: HTTP ${response.status}`);
    }
}

export function normalizeChanges(changes = {}) {
    return {
        added: isObject(changes.added) ? changes.added : {},
        updated: isObject(changes.updated) ? changes.updated : {},
        deleted: Array.isArray(changes.deleted) ? [...new Set(changes.deleted.filter((id) => typeof id === "string"))] : []
    };
}

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
