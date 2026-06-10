export class DemoMoonrakerClient {
    isDemo = true;
    #baseStartedAt = Date.now();

    getTelemetry({ running, targetTemp }) {
        const elapsed = (Date.now() - this.#baseStartedAt) / 1000;
        const ambient = 25 + Math.sin(elapsed / 14) * 0.4;
        const target = running ? targetTemp : ambient;
        const currentTemp = ambient + (target - ambient) * (running ? 0.62 : 0.08);

        return {
            connected: true,
            mcuConnected: true,
            klipperState: "ready",
            klipperMessage: "",
            cpuTemp: 42 + Math.sin(elapsed / 9) * 1.5,
            electronicsTemp: 35 + Math.cos(elapsed / 11) * 1.2,
            currentTemp,
            targetTemp,
            heaterOn: running && currentTemp < targetTemp - 0.5,
            fanOn: running
        };
    }

    runGcode() {
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
        cpuTemp: 0,
        electronicsTemp: 0,
        currentTemp: 0,
        targetTemp: 0,
        heaterOn: false,
        fanOn: false
    };

    constructor(baseUrl = getDefaultMoonrakerUrl()) {
        this.#baseUrl = baseUrl.replace(/\/+$/, "");
        this.refreshTelemetry();
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
            "gcode_macro DRYER_STATE",
            "webhooks"
        ].map(encodeURIComponent).join("&");

        try {
            const response = await fetch(`${this.#baseUrl}/printer/objects/query?${objects}`);

            if (!response.ok) {
                throw new Error(`Moonraker returned HTTP ${response.status}`);
            }

            const status = (await response.json()).result.status;
            const heater = status["heater_generic dryer_heater"] ?? {};
            const bay = status["temperature_sensor electronics_bay"] ?? {};
            const cpu = status["temperature_sensor raspberry_pi"] ?? {};
            const fan = status["output_pin dryer_fan"] ?? {};
            const webhooks = status.webhooks ?? {};
            const klipperState = String(webhooks.state ?? "ready");

            this.#telemetry = {
                connected: true,
                mcuConnected: klipperState === "ready",
                klipperState,
                klipperMessage: String(webhooks.state_message ?? ""),
                cpuTemp: Number(cpu.temperature ?? 0),
                electronicsTemp: Number(bay.temperature ?? 0),
                currentTemp: Number(heater.temperature ?? 0),
                targetTemp: Number(heater.target ?? 0),
                heaterOn: Number(heater.power ?? 0) > 0,
                fanOn: Number(fan.value ?? 0) > 0
            };
        } catch (error) {
            console.warn("Moonraker telemetry unavailable:", error);
            this.#telemetry = { ...this.#telemetry, connected: false, mcuConnected: false, klipperState: "disconnected" };
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

    startDrying(profile) {
        return this.runGcode(`START_DRYING PROFILE=${profile}`);
    }

    startCustomDrying(temp, minutes) {
        return this.runGcode(`START_DRYING PROFILE=CUSTOM TEMP=${temp} MINUTES=${minutes}`);
    }

    stopDrying() {
        return this.runGcode("STOP_DRYING");
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

    return new MoonrakerClient(params.get("moonraker") || getDefaultMoonrakerUrl());
}

function getDefaultMoonrakerUrl() {
    return `${window.location.protocol}//${window.location.hostname}:7125`;
}
