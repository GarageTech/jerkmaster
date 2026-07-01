#!/usr/bin/env python3
"""Merge JerkMaster Moonraker settings without deleting local configuration."""

from __future__ import annotations

import configparser
import shutil
import sys
from pathlib import Path


REQUIRED = {
    "authorization": {
        "cors_domains": [
            "http://jerkmaster.local:8080",
            "http://jerkmaster.home:8080",
            "http://*.local",
            "http://*.local:8080",
            "http://*.home",
            "http://*.home:8080",
        ],
        "trusted_clients": [
            "127.0.0.0/8",
            "192.168.0.0/16",
            "10.0.0.0/8",
        ],
    },
    "octoprint_compat": {},
    "history": {},
    "announcements": {
        "subscriptions": ["moonraker"],
    },
    "file_manager": {
        "enable_object_processing": "False",
    },
    "update_manager": {
        "refresh_interval": "168",
    },
}


class MoonrakerConfig(configparser.ConfigParser):
    def optionxform(self, optionstr: str) -> str:
        return optionstr


def parse_multiline(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def merge_list(existing: str, required: list[str]) -> str:
    values = parse_multiline(existing)
    for item in required:
        if item not in values:
            values.append(item)
    return "\n" + "\n".join(values)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: merge-moonraker-config.py /path/to/moonraker.conf", file=sys.stderr)
        return 2

    path = Path(sys.argv[1]).expanduser()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("", encoding="utf-8")

    backup = path.with_suffix(path.suffix + ".backup")
    shutil.copy2(path, backup)

    config = MoonrakerConfig(interpolation=None, allow_no_value=True)
    config.read(path, encoding="utf-8")

    for section, options in REQUIRED.items():
        if not config.has_section(section):
            config.add_section(section)
        for option, required_value in options.items():
            if isinstance(required_value, list):
                current = config.get(section, option, fallback="")
                config.set(section, option, merge_list(current, required_value))
            else:
                config.set(section, option, required_value)

    with path.open("w", encoding="utf-8") as handle:
        config.write(handle, space_around_delimiters=False)

    print(f"Merged Moonraker configuration: {path}")
    print(f"Backup: {backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
