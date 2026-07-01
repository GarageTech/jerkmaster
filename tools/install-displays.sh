#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${JERKMASTER_DISPLAY_DIR:-/opt/jerkmaster-displays}"
SERVICE_FILE="/etc/systemd/system/jerkmaster-displays.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
    exec sudo --preserve-env=JERKMASTER_DISPLAY_DIR "$0" "$@"
fi

APT_PACKAGES=(alsa-utils python3-gpiozero python3-pil python3-spidev fonts-dejavu-core)
missing_packages=()
for package in "${APT_PACKAGES[@]}"; do
    if ! dpkg-query -W -f='${Status}' "${package}" 2>/dev/null | grep -q "install ok installed"; then
        missing_packages+=("${package}")
    fi
done

if ((${#missing_packages[@]} > 0)); then
    apt-get update
    apt-get install -y "${missing_packages[@]}"
fi

install -d -m 0755 "${INSTALL_DIR}"
install -m 0755 "${PROJECT_DIR}/displays/jerkmaster_displays.py" "${INSTALL_DIR}/jerkmaster_displays.py"
install -m 0755 "${PROJECT_DIR}/displays/display_test.py" "${INSTALL_DIR}/display_test.py"
install -m 0644 "${PROJECT_DIR}/img/logo.png" "${INSTALL_DIR}/logo.png"

install -d -m 0755 "${INSTALL_DIR}/sounds"
install -m 0755 "${PROJECT_DIR}/sounds/play_sound.py" "${INSTALL_DIR}/sounds/play_sound.py"
install -m 0644 "${PROJECT_DIR}/sounds/"*.wav "${INSTALL_DIR}/sounds/"

cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=JerkMaster dual GC9A01 status displays
After=network-online.target moonraker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/jerkmaster_displays.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now jerkmaster-displays.service

echo "Display service installed. Check it with:"
echo "  sudo systemctl status jerkmaster-displays"
echo "  sudo journalctl -u jerkmaster-displays -f"
echo "Display wiring test: sudo systemctl stop jerkmaster-displays && sudo ${INSTALL_DIR}/display_test.py"
