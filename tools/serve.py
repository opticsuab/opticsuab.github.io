#!/usr/bin/env python3
"""Local preview of the site: python3 tools/serve.py [port]  →  http://localhost:8000/?preview
Serves the repository folder like GitHub Pages does for the published site: an address without a file
(/news/, /es/research/publications/) gets the page shell index.html, which shows the right page."""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not os.path.splitext(self.path.split('?')[0])[1]:
            self.path = '/index.html'
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f'Serving {ROOT} at http://localhost:{port}/?preview  (Ctrl+C to stop)')
http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
