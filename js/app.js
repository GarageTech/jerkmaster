import { calculateDryMix, calculateMarinade, clampMeatWeight, clampMixMultiplier, formatAmount, formatClock, getDryMixBatchSummary, getProfileDurationSeconds, getSalinitySummary, getSuggestedDryMixMultiplier } from "./calculator.js";
import { DryerController } from "./dryer.js";
import { getDryingProcessKey, resolveActiveDrying } from "./drying-state.js";
import { createMoonrakerClient } from "./moonraker.js";
import { loadRecipeData } from "./recipes.js";
import { getIngredientName } from "./ingredient-store.js";
import { getProfileName } from "./profile-store.js";
import { getRecipeName } from "./recipe-store.js";
import { applyTranslations, getPreferredLocale, loadTranslations, setupLanguageSelectors } from "./translations.js";

const DIAGNOSTIC_LIMITS = {
    electronicsWarning: 50,
    electronicsCritical: 60,
    rpiCritical: 75,
    ssrTimeoutMs: 180000,
    minimumHeatingGain: 2
};

const CHART_TIME_RANGES_MINUTES = [5, 15, 30, 60];
const CHART_MAX_HISTORY_MS = Math.max(...CHART_TIME_RANGES_MINUTES) * 60 * 1000;

const els = {
    recipeSelect: document.querySelector("#recipe-select"),
    meatWeight: document.querySelector("#meat-weight"),
    mixMultiplier: document.querySelector("#mix-multiplier"),
    mixInfo: document.querySelector("#mix-info"),
    salinitySelect: document.querySelector("#salinity-select"),
    salinityInfo: document.querySelector("#salinity-info"),
    salinityPercent: document.querySelector("#salinity-percent"),
    dryMixTable: document.querySelector("#dry-mix-table"),
    marinadeTable: document.querySelector("#marinade-table"),
    profileTable: document.querySelector("#profile-table"),
    currentTemp: document.querySelector("#current-temp"),
    targetTemp: document.querySelector("#target-temp"),
    currentStage: document.querySelector("#current-stage"),
    stageName: document.querySelector("#stage-name"),
    remainingTime: document.querySelector("#remaining-time"),
    totalTime: document.querySelector("#total-time"),
    progressBar: document.querySelector("#progress-bar"),
    dryerStatus: document.querySelector("#dryer-status"),
    connectionStatus: document.querySelector("#connection-status"),
    activeProfile: document.querySelector("#active-profile"),
    alertContainer: document.querySelector("#alert-container"),
    tempChart: document.querySelector("#temp-chart"),
    chartChamberTemp: document.querySelector("#chart-chamber-temp"),
    chartTargetTemp: document.querySelector("#chart-target-temp"),
    chartCpuTemp: document.querySelector("#chart-cpu-temp"),
    chartBayTemp: document.querySelector("#chart-bay-temp"),
    chartTimeShorter: document.querySelector("#chart-time-shorter"),
    chartTimeLonger: document.querySelector("#chart-time-longer"),
    chartTimeRange: document.querySelector("#chart-time-range"),
    cpuTemp: document.querySelector("#cpu-temp"),
    electronicsTemp: document.querySelector("#electronics-temp"),
    heaterState: document.querySelector("#heater-state"),
    heaterSsrState: document.querySelector("#heater-ssr-state"),
    fanSsrState: document.querySelector("#fan-ssr-state"),
    fanToggleBtn: document.querySelector("#fan-toggle-btn"),
    fanToggleLabel: document.querySelector("#fan-toggle-label"),
    operationMode: document.querySelector("#operation-mode"),
    customControls: document.querySelectorAll(".custom-control"),
    customTemperature: document.querySelector("#custom-temperature"),
    customDuration: document.querySelector("#custom-duration"),
    startBtn: document.querySelector("#start-btn"),
    stopBtn: document.querySelector("#stop-btn"),
    chamberLightBtn: document.querySelector("#chamber-light-btn"),
    chamberLightLabel: document.querySelector("#chamber-light-label"),
    emergencyStopBtn: document.querySelector("#emergency-stop-btn")
};

