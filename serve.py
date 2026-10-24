# Local dev server that tells the browser never to cache, so edits show on a normal reload.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The page requests about fifteen modules at once; the default queue of 5 drops some.
    request_queue_size = 64


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
Server(("", port), NoCacheHandler).serve_forever()
