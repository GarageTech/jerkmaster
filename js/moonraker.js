export class DemoMoonrakerClient {
    isDemo = true;
    #baseStartedAt = Date.now();
    #lightOn = false;
    #fanOn = false;

    getTelemetry({ running = false, targetTemp = 0 } = {}) {
        const elapsed = (Date.now() - this.#baseStartedAt) / 1000;
        const ambient = 25 + Math.sin(elapsed / 14) * 0.4;
        const target = running ? targetTemp : ambient;
        const currentTemp = ambient + (target - ambient) * (running ? 0.62 : 0.08);
        const heaterPower = running && currentTemp < targetTemp - 0.5 ? 0.62 : 0;
        const fanPower = running || this.#fanOn ? 1 : 0;

        return {
            connected: true,
            mcuConnected: true,
            klipperState: "ready",
            klipperMessage: "",
            connectionError: "",
            dryerRunning: null,
            dryerProfile: "NONE",
            dryerRecipe: "NONE",
            dryerResult: "NONE",
            dryerStage: 0,
            dryerElapsedSeconds: null,
            dryerCustomTemp: 0,
            dryerCustomMinutes: 0,
            cpuTemp: 42 + Math.sin(elapsed / 9) * 1.5,
            electronicsTemp: 35 + Math.cos(elapsed / 11) * 1.2,
            currentTemp,
            targetTemp,
            heaterOn: heaterPower > 0,
            heaterPower,
            fanOn: fanPower > 0,
            fanPower,
            lightOn: this.#lightOn
        };
    }

    runGcode() {
        return Promise.resolve();
    }

    setChamberLight(on) {
        this.#lightOn = Boolean(on);
        return Promise.resolve();
    }

    setDryerFan(on) {
        this.#fanOn = Boolean(on);
        return Promise.resolve();
    }
}

export class MoonrakerClient {
    isDemo = false;
    #baseUrl;
    #telemetry = {
        connected: false,
        mcuConnected: false,
        klipperState: "disconnected",
        klipperMessage: "",
        connectionError: "",
        dryerRunning: null,
        dryerProfile: "NONE",
        dryerRecipe: "NONE",
        dryerResult: "NONE",
        dryerStage: 0,
        dryerElapsedSeconds: null,
        dryerCustomTemp: 0,
        dryerCustomMinutes: 0,
        cpuTemp: 0,
        electronicsTemp: 0,
        currentTemp: 0,
        targetTemp: 0,
        heaterOn: false,
        heaterPower: 0,
        fanOn: false,
        fanPower: 0,
        lightOn: false
    };

    constructor(baseUrl = getDefaultMoonrakerUrl()) {
        this.#baseUrl = baseUrl.replace(/\/+$/, "");
        window.setInterval(() => this.refreshTelemetry(), 1500);
    }

    getTelemetry() {
        return this.#telemetry;
    }

    async refreshTelemetry() {
        const objects = [
            "heater_generic dryer_heater",
            "temperature_sensor electronics_bay",
            "temperature_sensor raspberry_pi",
            "output_pin dryer_fan",
            "output_pin chamber_light",
            "gcode_macro DRYER_STATE",
            "toolhead",
            "webhooks"
        ].map(encodeURIComponent).join("&");

        try {
            const [objectsResponse, serverInfoResponse] = await Promise.all([
                fetch(`${this.#baseUrl}/printer/objects/query?${objects}`),
                fetch(`${this.#baseUrl}/server/info`)
            ]);

            if (!objectsResponse.ok || !serverInfoResponse.ok) {
                throw new Error(`Moonraker returned HTTP ${objectsResponse.ok ? serverInfoResponse.status : objectsResponse.status}`);
            }

            const status = (await objectsResponse.json()).result.status;
            const serverInfo = (await serverInfoResponse.json()).result;
            const heater = status["heater_generic dryer_heater"] ?? {};
            const bay = status["temperature_sensor electronics_bay"] ?? {};
            const cpu = status["temperature_sensor raspberry_pi"] ?? {};
            const fan = status["output_pin dryer_fan"] ?? {};
            const light = status["output_pin chamber_light"] ?? {};
            const dryerState = status["gcode_macro DRYER_STATE"] ?? {};
            const toolhead = status.toolhead ?? {};
            const webhooks = status.webhooks ?? {};
            const klipperState = String(serverInfo.klippy_state ?? webhooks.state ?? "disconnected");
            const klipperConnected = Boolean(serverInfo.klippy_connected) && klipperState === "ready";

            this.#telemetry = {
                connected: true,
                mcuConnected: klipperConnected,
                klipperState,
                klipperMessage: String(webhooks.state_message ?? ""),
                connectionError: "",
                dryerRunning: Number(dryerState.running ?? 0) === 1,
                dryerProfile: String(dryerState.profile ?? "NONE"),
                dryerRecipe: String(dryerState.recipe ?? "NONE"),
                dryerResult: String(dryerState.last_result ?? "NONE"),
                dryerStage: Number(dryerState.stage ?? 0),
                dryerElapsedSeconds: getDryerElapsedSeconds(dryerState, toolhead),
                dryerCustomTemp: Number(dryerState.custom_temp ?? 0),
                dryerCustomMinutes: Number(dryerState.custom_minutes ?? 0),
                cpuTemp: Number(cpu.temperature ?? 0),
                electronicsTemp: Number(bay.temperature ?? 0),
                currentTemp: Number(heater.temperature ?? 0),
                targetTemp: Number(heater.target ?? 0),
                heaterOn: Number(heater.power ?? 0) > 0,
                heaterPower: clampPower(heater.power),
                fanOn: Number(fan.value ?? 0) > 0,
                fanPower: clampPower(fan.value),
                lightOn: Number(light.value ?? 0) > 0
            };
        } catch (error) {
            console.warn("Moonraker telemetry unavailable:", error);
            this.#telemetry = {
                ...this.#telemetry,
                connected: false,
                mcuConnected: false,
                klipperState: "disconnected",
                connectionError: String(error.message ?? error)
            };
        }
    }

    async runGcode(script) {
        const response = await fetch(`${this.#baseUrl}/printer/gcode/script?script=${encodeURIComponent(script)}`, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error(`Moonraker command failed with HTTP ${response.status}`);
        }

        return response.json();
    }

    startDrying(profile, recipeId) {
        return this.runGcode(`START_DRYING PROFILE=${profile} RECIPE=${recipeId}`);
    }

    startCustomDrying(temp, minutes, recipeId) {
        return this.runGcode(`START_DRYING PROFILE=CUSTOM TEMP=${temp} MINUTES=${minutes} RECIPE=${recipeId}`);
    }

    stopDrying() {
        return this.runGcode("STOP_DRYING");
    }

    setChamberLight(on) {
        return this.runGcode(`SET_PIN PIN=chamber_light VALUE=${on ? 1 : 0}`)
            .then(() => this.refreshTelemetry());
    }

    setDryerFan(on) {
        return this.runGcode(`SET_PIN PIN=dryer_fan VALUE=${on ? 1 : 0}`)
            .then(() => this.refreshTelemetry());
    }

    emergencyStop() {
        return fetch(`${this.#baseUrl}/printer/emergency_stop`, { method: "POST" }).then((response) => {
            if (!response.ok) {
                throw new Error(`Moonraker emergency stop failed with HTTP ${response.status}`);
            }

            return response.json();
        });
    }
}

export function createMoonrakerClient() {
    const params = new URLSearchParams(window.location.search);

    if (params.get("demo") === "1") {
        return new DemoMoonrakerClient();
    }

    return new MoonrakerClient(getDefaultMoonrakerUrl());
}

function getDefaultMoonrakerUrl() {
    return `${window.location.protocol}//${window.location.hostname}:7125`;
}

function getDryerElapsedSeconds(dryerState, toolhead) {
    const stageStartedAt = Number(dryerState.stage_started_at);
    const elapsedBeforeStage = Number(dryerState.elapsed_before_stage);
    const estimatedPrintTime = Number(toolhead.estimated_print_time);

    if (![stageStartedAt, elapsedBeforeStage, estimatedPrintTime].every(Number.isFinite) || stageStartedAt <= 0) {
        return null;
    }

    return Math.max(0, elapsedBeforeStage + estimatedPrintTime - stageStartedAt);
}

function clampPower(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}
