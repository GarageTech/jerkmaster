#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${JERKMASTER_DISPLAY_DIR:-/opt/jerkmaster-displays}"
SERVICE_FILE="/etc/systemd/system/jerkmaster-displays.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
    exec sudo --preserve-env=JERKMASTER_DISPLAY_DIR "$0" "$@"
fi

apt-get update
apt-get install -y python3-gpiozero python3-pil python3-spidev fonts-dejavu-core

install -d -m 0755 "${INSTALL_DIR}"
install -m 0755 "${PROJECT_DIR}/displays/jerkmaster_displays.py" "${INSTALL_DIR}/jerkmaster_displays.py"
install -m 0644 "${PROJECT_DIR}/img/logo.png" "${INSTALL_DIR}/logo.png"
if [[ ! -f "${INSTALL_DIR}/config.json" ]]; then
    install -m 0644 "${PROJECT_DIR}/displays/config.json" "${INSTALL_DIR}/config.json"
fi

cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=JerkMaster dual GC9A01 status displays
After=network-online.target moonraker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=JERKMASTER_DISPLAY_CONFIG=${INSTALL_DIR}/config.json
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/jerkmaster_displays.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now jerkmaster-displays.service

if [[ ! -e /dev/spidev0.0 ]]; then
    echo "WARNING: SPI is not enabled. Run 'sudo raspi-config nonint do_spi 0' and reboot." >&2
fi

echo "Display service installed. Check it with:"
echo "  sudo systemctl status jerkmaster-displays"
echo "  sudo journalctl -u jerkmaster-displays -f"
