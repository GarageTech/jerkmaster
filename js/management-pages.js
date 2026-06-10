import { loadIngredientCatalog } from "./ingredient-store.js";
import { deleteProfile, getProfileName, loadProfileCatalog, saveProfile } from "./profile-store.js";
import { deleteRecipe, getRecipeDescription, getRecipeName, loadRecipeCatalog, saveRecipe } from "./recipe-store.js";
import { applyTranslations, getPreferredLocale, loadTranslations, setupLanguageSelectors } from "./translations.js";

const LOCALES = ["en", "ru", "ua"];
let locale;
let t;

init().catch(showError);

async function init() {
    locale = getPreferredLocale();
    ({ t } = await loadTranslations(locale));
    applyTranslations(document, t);
    setupLanguageSelectors();
    if (document.querySelector("#recipe-grid")) await setupRecipes();
    if (document.querySelector("#profile-grid")) await setupProfiles();
}

async function setupRecipes() {
    let [recipes, profiles, ingredients] = await Promise.all([loadRecipeCatalog(), loadProfileCatalog(), loadIngredientCatalog()]);
    const grid = document.querySelector("#recipe-grid");
    const dialog = document.querySelector("#recipe-dialog");
    const form = document.querySelector("#recipe-form");
    const idInput = document.querySelector("#recipe-id");
    const originalInput = document.querySelector("#recipe-original-id");
    const profileInput = document.querySelector("#recipe-profile");
    const dryMixUsageInput = document.querySelector("#recipe-dry-mix-usage");
    const dryMixInput = document.querySelector("#recipe-dry-mix");
    const marinadeInput = document.querySelector("#recipe-marinade");
    document.querySelector("#recipe-language-fields").replaceChildren(...LOCALES.map((language) => languageFields(language, true)));

    const refresh = async () => {
        [recipes, profiles] = await Promise.all([loadRecipeCatalog(), loadProfileCatalog()]);
        render();
    };
    const render = () => {
        grid.replaceChildren(...recipes.map((recipe) => {
            const card = createManagementCard(
                getRecipeName(recipe, locale, t(`recipes.${recipe.id}.name`, recipe.id)),
                getRecipeDescription(recipe, locale, t(`recipes.${recipe.id}.description`, "")),
                `${t("ui.profile", "Profile")}: ${getProfileName(profiles[recipe.profile], locale, t(`profiles.${recipe.profile}`, recipe.profile))}`
            );
            const lists = document.createElement("div");
            lists.className = "management-summary";
            lists.textContent = `${t("ui.spice_mix", "Spice mix")}: ${Object.keys(recipe.dry_mix).length} · ${t("recipes.dry_mix_usage_short", "Mix per 1 kg")}: ${getDryMixUsage(recipe)} g · ${t("ui.marinade", "Marinade")}: ${Object.keys(recipe.marinade).length}`;
            card.querySelector(".management-card-body").append(lists, actionButtons(() => open(recipe), () => remove(recipe)));
            return card;
        }));
    };
    const open = (recipe = null) => {
        form.reset();
        profileInput.replaceChildren(...Object.entries(profiles).map(([id, profile]) => option(id, getProfileName(profile, locale, t(`profiles.${id}`, id)))));
        originalInput.value = recipe?.id ?? "";
        idInput.value = recipe?.id ?? "";
        idInput.readOnly = Boolean(recipe);
        profileInput.value = recipe?.profile ?? Object.keys(profiles)[0] ?? "";
        dryMixUsageInput.value = recipe?.dry_mix_usage_per_kg ?? 15;
        dryMixInput.value = JSON.stringify(recipe?.dry_mix ?? {}, null, 2);
        marinadeInput.value = JSON.stringify(recipe?.marinade ?? {}, null, 2);
        LOCALES.forEach((language) => {
            form.elements[`name_${language}`].value = recipe?.names?.[language] || t(`recipes.${recipe?.id}.name`, "");
            form.elements[`description_${language}`].value = recipe?.descriptions?.[language] || t(`recipes.${recipe?.id}.description`, "");
        });
        document.querySelector("#recipe-dialog-title").textContent = recipe ? t("recipes.edit", "Edit recipe") : t("recipes.add", "Add recipe");
        dialog.showModal();
    };
    const remove = async (recipe) => {
        if (recipes.length === 1) {
            message("danger", t("recipes.keep_one", "At least one recipe is required"));
            return;
        }
        if (!window.confirm(t("recipes.delete_confirm", "Delete {name}?").replace("{name}", getRecipeName(recipe, locale, recipe.id)))) return;
        deleteRecipe(recipe.id);
        await refresh();
        message("success", t("recipes.deleted", "Recipe deleted"));
    };
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const id = idInput.value.trim().toLowerCase();
            if (!originalInput.value && recipes.some((recipe) => recipe.id === id)) throw new Error(t("recipes.id_exists", "A recipe with this ID already exists"));
            const dryMix = parseAmountMap(dryMixInput.value, t("ui.spice_mix", "Spice mix"));
            const marinade = parseAmountMap(marinadeInput.value, t("ui.marinade", "Marinade"));
            const dryMixUsage = Number(dryMixUsageInput.value);
            if (!Number.isFinite(dryMixUsage) || dryMixUsage < 0) throw new Error(t("recipes.invalid_dry_mix_usage", "Spice mix usage must be a positive number"));
            [...Object.keys(dryMix), ...Object.keys(marinade)].forEach((ingredientId) => {
                if (!ingredients[ingredientId]) throw new Error(`${t("recipes.unknown_ingredient", "Unknown ingredient")}: ${ingredientId}`);
            });
            saveRecipe(id, {
                id, profile: profileInput.value, dry_mix: dryMix, dry_mix_usage_per_kg: dryMixUsage, marinade,
                names: values(form, "name"), descriptions: values(form, "description")
            }, Boolean(originalInput.value));
            dialog.close();
            await refresh();
            message("success", t("recipes.saved", "Recipe saved"));
        } catch (error) {
            message("danger", error.message);
        }
    });
    document.querySelector("#add-recipe-btn").addEventListener("click", () => open());
    bindDialogClose(dialog);
    render();
}

