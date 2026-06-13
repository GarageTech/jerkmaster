import { getProfileDurationSeconds, getStageAt, hasOpenEndedStage } from "./calculator.js";

export class DryerController extends EventTarget {
    #timerId = null;
    #startedAt = 0;
    #elapsedBeforePause = 0;

    constructor(profile) {
        super();
        this.profile = profile;
        this.state = "idle";
        this.elapsedSeconds = 0;
    }

    setProfile(profile) {
        if (this.state === "running") {
            return;
        }

        this.profile = profile;
        this.elapsedSeconds = 0;
        this.#elapsedBeforePause = 0;
        this.#emit();
    }

    start(elapsedSeconds = 0) {
        if (this.state === "running" || !this.profile) {
            return;
        }

        this.state = "running";
        this.elapsedSeconds = Math.max(0, Number(elapsedSeconds) || 0);
        this.#elapsedBeforePause = this.elapsedSeconds;
        this.#startedAt = Date.now();
        this.#timerId = window.setInterval(() => this.#tick(), 1000);
        this.#tick();
    }

    stop(state = "stopped") {
        if (this.#timerId) {
            window.clearInterval(this.#timerId);
            this.#timerId = null;
        }

        this.state = state;
        this.#elapsedBeforePause = this.elapsedSeconds;
        this.#emit();
    }

    reset() {
        this.stop("idle");
        this.elapsedSeconds = 0;
        this.#elapsedBeforePause = 0;
        this.#emit();
    }

    getSnapshot() {
        const totalSeconds = getProfileDurationSeconds(this.profile);
        const elapsedSeconds = hasOpenEndedStage(this.profile) ? this.elapsedSeconds : Math.min(this.elapsedSeconds, totalSeconds);
        const stageInfo = getStageAt(this.profile, elapsedSeconds);

        return {
            state: this.state,
            elapsedSeconds,
            totalSeconds,
            remainingSeconds: Math.max(0, totalSeconds - elapsedSeconds),
            progress: totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0,
            ...stageInfo
        };
    }

    #tick() {
        const delta = (Date.now() - this.#startedAt) / 1000;
        const totalSeconds = getProfileDurationSeconds(this.profile);

        this.elapsedSeconds = hasOpenEndedStage(this.profile)
            ? this.#elapsedBeforePause + delta
            : Math.min(this.#elapsedBeforePause + delta, totalSeconds);

        if (!hasOpenEndedStage(this.profile) && this.elapsedSeconds >= totalSeconds) {
            this.stop("complete");
            return;
        }

        this.#emit();
    }

    #emit() {
        this.dispatchEvent(new CustomEvent("change", { detail: this.getSnapshot() }));
    }
}
