# Local dev server that tells the browser never to cache, so edits show on a normal reload.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
