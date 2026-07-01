#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

LOGIN_USER="${SUDO_USER:-${USER:-}}"
if [[ -z "${LOGIN_USER}" || "${LOGIN_USER}" == "root" ]]; then
    LOGIN_USER="$(id -un)"
fi
LOGIN_GROUP="$(id -gn "${LOGIN_USER}")"

USER_HOME="$(getent passwd "${LOGIN_USER}" | cut -d: -f6)"
CONFIG_DIR="${JERKMASTER_CONFIG_DIR:-${USER_HOME}/printer_data/config}"
GCODES_DIR="${JERKMASTER_GCODES_DIR:-${USER_HOME}/printer_data/gcodes}"
CONFIG_TXT="${JERKMASTER_BOOT_CONFIG:-/boot/firmware/config.txt}"

APT_PACKAGES=(
    mc
    htop
    tree
    curl
    unzip
    alsa-utils
    fonts-dejavu-core
    python3-gpiozero
    python3-pil
    python3-spidev
    python3-requests
)

require_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        exec sudo --preserve-env=JERKMASTER_CONFIG_DIR,JERKMASTER_GCODES_DIR,JERKMASTER_BOOT_CONFIG "$0" "$@"
    fi
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-Y}"
    local answer
    read -r -p "${prompt} " answer || true
    answer="${answer:-${default}}"
    [[ "${answer}" =~ ^[Yy]([Ee][Ss])?$ ]]
}

backup_file() {
    local path="$1"
    if [[ -f "${path}" ]]; then
        cp -a -- "${path}" "${path}.backup-$(date +%Y%m%d-%H%M%S)"
    fi
}

