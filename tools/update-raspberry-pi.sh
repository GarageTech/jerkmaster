#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${JERKMASTER_REPOSITORY:-GarageTech/jerkmaster}"
BRANCH="${JERKMASTER_BRANCH:-main}"
ARCHIVE_URL="https://github.com/${REPOSITORY}/archive/refs/heads/${BRANCH}.zip"

if [[ "${EUID}" -ne 0 ]]; then
    exec sudo --preserve-env=JERKMASTER_REPOSITORY,JERKMASTER_BRANCH,JERKMASTER_CONFIG_DIR,JERKMASTER_INSTALL_DISPLAYS "$0" "$@"
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
    apt-get update
    apt-get install -y curl unzip
fi

LOGIN_USER="${SUDO_USER:-}"
if [[ -z "${LOGIN_USER}" || "${LOGIN_USER}" == "root" ]]; then
    echo "Run this updater from the regular Raspberry Pi user account with sudo." >&2
    exit 1
fi

USER_HOME="$(getent passwd "${LOGIN_USER}" | cut -d: -f6)"
LOGIN_GROUP="$(id -gn "${LOGIN_USER}")"
if [[ -z "${USER_HOME}" || ! -d "${USER_HOME}" ]]; then
    echo "Could not determine the home directory for ${LOGIN_USER}." >&2
    exit 1
fi

CONFIG_DIR="${JERKMASTER_CONFIG_DIR:-${USER_HOME}/printer_data/config}"
if [[ "${CONFIG_DIR}" != /* || "${CONFIG_DIR}" == "/" || "${CONFIG_DIR}" == *$'\n'* ]]; then
    echo "JERKMASTER_CONFIG_DIR must be a safe absolute path other than /." >&2
    exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "${TEMP_DIR}"' EXIT

echo "Downloading ${REPOSITORY} (${BRANCH})..."
curl -fL --retry 3 --output "${TEMP_DIR}/jerkmaster.zip" "${ARCHIVE_URL}"
unzip -q "${TEMP_DIR}/jerkmaster.zip" -d "${TEMP_DIR}/source"

PROJECT_DIR="$(find "${TEMP_DIR}/source" -mindepth 1 -maxdepth 1 -type d -print -quit)"
if [[ -z "${PROJECT_DIR}" || ! -f "${PROJECT_DIR}/tools/install-raspberry-pi.sh" ]]; then
    echo "The downloaded archive does not contain a valid JerkMaster project." >&2
    exit 1
fi

install -d -m 0755 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" "${CONFIG_DIR}"
if [[ -f "${CONFIG_DIR}/macros.cfg" ]]; then
    BACKUP="${CONFIG_DIR}/macros.cfg.backup-$(date +%Y%m%d-%H%M%S)"
    cp -a -- "${CONFIG_DIR}/macros.cfg" "${BACKUP}"
    chown "${LOGIN_USER}:${LOGIN_GROUP}" "${BACKUP}"
    echo "Backed up active macros to ${BACKUP}"
fi

install -m 0644 -o "${LOGIN_USER}" -g "${LOGIN_GROUP}" \
    "${PROJECT_DIR}/klipper/macros.cfg" "${CONFIG_DIR}/macros.cfg"
bash "${PROJECT_DIR}/tools/install-raspberry-pi.sh"
if [[ "${JERKMASTER_INSTALL_DISPLAYS:-0}" == "1" || -f /etc/systemd/system/jerkmaster-displays.service ]]; then
    bash "${PROJECT_DIR}/tools/install-displays.sh"
fi

echo
echo "JerkMaster and macros.cfg were updated from the public ${BRANCH} archive."
echo "Review the macro changes, then run RESTART in the Klipper console."
echo "Machine-specific printer.cfg, hardware.cfg, and moonraker.conf were not changed."
