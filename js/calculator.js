const SOY_SAUCE_SALT_RATIO = 0.14;

export const SALINITY_PRESETS = {
    base: null,
    tourist: 0.011,
    beer: 0.0225
};

export function clampMeatWeight(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 1000;
    }

    return Math.max(100, parsed);
}

export function clampMixMultiplier(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 1;
    }

    return Math.max(1, parsed);
}

export function calculateDryMix(recipe, multiplier = 1) {
    const batchMultiplier = clampMixMultiplier(multiplier);

    return Object.entries(recipe.dry_mix).map(([id, amountPerKg]) => ({
        id,
        amount: Number(amountPerKg) * batchMultiplier,
        unit: "g"
    }));
}

export function calculateMarinade(recipe, meatWeightG, ingredients, salinityPreset = "base") {
    const scaleKg = meatWeightG / 1000;
    const marinade = { ...recipe.marinade };
    const targetSaltRatio = SALINITY_PRESETS[salinityPreset];

    if (targetSaltRatio) {
        const soySauceG = Number(marinade.soy_sauce ?? 0) * scaleKg;
        const targetSaltG = meatWeightG * targetSaltRatio;
        const soySaltG = soySauceG * SOY_SAUCE_SALT_RATIO;
        marinade.curing_salt = Math.max(0, targetSaltG - soySaltG) / scaleKg;
        delete marinade.salt;
    }

    const rows = Object.entries(marinade).map(([id, amountPerKg]) => ({
        id,
        amount: Number(amountPerKg) * scaleKg,
        unit: ingredients[id]?.default_unit ?? "g"
    }));

    rows.push({
        id: "prepared_spice_mix",
        amount: getDryMixUsagePerKg(recipe) * scaleKg,
        unit: "g"
    });

    return rows;
}

export function getSalinitySummary(recipe, meatWeightG, salinityPreset = "base") {
    const marinadeRows = calculateMarinade(recipe, meatWeightG, {}, salinityPreset);
    const curingSalt = marinadeRows.find((row) => row.id === "curing_salt" || row.id === "salt")?.amount ?? 0;
    const soySauce = marinadeRows.find((row) => row.id === "soy_sauce")?.amount ?? 0;
    const totalSalt = curingSalt + soySauce * SOY_SAUCE_SALT_RATIO;
    const percent = meatWeightG > 0 ? (totalSalt / meatWeightG) * 100 : 0;

    return {
        curingSalt,
        soySalt: soySauce * SOY_SAUCE_SALT_RATIO,
        totalSalt,
        percent
    };
}

export function getDryMixUsagePerKg(recipe) {
    const configuredUsage = Number(recipe.dry_mix_usage_per_kg);

    if (!Number.isFinite(configuredUsage) || configuredUsage < 0) {
        throw new Error(`Recipe ${recipe.id} requires dry_mix_usage_per_kg`);
    }

    return configuredUsage;
}

export function getDryMixBatchSummary(recipe, multiplier = 1) {
    const batchMultiplier = clampMixMultiplier(multiplier);
    const originalTotal = Object.values(recipe.dry_mix).reduce((sum, value) => sum + Number(value), 0);

    return {
        multiplier: batchMultiplier,
        batchTotal: originalTotal * batchMultiplier,
        usagePerKg: getDryMixUsagePerKg(recipe)
    };
}

export function getSuggestedDryMixMultiplier(recipe) {
    const positiveAmounts = Object.values(recipe.dry_mix)
        .map(Number)
        .filter((amount) => amount > 0);

    if (positiveAmounts.length === 0) {
        return 1;
    }

    const smallestAmount = Math.min(...positiveAmounts);

    return smallestAmount < 1 ? Math.ceil(1 / smallestAmount) : 1;
}

export function formatAmount(value, unit) {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    const unitLabel = {
        g: "г",
        ml: "мл"
    }[unit] ?? unit;

    return `${rounded.toLocaleString("ru-RU")} ${unitLabel}`;
}

export function formatClock(totalSeconds) {
    const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    }

    return [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function getProfileDurationSeconds(profile) {
    return profile.stages.reduce((sum, stage) => sum + stage.minutes * 60, 0);
}

export function getStageAt(profile, elapsedSeconds) {
    let cursor = 0;

    for (let index = 0; index < profile.stages.length; index += 1) {
        const stage = profile.stages[index];
        const duration = stage.minutes * 60;

        if (elapsedSeconds < cursor + duration) {
            return {
                index,
                stage,
                elapsedInStage: elapsedSeconds - cursor,
                remainingInStage: duration - (elapsedSeconds - cursor)
            };
        }

        cursor += duration;
    }

    const lastIndex = Math.max(0, profile.stages.length - 1);

    return {
        index: lastIndex,
        stage: profile.stages[lastIndex],
        elapsedInStage: profile.stages[lastIndex]?.minutes * 60 ?? 0,
        remainingInStage: 0
    };
}
