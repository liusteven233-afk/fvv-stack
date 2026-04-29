#!/usr/bin/env python3
"""Tiny Ollama proxy for Chrome extensions — bypasses CORS."""
import http.server, json, urllib.request, sys, os

TARGET = 'http://localhost:11434'
PORT = 11555

class Proxy(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_cors(200)
    def do_GET(self):
        self.proxy('GET')
    def do_POST(self):
        self.proxy('POST')

    def proxy(self, method):
        url = TARGET + self.path
        body = None
        if method == 'POST':
            cl = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(cl) if cl > 0 else b''
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/json'},
            method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            data = resp.read()
            self.send_cors(resp.status, resp.headers.get('Content-Type', 'application/json'))
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_cors(e.code, 'application/json')
            self.wfile.write(data)

    def send_cors(self, code=200, ctype='application/json'):
        self.send_response(code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', ctype)
        self.end_headers()

    def log_message(self, fmt, *a):
        sys.stderr.write(f'[ollama-proxy] {fmt%a}\n')

if __name__ == '__main__':
    httpd = http.server.HTTPServer(('0.0.0.0', PORT), Proxy)
    print(f'Ollama proxy on :{PORT} → {TARGET}')
    httpd.serve_forever()
