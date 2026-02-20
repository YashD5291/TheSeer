"""
The Seer — Crawl4AI local server.
Accepts a URL, returns clean markdown of the rendered page.
Run: python3 server.py
"""

import asyncio
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from crawl4ai import AsyncWebCrawler

PORT = 9742
crawler_instance = None
loop = None


async def get_crawler():
    global crawler_instance
    if crawler_instance is None:
        crawler_instance = AsyncWebCrawler(headless=True, verbose=False)
        await crawler_instance.start()
    return crawler_instance


async def crawl_url(url: str) -> dict:
    crawler = await get_crawler()
    try:
        result = await crawler.arun(url=url)
        md = result.markdown or ""
        return {"success": True, "markdown": md, "length": len(md)}
    except Exception as e:
        return {"success": False, "markdown": "", "error": str(e)}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/crawl":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        url = body.get("url", "")

        if not url:
            self._json_response(400, {"error": "url required"})
            return

        print(f"[Seer Crawl] Crawling: {url}")
        future = asyncio.run_coroutine_threadsafe(crawl_url(url), loop)
        result = future.result(timeout=30)
        print(f"[Seer Crawl] Done: {result.get('length', 0)} chars, success={result['success']}")
        self._json_response(200, result)

    def do_GET(self):
        if self.path == "/health":
            self._json_response(200, {"status": "ok"})
            return
        self.send_error(404)

    def _json_response(self, code: int, data: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self._json_response(200, {})

    def log_message(self, format, *args):
        # Suppress default access logs
        pass


def run_loop(lp):
    asyncio.set_event_loop(lp)
    lp.run_forever()


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    Thread(target=run_loop, args=(loop,), daemon=True).start()

    # Pre-warm the crawler
    print(f"[Seer Crawl] Starting on port {PORT}...")
    future = asyncio.run_coroutine_threadsafe(get_crawler(), loop)
    future.result(timeout=30)
    print(f"[Seer Crawl] Ready — http://localhost:{PORT}")

    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Seer Crawl] Shutting down...")
        server.server_close()