install_packages() {
    local missing=()
    for package in "${APT_PACKAGES[@]}"; do
        if ! dpkg-query -W -f='${Status}' "${package}" 2>/dev/null | grep -q "install ok installed"; then
            missing+=("${package}")
        fi
    done

    if ((${#missing[@]} > 0)); then
        apt-get update
        apt-get install -y "${missing[@]}"
    else
        echo "System packages already installed."
    fi
}

detect_mcu() {
    local devices=()
    local selected
    shopt -s nullglob
    devices=(/dev/serial/by-id/*)
    shopt -u nullglob

    if ((${#devices[@]} == 0)); then
        echo "No MCU found under /dev/serial/by-id/." >&2
        echo "Flash/connect the SKR controller, then rerun tools/bootstrap.sh." >&2
        exit 1
    fi

    if ((${#devices[@]} == 1)); then
        echo "${devices[0]}"
        return
    fi

    echo "Found multiple MCU serial devices:" >&2
    for index in "${!devices[@]}"; do
        printf '%s) %s\n' "$((index + 1))" "${devices[index]}" >&2
    done
    read -r -p "Select MCU: " selected
    if [[ ! "${selected}" =~ ^[0-9]+$ ]] || ((selected < 1 || selected > ${#devices[@]})); then
        echo "Invalid MCU selection." >&2
        exit 1
    fi
    echo "${devices[selected - 1]}"
}

render_template() {
    local template="$1"
    local output="$2"
    local serial="$3"
    backup_file "${output}"
    sed "s|{{MCU_SERIAL}}|${serial}|g" "${template}" >"${output}"
    chown "${LOGIN_USER}:${LOGIN_GROUP}" "${output}" 2>/dev/null || true
}

install_klipper_config() {
    local serial="$1"
    install -d -m 0755 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" "${CONFIG_DIR}"
    install -d -m 0755 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" "${GCODES_DIR}"

    render_template "${PROJECT_DIR}/klipper/printer.cfg.template" "${CONFIG_DIR}/printer.cfg" "${serial}"
    backup_file "${CONFIG_DIR}/hardware.cfg"
    install -m 0644 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" "${PROJECT_DIR}/klipper/hardware.cfg.template" "${CONFIG_DIR}/hardware.cfg"
    backup_file "${CONFIG_DIR}/macros.cfg"
    install -m 0644 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" "${PROJECT_DIR}/klipper/macros.cfg" "${CONFIG_DIR}/macros.cfg"
    cp -a -- "${PROJECT_DIR}/klipper/gcodes/." "${GCODES_DIR}/"
    chown -R "${LOGIN_USER}:${LOGIN_GROUP}" "${GCODES_DIR}" 2>/dev/null || true
}

merge_moonraker() {
    local moonraker="${CONFIG_DIR}/moonraker.conf"
    python3 "${PROJECT_DIR}/tools/merge-moonraker-config.py" "${moonraker}"
    chown "${LOGIN_USER}:${LOGIN_GROUP}" "${moonraker}" "${moonraker}.backup" 2>/dev/null || true
}

enable_i2s_audio() {
    if [[ ! -f "${CONFIG_TXT}" ]]; then
        echo "Skipping I2S setup; ${CONFIG_TXT} was not found."
        return
    fi

    if python3 - "$CONFIG_TXT" <<'PY'
from pathlib import Path
import sys

lines = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
all_indexes = [i for i, line in enumerate(lines) if line.strip() == "[all]"]
if not all_indexes:
    raise SystemExit(1)
start = all_indexes[0] + 1
end = len(lines)
for index in range(start, len(lines)):
    stripped = lines[index].strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        end = index
        break
section = {line.strip() for line in lines[start:end]}
has_i2s = "dtparam=i2s=on" in section
has_dac = "dtoverlay=hifiberry-dac" in section or "dtoverlay=rpi-dac" in section
raise SystemExit(0 if has_i2s and has_dac else 1)
PY
    then
        echo "I2S audio already configured."
        return
    fi

    if ! prompt_yes_no "Enable MAX98357A I2S audio in ${CONFIG_TXT}? [Y/n]" "Y"; then
        return
    fi

    backup_file "${CONFIG_TXT}"
    python3 - "$CONFIG_TXT" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
insert = ["dtparam=i2s=on", "dtoverlay=hifiberry-dac"]

all_indexes = [i for i, line in enumerate(lines) if line.strip() == "[all]"]
target = all_indexes[0] if all_indexes else len(lines)
end = len(lines)
for i in range(target + 1, len(lines)):
    if lines[i].strip().startswith("[") and lines[i].strip().endswith("]"):
        end = i
        break

section = {line.strip() for line in lines[target + 1:end]}
has_dac = "dtoverlay=hifiberry-dac" in section or "dtoverlay=rpi-dac" in section
if has_dac:
    insert = ["dtparam=i2s=on"]
to_add = [line for line in insert if line not in section]
if to_add:
    if not all_indexes:
        lines.extend(["", "[all]"])
        target = len(lines) - 1
        end = len(lines)
    lines[end:end] = to_add
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
    echo "I2S audio configured. Reboot is required."
}

run_optional_tests() {
    if prompt_yes_no "Run display test now? Left should be red and right should be green. [y/N]" "N"; then
        systemctl stop jerkmaster-displays.service >/dev/null 2>&1 || true
        /opt/jerkmaster-displays/display_test.py || true
        read -r -p "Did the display test pass? [y/N] " _ || true
        systemctl start jerkmaster-displays.service >/dev/null 2>&1 || true
    fi

    if prompt_yes_no "Run stereo speaker test on hw:1,0? [y/N]" "N"; then
        speaker-test -D hw:1,0 -c 2 -t sine
    fi
}

main() {
    require_root "$@"
    install_packages
    local mcu_serial
    mcu_serial="$(detect_mcu)"
    install_klipper_config "${mcu_serial}"
    merge_moonraker
    bash "${PROJECT_DIR}/tools/install-raspberry-pi.sh"
    bash "${PROJECT_DIR}/tools/install-displays.sh"
    enable_i2s_audio
    systemctl restart moonraker.service || true
    run_optional_tests

    echo
    echo "JerkMaster bootstrap complete."
    echo "MCU: ${mcu_serial}"
    echo "Run RESTART in Klipper, reboot if I2S audio was enabled, then use docs/final-checklist.md."
}

main "$@"
