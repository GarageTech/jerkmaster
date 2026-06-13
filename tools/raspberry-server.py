#!/usr/bin/env python3
import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class JerkMasterHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/health":
            body = b"ok\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description="Serve the JerkMaster UI on Raspberry Pi")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--directory", default="/opt/jerkmaster")
    args = parser.parse_args()

    os.chdir(args.directory)
    server = ThreadingHTTPServer(("0.0.0.0", args.port), JerkMasterHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