async function setupProfiles() {
    let [profiles, recipes] = await Promise.all([loadProfileCatalog(), loadRecipeCatalog()]);
    const grid = document.querySelector("#profile-grid");
    const dialog = document.querySelector("#profile-dialog");
    const form = document.querySelector("#profile-form");
    const idInput = document.querySelector("#profile-id");
    const originalInput = document.querySelector("#profile-original-id");
    const stagesInput = document.querySelector("#profile-stages");
    document.querySelector("#profile-language-fields").replaceChildren(...LOCALES.map((language) => languageFields(language, false)));

    const refresh = async () => {
        [profiles, recipes] = await Promise.all([loadProfileCatalog(), loadRecipeCatalog()]);
        render();
    };
    const render = () => {
        grid.replaceChildren(...Object.entries(profiles).map(([id, profile]) => {
            const totalMinutes = profile.stages.reduce((sum, stage) => sum + Number(stage.minutes), 0);
            const card = createManagementCard(getProfileName(profile, locale, t(`profiles.${id}`, id)), `${profile.stages.length} ${t("profiles.stages_count", "stages")} · ${totalMinutes} ${t("ui.minutes", "min")}`, id);
            card.querySelector(".management-card-body").append(actionButtons(() => open(id, profile), () => remove(id, profile)));
            return card;
        }));
    };
    const open = (id = "", profile = null) => {
        form.reset();
        originalInput.value = id;
        idInput.value = id;
        idInput.readOnly = Boolean(id);
        stagesInput.value = JSON.stringify(profile?.stages ?? [{ temp: 60, minutes: 240, fan: 100 }], null, 2);
        LOCALES.forEach((language) => {
            form.elements[`name_${language}`].value = profile?.names?.[language] || t(`profiles.${id}`, "");
        });
        document.querySelector("#profile-dialog-title").textContent = id ? t("profiles.edit", "Edit profile") : t("profiles.add", "Add profile");
        dialog.showModal();
    };
    const remove = async (id, profile) => {
        if (Object.keys(profiles).length === 1) {
            message("danger", t("profiles.keep_one", "At least one profile is required"));
            return;
        }
        const usedBy = recipes.filter((recipe) => recipe.profile === id);
        if (usedBy.length) {
            message("danger", `${t("profiles.delete_blocked", "Cannot delete: profile is used in recipes")}: ${usedBy.map((recipe) => getRecipeName(recipe, locale, t(`recipes.${recipe.id}.name`, recipe.id))).join(", ")}`);
            return;
        }
        if (!window.confirm(t("profiles.delete_confirm", "Delete {name}?").replace("{name}", getProfileName(profile, locale, id)))) return;
        deleteProfile(id);
        await refresh();
        message("success", t("profiles.deleted", "Profile deleted"));
    };
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const id = idInput.value.trim().toLowerCase();
            if (!originalInput.value && profiles[id]) throw new Error(t("profiles.id_exists", "A profile with this ID already exists"));
            const stages = JSON.parse(stagesInput.value);
            if (!Array.isArray(stages) || !stages.length || stages.some((stage) => !validStage(stage))) throw new Error(t("profiles.invalid_stages", "Every stage requires valid temp, minutes and fan values"));
            saveProfile(id, { stages, names: values(form, "name") }, Boolean(originalInput.value));
            dialog.close();
            await refresh();
            message("success", t("profiles.saved", "Profile saved"));
        } catch (error) {
            message("danger", error.message);
        }
    });
    document.querySelector("#add-profile-btn").addEventListener("click", () => open());
    bindDialogClose(dialog);
    render();
}

