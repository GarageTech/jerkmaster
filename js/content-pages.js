import { deleteIngredient, getIngredientDescription, getIngredientName, loadIngredientCatalog, saveIngredient } from "./ingredient-store.js";
import { loadRecipeCatalog } from "./recipe-store.js";
import { applyTranslations, getPreferredLocale, loadTranslations, setupLanguageSelectors } from "./translations.js";

const LOCALES = ["en", "ru", "ua"];

init().catch(showPageError);

async function init() {
    const locale = getPreferredLocale();
    const { t } = await loadTranslations(locale);

    applyTranslations(document, t);
    setupLanguageSelectors();

    if (document.querySelector("#ingredient-grid")) {
        await setupIngredientEncyclopedia(locale, t);
    }
}

async function setupIngredientEncyclopedia(locale, t) {
    const [categories, recipes] = await Promise.all([
        readJson("data/categories.json"),
        loadRecipeCatalog()
    ]);
    let ingredients = await loadIngredientCatalog();
    const grid = document.querySelector("#ingredient-grid");
    const filter = document.querySelector("#ingredient-filter");
    const dialog = document.querySelector("#ingredient-dialog");
    const form = document.querySelector("#ingredient-form");
    const idInput = document.querySelector("#ingredient-id");
    const originalIdInput = document.querySelector("#ingredient-original-id");
    const categoryInput = document.querySelector("#ingredient-category");
    const unitInput = document.querySelector("#ingredient-unit");
    const message = document.querySelector("#ingredient-message");

    Object.entries(categories).forEach(([id, category]) => {
        filter.append(createOption(id, `${category.icon} ${t(`categories.${id}`, titleize(id))}`));
        categoryInput.append(createOption(id, t(`categories.${id}`, titleize(id))));
    });
    document.querySelector("#ingredient-language-fields").replaceChildren(...LOCALES.map((language) => createLanguageFields(language, t)));

    const refresh = async () => {
        ingredients = await loadIngredientCatalog();
        render();
    };

    const render = () => {
        const selected = filter.value;
        grid.replaceChildren(...Object.entries(ingredients)
            .filter(([, ingredient]) => !selected || ingredient.category === selected)
            .map(([id, ingredient]) => createIngredientCard(id, ingredient)));
    };

    const createIngredientCard = (id, ingredient) => {
        const category = categories[ingredient.category] ?? {};
        const article = document.createElement("article");
        const content = document.createElement("div");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");

        article.className = "card ingredient-card";
        article.style.setProperty("--category-color", category.color ?? "#6c757d");
        content.className = "ingredient-card-content";
        content.innerHTML = `
            <div class="ingredient-category">${t(`categories.${ingredient.category}`, titleize(ingredient.category))}</div>
            <h2></h2><p></p><span class="badge text-bg-dark"></span>`;
        content.querySelector("h2").textContent = getIngredientName(ingredient, locale, t(`ingredients.${id}`, titleize(id)));
        content.querySelector("p").textContent = getIngredientDescription(ingredient, locale, t(`ingredient_descriptions.${id}`, ""));
        content.querySelector(".badge").textContent = ingredient.default_unit;

        actions.className = "ingredient-card-actions";
        editButton.className = "btn btn-sm btn-outline-info";
        editButton.innerHTML = `<i class="bi bi-pencil"></i> ${t("ui.edit", "Edit")}`;
        editButton.addEventListener("click", () => openEditor(id, ingredient));
        deleteButton.className = "btn btn-sm btn-outline-danger";
        deleteButton.innerHTML = `<i class="bi bi-trash"></i> ${t("ui.delete", "Delete")}`;
        deleteButton.addEventListener("click", () => removeIngredient(id, ingredient));
        actions.append(editButton, deleteButton);
        content.append(actions);
        article.innerHTML = `<div class="card-body"><div class="ingredient-card-icon">${category.icon ?? "•"}</div></div>`;
        article.querySelector(".card-body").append(content);
        return article;
    };

    const openEditor = (id = "", ingredient = {}) => {
        form.reset();
        originalIdInput.value = id;
        idInput.value = id;
        idInput.readOnly = Boolean(id);
        categoryInput.value = ingredient.category ?? "spice";
        unitInput.value = ingredient.default_unit ?? "g";
        LOCALES.forEach((language) => {
            form.elements[`name_${language}`].value = ingredient.names?.[language] || t(`ingredients.${id}`, language === "en" ? titleize(id) : "");
            form.elements[`description_${language}`].value = ingredient.descriptions?.[language] || t(`ingredient_descriptions.${id}`, "");
        });
        document.querySelector("#ingredient-dialog-title").textContent = id ? t("encyclopedia.edit", "Edit ingredient") : t("encyclopedia.add", "Add ingredient");
        dialog.showModal();
    };

    const removeIngredient = async (id, ingredient) => {
        const usedBy = recipes.filter((recipe) => id in recipe.dry_mix || id in recipe.marinade);
        if (usedBy.length) {
            const names = usedBy.map((recipe) => t(`recipes.${recipe.id}.name`, recipe.id)).join(", ");
            showMessage("danger", `${t("encyclopedia.delete_blocked", "Cannot delete: ingredient is used in recipes")}: ${names}`);
            return;
        }
        const name = getIngredientName(ingredient, locale, titleize(id));
        if (!window.confirm(t("encyclopedia.delete_confirm", "Delete {name}?").replace("{name}", name))) return;
        try {
            await deleteIngredient(id);
            await refresh();
            showMessage("success", t("encyclopedia.deleted", "Ingredient deleted"));
        } catch (error) {
            showMessage("danger", error.message);
        }
    };

    const showMessage = (level, text) => {
        message.innerHTML = "";
        const alert = document.createElement("div");
        alert.className = `alert alert-${level}`;
        alert.textContent = text;
        message.append(alert);
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const id = idInput.value.trim().toLowerCase();
            const originalId = originalIdInput.value;
            if (!originalId && ingredients[id]) {
                showMessage("danger", t("encyclopedia.id_exists", "An ingredient with this ID already exists"));
                return;
            }
            const ingredient = {
                category: categoryInput.value,
                default_unit: unitInput.value.trim(),
                names: Object.fromEntries(LOCALES.map((language) => [language, form.elements[`name_${language}`].value.trim()])),
                descriptions: Object.fromEntries(LOCALES.map((language) => [language, form.elements[`description_${language}`].value.trim()]))
            };
            await saveIngredient(id, ingredient, Boolean(originalId));
            dialog.close();
            await refresh();
            showMessage("success", t("encyclopedia.saved", "Ingredient saved"));
        } catch (error) {
            showMessage("danger", error.message);
        }
    });
    filter.addEventListener("change", render);
    document.querySelector("#add-ingredient-btn").addEventListener("click", () => openEditor());
    document.querySelector("#ingredient-dialog-close").addEventListener("click", () => dialog.close());
    document.querySelector("#ingredient-cancel-btn").addEventListener("click", () => dialog.close());
    render();
}

function createLanguageFields(locale, t) {
    const section = document.createElement("section");
    section.className = "card p-3 mb-2";
    section.innerHTML = `
        <h3 class="h6">${locale.toUpperCase()}</h3>
        <label class="form-label">${t("encyclopedia.name", "Name")}</label>
        <input name="name_${locale}" class="form-control mb-2" required>
        <label class="form-label">${t("encyclopedia.description", "Description")}</label>
        <textarea name="description_${locale}" class="form-control" rows="2" required></textarea>`;
    return section;
}

function createOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    return option;
}

async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
}

function titleize(value = "") {
    return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function showPageError(error) {
    console.error(error);
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = `Page initialization failed: ${error.message}`;
    (document.querySelector("#ingredient-grid") ?? document.querySelector("main") ?? document.body).prepend(alert);
}