const app = {
    data: null,
    t: (key, fallback) => fallback ?? key,
    selectedRecipe: null,
    dryer: null,
    moonraker: createMoonrakerClient(),
    tempChart: null,
    locale: getPreferredLocale(),
    heaterWatch: null,
    activeProcessKey: null,
    activeProfileId: null,
    chartTimeRangeIndex: 1
};

init().catch((error) => {
    console.error(error);
    document.body.insertAdjacentHTML(
        "afterbegin",
        `<div class="alert alert-danger m-3">Failed to load JerkMaster data. Verify the Raspberry Pi service.</div>`
    );
});

async function init() {
    const [{ t }, data] = await Promise.all([
        loadTranslations(getPreferredLocale()),
        loadRecipeData()
    ]);

    app.t = t;
    app.data = data;
    localStorage.removeItem("jerkmaster-active-drying");
    await app.moonraker.refreshTelemetry?.();
    const activeDrying = resolveActiveDrying(app.moonraker.getTelemetry(), app.data);
    app.selectedRecipe = data.recipes.find((recipe) => recipe.id === activeDrying?.recipeId) ?? data.recipes[0];
    app.activeProfileId = activeDrying?.profileId ?? null;
    restoreDryingControls(activeDrying);
    app.dryer = new DryerController(getCurrentProfile());

    applyTranslations(document, t);
    setupLanguageSelectors();
    renderRecipeOptions();
    renderRecipe();
    bindEvents();
    initTemperatureChart();

    app.dryer.addEventListener("change", (event) => {
        renderStatus(event.detail);
    });
    if (activeDrying) {
        app.activeProcessKey = getDryingProcessKey(activeDrying);
        app.dryer.start(activeDrying.elapsedSeconds);
    }
    renderStatus(app.dryer.getSnapshot());
    window.setInterval(renderTelemetry, 1500);
    renderTelemetry();
}

function bindEvents() {
    document.querySelectorAll("[data-collapsible-card] .collapse-toggle").forEach((button) => {
        button.addEventListener("click", () => {
            const card = button.closest("[data-collapsible-card]");
            const collapsed = card.classList.toggle("is-collapsed");
            button.setAttribute("aria-expanded", String(!collapsed));

            if (!collapsed && card.querySelector("#temp-chart")) {
                window.setTimeout(() => app.tempChart?.resize(), 0);
            }
        });
    });

    els.recipeSelect.addEventListener("change", () => {
        app.selectedRecipe = app.data.recipes.find((recipe) => recipe.id === els.recipeSelect.value) ?? app.data.recipes[0];
        syncDryerProfile();
        setSuggestedMixMultiplier();
        renderRecipe();
    });

    els.operationMode.addEventListener("change", () => {
        els.customControls.forEach((control) => control.classList.toggle("d-none", !isCustomMode()));
        syncDryerProfile();
        renderProfile();
        renderStatus(app.dryer.getSnapshot());
    });
    [els.customTemperature, els.customDuration].forEach((input) => input.addEventListener("input", () => {
        if (isCustomMode()) {
            syncDryerProfile();
            renderProfile();
            renderStatus(app.dryer.getSnapshot());
        }
    }));
    els.meatWeight.addEventListener("input", renderIngredients);
    els.mixMultiplier.addEventListener("input", renderIngredients);
    els.salinitySelect.addEventListener("change", renderIngredients);
    els.chartTimeShorter.addEventListener("click", () => setChartTimeRange(app.chartTimeRangeIndex - 1));
    els.chartTimeLonger.addEventListener("click", () => setChartTimeRange(app.chartTimeRangeIndex + 1));
    els.startBtn.addEventListener("click", async () => {
        if (isCustomMode()) {
            const { temp, minutes } = getCustomSettings();
            await runMoonrakerCommand(() => app.moonraker.startCustomDrying?.(temp, minutes, app.selectedRecipe.id));
        } else {
            await runMoonrakerCommand(() => app.moonraker.startDrying?.(app.selectedRecipe.profile.toUpperCase(), app.selectedRecipe.id));
        }
        if (app.moonraker.isDemo) {
            app.dryer.start();
        } else {
            await app.moonraker.refreshTelemetry?.();
            syncDryerWithTelemetry(app.moonraker.getTelemetry());
        }
    });
    els.stopBtn.addEventListener("click", async () => {
        await runMoonrakerCommand(() => app.moonraker.stopDrying?.());
        if (app.moonraker.isDemo) {
            app.dryer.stop();
        } else {
            await app.moonraker.refreshTelemetry?.();
            syncDryerWithTelemetry(app.moonraker.getTelemetry());
        }
    });
    els.chamberLightBtn.addEventListener("click", async () => {
        const telemetry = app.moonraker.getTelemetry({
            running: app.dryer.getSnapshot().state === "running",
            targetTemp: app.dryer.getSnapshot().stage.temp
        });
        els.chamberLightBtn.disabled = true;
        try {
            await runMoonrakerCommand(() => app.moonraker.setChamberLight?.(!telemetry.lightOn));
        } finally {
            els.chamberLightBtn.disabled = false;
        }
    });
    els.fanToggleBtn.addEventListener("click", async () => {
        const telemetry = app.moonraker.getTelemetry();
        els.fanToggleBtn.disabled = true;
        try {
            await runMoonrakerCommand(() => app.moonraker.setDryerFan?.(!telemetry.fanOn));
        } finally {
            els.fanToggleBtn.disabled = app.dryer.getSnapshot().state === "running";
        }
    });
    els.emergencyStopBtn.addEventListener("click", async () => {
        await runMoonrakerCommand(() => app.moonraker.emergencyStop?.());
        app.activeProcessKey = null;
        app.dryer.stop("emergency");
    });
}