function createManagementCard(title, description, eyebrow) {
    const article = document.createElement("article");
    article.className = "card management-card";
    article.innerHTML = `<div class="management-card-body"><div class="management-eyebrow"></div><h2></h2><p></p></div>`;
    article.querySelector(".management-eyebrow").textContent = eyebrow;
    article.querySelector("h2").textContent = title;
    article.querySelector("p").textContent = description;
    return article;
}

function actionButtons(edit, remove) {
    const actions = document.createElement("div");
    actions.className = "ingredient-card-actions";
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");
    editButton.className = "btn btn-sm btn-secondary";
    editButton.innerHTML = `<i class="bi bi-pencil"></i> ${t("ui.edit", "Edit")}`;
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.innerHTML = `<i class="bi bi-trash"></i> ${t("ui.delete", "Delete")}`;
    editButton.addEventListener("click", edit);
    deleteButton.addEventListener("click", remove);
    actions.append(editButton, deleteButton);
    return actions;
}

function languageFields(language, withDescription) {
    const section = document.createElement("section");
    section.className = "card p-3 mb-2";
    section.innerHTML = `<h3 class="h6">${language.toUpperCase()}</h3><label class="form-label">${t("encyclopedia.name", "Name")}</label><input name="name_${language}" class="form-control" required>${withDescription ? `<label class="form-label mt-2">${t("encyclopedia.description", "Description")}</label><textarea name="description_${language}" class="form-control" rows="2" required></textarea>` : ""}`;
    return section;
}

function values(form, prefix) {
    return Object.fromEntries(LOCALES.map((language) => [language, form.elements[`${prefix}_${language}`].value.trim()]));
}

function parseAmountMap(text, label) {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(`${label}: ${t("management.invalid_json", "expected a JSON object")}`);
    if (Object.values(value).some((amount) => !Number.isFinite(Number(amount)) || Number(amount) < 0)) throw new Error(`${label}: ${t("management.invalid_amounts", "amounts must be positive numbers")}`);
    return value;
}

function validStage(stage) {
    return Number.isFinite(Number(stage.temp)) && Number(stage.temp) >= 20 && Number(stage.temp) <= 85
        && Number.isFinite(Number(stage.minutes)) && Number(stage.minutes) > 0
        && Number.isFinite(Number(stage.fan)) && Number(stage.fan) >= 0 && Number(stage.fan) <= 100;
}

function getDryMixUsage(recipe) {
    return recipe.dry_mix_usage_per_kg ?? t("recipes.usage_not_set", "not set");
}

function option(value, text) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = text;
    return node;
}

function bindDialogClose(dialog) {
    dialog.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => dialog.close()));
}

function message(level, text) {
    const container = document.querySelector("#management-message");
    container.innerHTML = `<div class="alert alert-${level}"></div>`;
    container.firstElementChild.textContent = text;
}

function showError(error) {
    console.error(error);
    message("danger", error.message);
}
