export async function loadTranslations(locale = "ru") {
    const baseResponse = await fetch("translations/en.json", { cache: "no-store" });
    const localeResponse = locale === "en" ? null : await fetch(`translations/${locale}.json`, { cache: "no-store" });
    const dictionary = {
        ...(baseResponse.ok ? await baseResponse.json() : {}),
        ...(localeResponse?.ok ? await localeResponse.json() : {})
    };

    return {
        dictionary,
        t(key, fallback = key) {
            return dictionary[key] ?? fallback;
        }
    };
}

export function getPreferredLocale() {
    const params = new URLSearchParams(window.location.search);
    const locale = params.get("lang") || localStorage.getItem("jerkmaster-language") || "ru";
    return ["en", "ru", "ua"].includes(locale) ? locale : "ru";
}

export function setupLanguageSelectors() {
    const locale = getPreferredLocale();
    const currentParams = new URLSearchParams(window.location.search);

    document.documentElement.lang = locale;
    document.querySelectorAll(".page-nav a").forEach((link) => {
        const url = new URL(link.href, window.location.href);
        ["lang", "demo"].forEach((key) => {
            if (currentParams.has(key)) {
                url.searchParams.set(key, currentParams.get(key));
            }
        });
        link.href = url.toString();
    });

    document.querySelectorAll("[data-language-select]").forEach((select) => {
        select.value = locale;
        select.addEventListener("change", () => {
            localStorage.setItem("jerkmaster-language", select.value);
            const url = new URL(window.location.href);
            url.searchParams.set("lang", select.value);
            window.location.href = url.toString();
        });
    });
}

export function applyTranslations(root, t) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
        node.textContent = t(node.dataset.i18n, node.textContent.trim());
    });
}