function renderRecipeOptions() {
    els.recipeSelect.replaceChildren(
        ...app.data.recipes.map((recipe) => {
            const option = document.createElement("option");
            option.value = recipe.id;
            option.textContent = getRecipeName(recipe, app.locale, app.t(`recipes.${recipe.id}.name`, recipe.id));
            return option;
        })
    );
}

function renderRecipe() {
    els.recipeSelect.value = app.selectedRecipe.id;
    renderActiveProfile();
    setSuggestedMixMultiplier();
    renderIngredients();
    renderProfile();
}

function renderIngredients() {
    const meatWeightG = clampMeatWeight(els.meatWeight.value);
    const mixMultiplier = clampMixMultiplier(els.mixMultiplier.value);
    const salinityPreset = els.salinitySelect.value;

    renderIngredientRows(els.dryMixTable, calculateDryMix(app.selectedRecipe, mixMultiplier));
    renderDryMixSummary(mixMultiplier);
    renderIngredientRows(els.marinadeTable, calculateMarinade(app.selectedRecipe, meatWeightG, app.data.ingredients, salinityPreset));
    renderSalinityInfo(meatWeightG, salinityPreset);
}

function renderIngredientRows(tableBody, rows) {
    tableBody.replaceChildren(
        ...rows.map(({ id, amount, unit }) => {
            const row = document.createElement("tr");
            const name = document.createElement("td");
            const value = document.createElement("td");

            const category = app.data.ingredients[id]?.category;
            const categoryInfo = app.data.categories[category] ?? {};
            name.innerHTML = `<span class="ingredient-name"><span class="category-icon" style="--category-color:${categoryInfo.color ?? "#6c757d"}">${categoryInfo.icon ?? "•"}</span><span></span></span>`;
            name.querySelector(".ingredient-name span:last-child").textContent = getIngredientName(app.data.ingredients[id], app.locale, app.t(`ingredients.${id}`, id));
            value.textContent = formatAmount(amount, unit, app.locale);
            value.className = "text-end";
            row.append(name, value);

            return row;
        })
    );
}

function renderDryMixSummary(mixMultiplier) {
    const summary = getDryMixBatchSummary(app.selectedRecipe, mixMultiplier);
    const totalRow = document.createElement("tr");
    const doseRow = document.createElement("tr");

    totalRow.className = "summary-row";
    totalRow.innerHTML = `<td>${app.t("ui.mix_batch_total", "Mix batch total")}</td><td class="text-end">${formatAmount(summary.batchTotal, "g", app.locale)}</td>`;

    doseRow.className = "summary-row";
    doseRow.innerHTML = `<td>${app.t("ui.mix_per_kg", "For marinade per 1 kg of meat")}</td><td class="text-end">${formatAmount(summary.usagePerKg, "g", app.locale)}</td>`;

    els.dryMixTable.append(totalRow, doseRow);
    els.mixInfo.textContent = app.t("ui.mix_summary", "Batch x{multiplier}: {total}. For marinade: {usage} per 1 kg")
        .replace("{multiplier}", summary.multiplier)
        .replace("{total}", formatAmount(summary.batchTotal, "g", app.locale))
        .replace("{usage}", formatAmount(summary.usagePerKg, "g", app.locale));
}

