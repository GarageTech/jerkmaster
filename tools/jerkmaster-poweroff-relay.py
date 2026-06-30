#!/usr/bin/env python3
"""Release the BTT relay from the Raspberry Pi late in system shutdown."""

import sys
import time
import urllib.parse
import urllib.error
import urllib.request


MOONRAKER_GCODE_URL = "http://127.0.0.1:7125/printer/gcode/script"
PS_ON_OFF_GCODE = "SET_PIN PIN=PS_ON VALUE=0"


def send_poweroff():
    url = f"{MOONRAKER_GCODE_URL}?script={urllib.parse.quote(PS_ON_OFF_GCODE)}"
    request = urllib.request.Request(
        url,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=3) as response:
        response.read()


def main():
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
