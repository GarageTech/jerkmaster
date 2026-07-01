#!/usr/bin/env python3
"""Release the BTT relay only during Linux poweroff/halt, never during reboot."""

import subprocess
import sys
import time
import urllib.parse
import urllib.error
import urllib.request


MOONRAKER_GCODE_URL = "http://127.0.0.1:7125/printer/gcode/script"
PS_ON_OFF_GCODE = "SET_PIN PIN=PS_ON VALUE=0"
POWEROFF_TARGETS = ("poweroff.target", "halt.target")
REBOOT_TARGETS = ("reboot.target", "kexec.target", "soft-reboot.target")


def systemd_jobs():
    try:
        completed = subprocess.run(
            ["systemctl", "list-jobs", "--plain", "--no-legend"],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return completed.stdout or ""


def should_release_relay():
    jobs = systemd_jobs()
    if any(target in jobs for target in REBOOT_TARGETS):
        return False
    return any(target in jobs for target in POWEROFF_TARGETS)


def send_poweroff():
    url = f"{MOONRAKER_GCODE_URL}?script={urllib.parse.quote(PS_ON_OFF_GCODE)}"
    request = urllib.request.Request(
        url,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=3) as response:
        response.read()


def main():
    if not should_release_relay():
        print("Not a poweroff/halt transaction; leaving PS_ON high.")
        return 0

    last_error = None
    for _ in range(5):
        try:
            send_poweroff()
            return 0
        except (OSError, urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(1)

    print(f"Could not release PS_ON through Moonraker: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
