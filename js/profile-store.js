import { readUserChanges, writeUserChanges } from "./user-data-store.js";

export async function loadProfileCatalog() {
    const baseProfiles = await readJson("data/profiles.json");
    const changes = await readUserChanges("profiles");
    const profiles = {};

    Object.entries(baseProfiles).forEach(([id, profile]) => {
        if (!changes.deleted.includes(id)) profiles[id] = { ...profile, ...changes.updated[id], id };
    });
    Object.entries(changes.added).forEach(([id, profile]) => {
        profiles[id] = { ...profile, id };
    });
    return profiles;
}

export async function saveProfile(id, profile, isExisting) {
    const changes = await readUserChanges("profiles");
    if (isExisting && !changes.added[id]) changes.updated[id] = profile;
    else changes.added[id] = profile;
    changes.deleted = changes.deleted.filter((deletedId) => deletedId !== id);
    await writeUserChanges("profiles", changes);
}

export async function deleteProfile(id) {
    const changes = await readUserChanges("profiles");
    if (changes.added[id]) delete changes.added[id];
    else if (!changes.deleted.includes(id)) changes.deleted.push(id);
    delete changes.updated[id];
    await writeUserChanges("profiles", changes);
}

export function getProfileName(profile, locale, fallback) {
    return profile?.names?.[locale] || profile?.names?.en || fallback;
}

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}