function renderProfile() {
    const profile = getCurrentProfile();

    els.profileTable.replaceChildren(
        ...profile.stages.map((stage, index) => {
            const row = document.createElement("tr");
            const cells = [
                `${index + 1}. ${getStageName(index)}`,
                `${stage.temp}°C`,
                formatStageDurationLocalized(stage),
                `${stage.fan}%`
            ];

            cells.forEach((text) => {
                const cell = document.createElement("td");
                cell.textContent = text;
                row.append(cell);
            });

            return row;
        })
    );
}

function renderSalinityInfo(meatWeightG, salinityPreset) {
    const summary = getSalinitySummary(app.selectedRecipe, meatWeightG, salinityPreset);
    els.salinityInfo.textContent = app.t("ui.salinity_summary", "Total salt: {percent}% ({total}, soy sauce contributes ~{soy})")
        .replace("{percent}", summary.percent.toFixed(2))
        .replace("{total}", formatAmount(summary.totalSalt, "g", app.locale))
        .replace("{soy}", formatAmount(summary.soySalt, "g", app.locale));
    els.salinityPercent.textContent = `${summary.percent.toFixed(2)}%`;
}

function renderStatus(snapshot) {
    const currentStage = snapshot.stage;
    const stateLabel = {
        idle: app.t("status.idle", "Ожидание"),
        running: app.t("status.running", "Работает"),
        stopped: app.t("status.stopped", "Остановлено"),
        emergency: app.t("status.emergency", "Аварийная остановка"),
        complete: app.t("ui.drying_complete", "Сушка завершена")
    }[snapshot.state];

    els.dryerStatus.textContent = stateLabel;
    els.dryerStatus.className = `badge ${snapshot.state === "running" ? "bg-success" : snapshot.state === "emergency" ? "bg-danger" : "bg-secondary"}`;
    els.currentStage.textContent = `${snapshot.index + 1} / ${getCurrentProfile().stages.length}`;
    els.stageName.textContent = getStageName(snapshot.index);
    els.targetTemp.textContent = currentStage.until_temp_below != null
        ? `${app.t("ui.cooling_until", "Cooling until")} ${currentStage.until_temp_below}°C`
        : `${app.t("ui.target", "Target")}: ${currentStage.temp}°C`;
    els.remainingTime.textContent = formatClock(snapshot.remainingSeconds);
    els.totalTime.textContent = `${app.t("ui.total", "Total")}: ${formatClock(getProfileDurationSeconds(getCurrentProfile()))}`;
    els.progressBar.style.width = `${snapshot.progress}%`;
    els.progressBar.textContent = `${snapshot.progress}%`;
    els.progressBar.classList.toggle("progress-bar-animated", snapshot.state === "running");
    els.startBtn.disabled = snapshot.state === "running";
    els.operationMode.disabled = snapshot.state === "running";
    els.customTemperature.disabled = snapshot.state === "running";
    els.customDuration.disabled = snapshot.state === "running";
    els.stopBtn.disabled = snapshot.state !== "running";
    els.stopBtn.classList.toggle("d-none", snapshot.state !== "running");

    renderTelemetry();
}

