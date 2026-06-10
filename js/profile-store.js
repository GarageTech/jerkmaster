const STORAGE_KEY = "jerkmaster-profile-changes";

export async function loadProfileCatalog() {
    const baseProfiles = await readJson("data/profiles.json");
    const changes = readChanges();
    const profiles = {};

    Object.entries(baseProfiles).forEach(([id, profile]) => {
        if (!changes.deleted.includes(id)) profiles[id] = { ...profile, ...changes.updated[id], id };
    });
    Object.entries(changes.added).forEach(([id, profile]) => {
        profiles[id] = { ...profile, id };
    });
    return profiles;
}

export function saveProfile(id, profile, isExisting) {
    const changes = readChanges();
    if (isExisting && !changes.added[id]) changes.updated[id] = profile;
    else changes.added[id] = profile;
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    writeChanges(changes);
}

export function deleteProfile(id) {
    const changes = readChanges();
    if (changes.added[id]) delete changes.added[id];
    else if (!changes.deleted.includes(id)) changes.deleted.push(id);
    delete changes.updated[id];
    writeChanges(changes);
}

export function getProfileName(profile, locale, fallback) {
    return profile?.names?.[locale] || profile?.names?.en || fallback;
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
