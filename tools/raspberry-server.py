#!/usr/bin/env python3
import argparse
import json
import os
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


USER_DATA_NAMES = {"ingredients", "recipes", "profiles"}
MAX_USER_DATA_BYTES = 2 * 1024 * 1024
EMPTY_CHANGES = {"added": {}, "updated": {}, "deleted": []}


class JerkMasterHandler(SimpleHTTPRequestHandler):
    user_data_dir = "/var/lib/jerkmaster/user-data"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self.send_text(200, "ok\n")
            return

        name = self.user_data_name(path)
        if name:
            try:
                self.send_json(200, self.read_user_data(name))
            except (json.JSONDecodeError, OSError, ValueError) as error:
                self.send_text(500, f"Cannot read user data: {error}\n")
            return

        super().do_GET()

    def do_PUT(self):
        name = self.user_data_name(urlparse(self.path).path)
        if not name:
            self.send_text(404, "Not found\n")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_text(400, "Invalid Content-Length\n")
            return
        if length < 2 or length > MAX_USER_DATA_BYTES:
            self.send_text(413, "User data must be a JSON object smaller than 2 MiB\n")
            return

        try:
            changes = normalize_changes(json.loads(self.rfile.read(length)))
            self.write_user_data(name, changes)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_text(400, f"Invalid user data: {error}\n")
            return
        except OSError as error:
            self.send_text(500, f"Cannot save user data: {error}\n")
            return

        self.send_json(200, changes)

    def user_data_name(self, path):
        prefix = "/api/user-data/"
        name = path[len(prefix):] if path.startswith(prefix) else ""
        return name if name in USER_DATA_NAMES else None

    def read_user_data(self, name):
        path = os.path.join(self.user_data_dir, f"{name}.json")
        try:
            with open(path, encoding="utf-8") as source:
                return normalize_changes(json.load(source))
        except FileNotFoundError:
            return dict(EMPTY_CHANGES)

    def write_user_data(self, name, changes):
        os.makedirs(self.user_data_dir, mode=0o750, exist_ok=True)
        target = os.path.join(self.user_data_dir, f"{name}.json")
        descriptor, temporary = tempfile.mkstemp(prefix=f".{name}-", suffix=".tmp", dir=self.user_data_dir)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as destination:
                json.dump(changes, destination, ensure_ascii=False, indent=2, sort_keys=True)
                destination.write("\n")
                destination.flush()
                os.fsync(destination.fileno())
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status, value):
        body = value.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def normalize_changes(value):
    if not isinstance(value, dict):
        raise ValueError("expected a JSON object")
    added = value.get("added", {})
    updated = value.get("updated", {})
    deleted = value.get("deleted", [])
    if not isinstance(added, dict) or not isinstance(updated, dict) or not isinstance(deleted, list):
        raise ValueError("added and updated must be objects; deleted must be an array")
    if any(not isinstance(item, str) for item in deleted):
        raise ValueError("deleted IDs must be strings")
    return {"added": added, "updated": updated, "deleted": list(dict.fromkeys(deleted))}


def main():
    parser = argparse.ArgumentParser(description="Serve the JerkMaster UI on Raspberry Pi")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--directory", default="/opt/jerkmaster")
    parser.add_argument("--user-data-dir", default="/var/lib/jerkmaster/user-data")
    args = parser.parse_args()

    os.chdir(args.directory)
    JerkMasterHandler.user_data_dir = os.path.abspath(args.user_data_dir)
    server = ThreadingHTTPServer(("0.0.0.0", args.port), JerkMasterHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