function renderTelemetry() {
    if (!app.dryer) {
        return;
    }

    const telemetry = app.moonraker.getTelemetry({
        running: app.dryer.getSnapshot().state === "running",
        targetTemp: app.dryer.getSnapshot().stage.temp
    });
    syncDryerWithTelemetry(telemetry);
    const snapshot = app.dryer.getSnapshot();

    els.connectionStatus.textContent = telemetry.connected ? (app.moonraker.isDemo ? app.t("status.demo", "Демо-режим") : "Moonraker") : "Offline";
    els.cpuTemp.textContent = `CPU ${telemetry.cpuTemp.toFixed(0)}°C`;
    els.electronicsTemp.textContent = `Bay ${telemetry.electronicsTemp.toFixed(0)}°C`;
    els.currentTemp.textContent = `${telemetry.currentTemp.toFixed(1)}°C`;
    els.heaterState.innerHTML = `<i class="bi bi-fire" aria-hidden="true"></i> ${app.t("ui.heater", "Heater")} ${app.t(telemetry.heaterOn ? "ui.on" : "ui.off", telemetry.heaterOn ? "on" : "off")}`;
    els.heaterSsrState.textContent = `${app.t("ui.heater", "Heater")} SSR ${telemetry.heaterOn ? "ON" : "OFF"} · PWM ${formatPowerPercent(telemetry.heaterPower)}`;
    els.heaterSsrState.className = `badge ${telemetry.heaterOn ? "bg-success" : "bg-secondary"}`;
    els.fanSsrState.textContent = `${app.t("ui.fan", "Fan")} SSR ${telemetry.fanOn ? "ON" : "OFF"} · PWM ${formatPowerPercent(telemetry.fanPower)}`;
    els.fanSsrState.className = `badge ${telemetry.fanOn ? "bg-success" : "bg-secondary"}`;
    els.fanToggleLabel.textContent = `${app.t("ui.fan", "Fan")} ${app.t(telemetry.fanOn ? "ui.on" : "ui.off", telemetry.fanOn ? "on" : "off")}`;
    els.chamberLightBtn.classList.toggle("is-on", telemetry.lightOn);
    els.chamberLightBtn.setAttribute("aria-pressed", String(telemetry.lightOn));
    els.chamberLightBtn.disabled = !telemetry.connected || !telemetry.mcuConnected;
    els.chamberLightLabel.textContent = `${app.t("ui.light", "Light")} ${app.t(telemetry.lightOn ? "ui.on" : "ui.off", telemetry.lightOn ? "on" : "off")}`;
    els.fanToggleBtn.classList.toggle("is-on", telemetry.fanOn);
    els.fanToggleBtn.setAttribute("aria-pressed", String(telemetry.fanOn));
    els.fanToggleBtn.disabled = !telemetry.connected || !telemetry.mcuConnected || snapshot.state === "running";
    els.fanToggleBtn.title = `${app.t("ui.fan", "Fan")} ${app.t(telemetry.fanOn ? "ui.on" : "ui.off", telemetry.fanOn ? "on" : "off")}`;
    els.chartChamberTemp.textContent = `${telemetry.currentTemp.toFixed(1)}°C`;
    els.chartTargetTemp.textContent = `${telemetry.targetTemp.toFixed(1)}°C`;
    els.chartCpuTemp.textContent = `${telemetry.cpuTemp.toFixed(1)}°C`;
    els.chartBayTemp.textContent = `${telemetry.electronicsTemp.toFixed(1)}°C`;
    const diagnostics = detectDiagnostics(telemetry, snapshot);
    renderAlerts(diagnostics);
    appendTemperaturePoint(telemetry);
}

function syncDryerWithTelemetry(telemetry) {
    if (app.moonraker.isDemo || !telemetry.connected || telemetry.dryerRunning === null) {
        return;
    }

    const activeDrying = resolveActiveDrying(telemetry, app.data);
    const snapshot = app.dryer.getSnapshot();
    if (activeDrying) {
        const processKey = getDryingProcessKey(activeDrying);
        if (snapshot.state !== "running" || app.activeProcessKey !== processKey) {
            app.selectedRecipe = app.data.recipes.find((recipe) => recipe.id === activeDrying.recipeId) ?? app.data.recipes[0];
            app.activeProfileId = activeDrying.profileId;
            restoreDryingControls(activeDrying);
            app.activeProcessKey = processKey;
            renderRecipeOptions();
            renderRecipe();
            app.dryer.restore(getCurrentProfile(), activeDrying.elapsedSeconds);
        } else {
            app.dryer.syncElapsed(activeDrying.elapsedSeconds);
        }
    } else if (snapshot.state === "running") {
        app.activeProcessKey = null;
        app.activeProfileId = null;
        app.dryer.stop(String(telemetry.dryerResult).toUpperCase() === "COMPLETE" ? "complete" : "stopped");
    } else {
        app.activeProcessKey = null;
        app.activeProfileId = null;
    }
}

