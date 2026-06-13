import { createMoonrakerClient } from "./moonraker.js";
import { getPreferredLocale, loadTranslations } from "./translations.js";

const button = document.querySelector("#chamber-light-btn");
const label = document.querySelector("#chamber-light-label");

if (button && label) {
    const moonraker = createMoonrakerClient();
    const { t } = await loadTranslations(getPreferredLocale());

    button.addEventListener("click", async () => {
        const telemetry = moonraker.getTelemetry();
        button.disabled = true;

        try {
            await moonraker.setChamberLight(!telemetry.lightOn);
        } catch (error) {
            console.error(error);
            window.alert(`Moonraker: ${error.message}`);
        }
    });

    const render = () => {
        const telemetry = moonraker.getTelemetry();
        button.classList.toggle("is-on", telemetry.lightOn);
        button.setAttribute("aria-pressed", String(telemetry.lightOn));
        button.disabled = !telemetry.connected || !telemetry.mcuConnected;
        label.textContent = `${t("ui.light", "Light")} ${t(telemetry.lightOn ? "ui.on" : "ui.off", telemetry.lightOn ? "on" : "off")}`;
    };

    window.setInterval(render, 750);
    render();
}
