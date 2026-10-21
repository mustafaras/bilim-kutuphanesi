#!/usr/bin/env python3
"""Static file server for the browser audits: threaded, HTTP/1.1 keep-alive, deep listen backlog.

`python -m http.server` is threaded but keeps socketserver's default backlog of 5. The page pulls ~30
script tags at once, so on a slow (software-GL) machine the accept queue overflows and Chromium reports
ERR_CONNECTION_RESET for a random subset of the files. A missing script then surfaces as a bogus audit
failure ("UI is not defined", "openRecord is not defined", "records is not defined") instead of a real
one. Raising the backlog and keeping the connection alive removes that whole class of flake.

  python tools/_serve.py PORT [--directory DIR]
"""
import argparse, functools, http.server, socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 256


ap = argparse.ArgumentParser()
ap.add_argument("port", type=int)
ap.add_argument("--directory", default=".")
a = ap.parse_args()
with Server(("127.0.0.1", a.port), functools.partial(Handler, directory=a.directory)) as s:
    s.serve_forever()
