export function resolveActiveDrying(telemetry, data) {
    if (!telemetry.connected || telemetry.dryerRunning !== true) {
        return null;
    }

    const profileId = String(telemetry.dryerProfile || "").toLowerCase();
    const mode = profileId === "custom" ? "custom" : "profile";
    const reportedRecipe = String(telemetry.dryerRecipe || "");
    const matchingRecipe = data.recipes.find((recipe) => recipe.id === reportedRecipe)
        ?? data.recipes.find((recipe) => recipe.profile === profileId)
        ?? data.recipes[0];
    const elapsedSeconds = Number.isFinite(telemetry.dryerElapsedSeconds)
        ? telemetry.dryerElapsedSeconds
        : getElapsedAtStageStart(data.profiles[profileId], telemetry.dryerStage);

    return {
        elapsedSeconds,
        mode,
        profileId,
        recipeId: matchingRecipe.id,
        customTemp: telemetry.dryerCustomTemp || 60,
        customMinutes: telemetry.dryerCustomMinutes || 240
    };
}

export function getDryingProcessKey(activeDrying) {
    return [
        activeDrying.mode,
        activeDrying.profileId,
        activeDrying.recipeId,
        activeDrying.customTemp,
        activeDrying.customMinutes
    ].join(":");
}

function getElapsedAtStageStart(profile, stageNumber) {
    const stages = profile?.stages ?? [];
    return stages.slice(0, Math.max(0, Number(stageNumber) - 1))
        .reduce((seconds, stage) => seconds + Number(stage.minutes) * 60, 0);
}