function initTemperatureChart() {
    if (!window.Chart || !els.tempChart) {
        return;
    }

    app.tempChart = new window.Chart(els.tempChart, {
        type: "line",
        data: {
            datasets: [
                {
                    label: app.t("ui.chamber", "Chamber"),
                    data: [],
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, .12)",
                    fill: true,
                    tension: 0.25
                },
                {
                    label: "Raspberry Pi",
                    data: [],
                    borderColor: "#a78bfa",
                    tension: 0.25
                },
                {
                    label: app.t("ui.electronics_bay", "Electronic bay"),
                    data: [],
                    borderColor: "#22c55e",
                    tension: 0.25
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: "linear",
                    ticks: {
                        color: "#9ca3af",
                        stepSize: 60 * 1000,
                        callback: (value) => new Date(value).toLocaleTimeString(document.documentElement.lang, { hour: "2-digit", minute: "2-digit" })
                    },
                    grid: { color: "#252a31" }
                },
                y: { ticks: { color: "#9ca3af" }, grid: { color: "#252a31" }, suggestedMin: 20, suggestedMax: 80 }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    setChartTimeRange(app.chartTimeRangeIndex);
}

function appendTemperaturePoint(telemetry) {
    if (!app.tempChart || !telemetry.connected) {
        return;
    }

    const chamber = app.tempChart.data.datasets[0].data;
    const cpu = app.tempChart.data.datasets[1].data;
    const bay = app.tempChart.data.datasets[2].data;
    const now = Date.now();
    const oldestAllowed = now - CHART_MAX_HISTORY_MS;

    chamber.push({ x: now, y: telemetry.currentTemp });
    cpu.push({ x: now, y: telemetry.cpuTemp });
    bay.push({ x: now, y: telemetry.electronicsTemp });

    [chamber, cpu, bay].forEach((series) => {
        while (series.length && series[0].x < oldestAllowed) series.shift();
    });

    updateChartTimeBounds(now);
    app.tempChart.update("none");
}

function setChartTimeRange(index) {
    app.chartTimeRangeIndex = Math.max(0, Math.min(CHART_TIME_RANGES_MINUTES.length - 1, index));
    const minutes = CHART_TIME_RANGES_MINUTES[app.chartTimeRangeIndex];
    els.chartTimeRange.textContent = `${minutes} ${app.t("ui.minutes", "min")}`;
    els.chartTimeShorter.disabled = app.chartTimeRangeIndex === 0;
    els.chartTimeLonger.disabled = app.chartTimeRangeIndex === CHART_TIME_RANGES_MINUTES.length - 1;
    updateChartTimeBounds();
    app.tempChart?.update("none");
}

function updateChartTimeBounds(now = Date.now()) {
    if (!app.tempChart) return;
    const minutes = CHART_TIME_RANGES_MINUTES[app.chartTimeRangeIndex];
    app.tempChart.options.scales.x.min = now - minutes * 60 * 1000;
    app.tempChart.options.scales.x.max = now;
}

function detectDiagnostics(telemetry, snapshot) {
    const diagnostics = [];
    const now = Date.now();

    if (!telemetry.connected) diagnostics.push(["danger", "moonraker_unavailable", telemetry.connectionError]);
    else if (!telemetry.mcuConnected) diagnostics.push(["danger", "klipper_not_ready", telemetry.klipperMessage]);
    if (telemetry.connected && [telemetry.currentTemp, telemetry.electronicsTemp, telemetry.cpuTemp].some(isInvalidSensorValue)) diagnostics.push(["danger", "sensor_disconnected"]);
    if (snapshot.state === "emergency" || /emergency|m112/i.test(telemetry.klipperMessage)) diagnostics.push(["danger", "emergency_active"]);
    if (telemetry.cpuTemp >= DIAGNOSTIC_LIMITS.rpiCritical) diagnostics.push(["danger", "rpi_overheating"]);
    if (telemetry.electronicsTemp >= DIAGNOSTIC_LIMITS.electronicsCritical) diagnostics.push(["danger", "electronic_bay_overheating"]);
    else if (telemetry.electronicsTemp >= DIAGNOSTIC_LIMITS.electronicsWarning) diagnostics.push(["warning", "electronics_bay_high"]);

    if (snapshot.state === "running" && telemetry.heaterOn && telemetry.targetTemp > telemetry.currentTemp + DIAGNOSTIC_LIMITS.minimumHeatingGain) {
        if (!app.heaterWatch) app.heaterWatch = { startedAt: now, startTemp: telemetry.currentTemp };
        if (now - app.heaterWatch.startedAt >= DIAGNOSTIC_LIMITS.ssrTimeoutMs && telemetry.currentTemp < app.heaterWatch.startTemp + DIAGNOSTIC_LIMITS.minimumHeatingGain) {
            diagnostics.push(["danger", "ssr_timeout"]);
        } else if (telemetry.currentTemp >= app.heaterWatch.startTemp + DIAGNOSTIC_LIMITS.minimumHeatingGain) {
            app.heaterWatch = { startedAt: now, startTemp: telemetry.currentTemp };
        }
    } else {
        app.heaterWatch = null;
    }

    return diagnostics;
}

function isInvalidSensorValue(value) {
    return !Number.isFinite(value) || value <= 0;
}

function formatPowerPercent(value) {
    return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}

function renderAlerts(diagnostics) {
    els.alertContainer.replaceChildren(...diagnostics.map(([level, code, detail]) => {
        const alert = document.createElement("div");
        alert.className = `alert alert-${level}`;
        alert.textContent = `${app.t(`diagnostics.${code}`, code)}${detail ? `: ${detail}` : ""}`;
        return alert;
    }));
}

async function runMoonrakerCommand(command) {
    try {
        await command();
    } catch (error) {
        console.error(error);
        window.alert(`Moonraker: ${error.message}`);
        throw error;
    }
}

function getCurrentProfile() {
    if (isCustomMode()) {
        const { temp, minutes } = getCustomSettings();
        return { stages: [{ temp, minutes, fan: 100 }] };
    }

    return app.data.profiles[app.activeProfileId ?? app.selectedRecipe.profile];
}

function restoreDryingControls(saved) {
    if (!saved) return;

    els.operationMode.value = saved.mode === "custom" ? "custom" : "profile";
    els.customTemperature.value = saved.customTemp ?? 60;
    els.customDuration.value = saved.customMinutes ?? 240;
    els.customControls.forEach((control) => control.classList.toggle("d-none", saved.mode !== "custom"));
}

function getStageName(index) {
    if (isCustomMode()) {
        return app.t("ui.custom_stage", "Custom drying");
    }

    const profileId = app.activeProfileId ?? app.selectedRecipe.profile;
    return app.t(`stages.${profileId}.${index + 1}`, `${app.t("ui.stage", "Этап")} ${index + 1}`);
}

function setSuggestedMixMultiplier() {
    els.mixMultiplier.value = getSuggestedDryMixMultiplier(app.selectedRecipe);
}

function isCustomMode() {
    return els.operationMode.value === "custom";
}

function getCustomSettings() {
    return {
        temp: Math.min(85, Math.max(20, Number(els.customTemperature.value) || 60)),
        minutes: Math.max(1, Number(els.customDuration.value) || 1)
    };
}

function syncDryerProfile() {
    app.dryer.setProfile(getCurrentProfile());
    renderActiveProfile();
}

function renderActiveProfile() {
    els.activeProfile.textContent = isCustomMode()
        ? app.t("ui.custom_mode", "Custom")
        : getProfileName(
            app.data.profiles[app.activeProfileId ?? app.selectedRecipe.profile],
            app.locale,
            app.t(`profiles.${app.activeProfileId ?? app.selectedRecipe.profile}`, app.activeProfileId ?? app.selectedRecipe.profile)
        );
}

function formatStageDurationLocalized(stage) {
    if (stage.until_temp_below != null) {
        return `${app.t("ui.until_temperature", "until temperature")} ≤${stage.until_temp_below}°C`;
    }

    const hours = Math.floor(stage.minutes / 60);
    const minutes = stage.minutes % 60;
    const parts = [];

    if (hours) parts.push(`${hours} ${app.t("ui.hours", "h")}`);
    if (minutes) parts.push(`${minutes} ${app.t("ui.minutes", "min")}`);

    const duration = parts.join(" ");
    return stage.target_weight_loss_percent
        ? `${duration} ${app.t("ui.until_weight_loss", "or until")} ${stage.target_weight_loss_percent}%`
        : duration;
}
