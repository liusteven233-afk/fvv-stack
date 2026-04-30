#!/usr/bin/env python3
"""
1688 Scraper API Server v1.0
Acts as bridge between Chrome extension and Dashboard.
Receives scraped product data from extension, stores to shared JSON file.
Dashboard reads from same file.

Usage: python3 scraper_api.py [--port 8502]
"""

import json, os, sys, argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

PRODUCTS_FILE = "/home/mzls233/.hermes/1688_products.json"

class ScraperAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/scrape':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            try:
                data = json.loads(body)
                self._save_product(data)
                self._send(200, {"status": "ok", "message": "Product saved"})
            except json.JSONDecodeError:
                self._send(400, {"status": "error", "message": "Invalid JSON"})
        else:
            self._send(404, {"status": "error", "message": "Not found"})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/health':
            self._send(200, {"status": "ok", "service": "1688-scraper-api", "products_file": PRODUCTS_FILE})
        elif path == '/api/products':
            products = self._load_products()
            self._send(200, {"status": "ok", "count": len(products), "products": products[:50]})
        else:
            self._send(404, {"status": "error", "message": "Not found"})

    def _load_products(self):
        try:
            with open(PRODUCTS_FILE) as f:
                return json.load(f)
        except:
            return []

    def _save_product(self, data):
        products = self._load_products()
        item_id = data.get("item_id", "")
        # Dedup by item_id
        if item_id:
            products = [p for p in products if p.get("item_id") != item_id]
        data["saved_via"] = "extension"
        data["saved_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        products.insert(0, data)
        os.makedirs(os.path.dirname(PRODUCTS_FILE), exist_ok=True)
        with open(PRODUCTS_FILE, 'w') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)

    def _send(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, format, *args):
        sys.stderr.write(f"[ScraperAPI] {args[0] if args else ''}\n")

def main():
    parser = argparse.ArgumentParser(description="1688 Scraper API Server")
    parser.add_argument('--port', type=int, default=8502, help='Port to listen on (default: 8502)')
    args = parser.parse_args()

    server = HTTPServer(('127.0.0.1', args.port), ScraperAPIHandler)
    print(f"📦 1688 Scraper API running on http://127.0.0.1:{args.port}")
    print(f"📁 Products stored at: {PRODUCTS_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        server.server_close()

if __name__ == '__main__':
    main()
