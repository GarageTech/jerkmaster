#!/usr/bin/env bash
set -euo pipefail

PORT="${JERKMASTER_PORT:-8080}"
INSTALL_DIR="${JERKMASTER_INSTALL_DIR:-/opt/jerkmaster}"
SERVICE_FILE="/etc/systemd/system/jerkmaster.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ ! "${PORT}" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
    echo "JERKMASTER_PORT must be a number from 1 to 65535." >&2
    exit 1
fi

if [[ "${INSTALL_DIR}" != /* || "${INSTALL_DIR}" == "/" || "${INSTALL_DIR}" == *$'\n'* ]]; then
    echo "JERKMASTER_INSTALL_DIR must be a safe absolute path other than /." >&2
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    exec sudo --preserve-env=JERKMASTER_PORT,JERKMASTER_INSTALL_DIR "$0" "$@"
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required but was not found." >&2
    exit 1
fi

install -d -m 0755 "${INSTALL_DIR}"

for file in index.html ingredients.html recipes.html profiles.html making-jerky.html; do
    install -m 0644 "${PROJECT_DIR}/${file}" "${INSTALL_DIR}/${file}"
done

for directory in css data img js recipes translations; do
    rm -rf -- "${INSTALL_DIR:?}/${directory}"
    cp -a -- "${PROJECT_DIR}/${directory}" "${INSTALL_DIR}/${directory}"
done
install -m 0755 "${PROJECT_DIR}/tools/raspberry-server.py" "${INSTALL_DIR}/raspberry-server.py"

cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=JerkMaster web interface
After=network-online.target moonraker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/raspberry-server.py --port ${PORT} --directory ${INSTALL_DIR}
Restart=on-failure
RestartSec=3
DynamicUser=yes
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable jerkmaster.service
systemctl restart jerkmaster.service

HOSTNAME="$(hostname)"
echo
echo "JerkMaster is running at:"
echo "  http://${HOSTNAME}.local:${PORT}/"
echo "  http://$(hostname -I | awk '{print $1}'):${PORT}/"
echo
echo "Service status: systemctl status jerkmaster"
echo "Health check:   curl -fsS http://127.0.0.1:${PORT}/health"
