#!/usr/bin/env python3
"""
Genie Bath & Kitchen — Local Development / Preview Server
Provides:
- Full HTTP Range-request support (needed for video seeking)
- Correct MIME types for WebP, WOFF2, and MP4
- Local API proxy for /api/webhooks/leads to bypass browser CORS during testing
"""

import http.server
import json
import mimetypes
import os
import re
import socketserver
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"

UPSTREAM_WEBHOOK_URL = "https://kaos-genie.com/api/webhooks/leads?token=wh_7HZviHLugPEbCNc4oQTOqiPDApjSFD9Y"

# Ensure correct MIME type mappings
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")

class RangedHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler supporting Byte Range requests and API Proxy."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def do_OPTIONS(self):
        """Respond to CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        """Proxy POST requests for lead webhooks to avoid CORS blocks."""
        if self.path.startswith("/api/webhooks/leads") or self.path.startswith("/api/lead-proxy"):
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)

            try:
                # Validate JSON format
                parsed = json.loads(post_body.decode("utf-8"))
                print(f"[Lead Webhook] Received lead for: {parsed.get('name', 'Unknown')} ({parsed.get('phone', 'No phone')})")
            except Exception as e:
                print(f"[Lead Webhook] Notice: Body is not JSON: {e}")

            # Forward upstream
            try:
                import ssl
                ssl_ctx = ssl._create_unverified_context() if hasattr(ssl, "_create_unverified_context") else None

                req = urllib.request.Request(
                    UPSTREAM_WEBHOOK_URL,
                    data=post_body,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "Genie-Bath-Kitchen-Site/1.0"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as response:
                    resp_data = response.read()
                    status = response.status
                    print(f"[Lead Webhook] Upstream responded with status {status}")

                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(resp_data)
                    return
            except urllib.error.HTTPError as e:
                err_data = e.read()
                print(f"[Lead Webhook] Upstream HTTP error {e.code}: {err_data.decode('utf-8', errors='replace')}")
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(err_data)
                return
            except Exception as e:
                print(f"[Lead Webhook] Forwarding exception: {e}")
                err_json = json.dumps({
                    "success": False,
                    "error": str(e),
                    "message": "Local proxy forwarding error"
                }).encode("utf-8")
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(err_json)
                return

        self.send_error(404, "Endpoint not found")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        """Common code for GET and HEAD commands with Range header support."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            parts = [p for p in self.path.split('/') if p]
            if not self.path.endswith('/'):
                self.send_response(301)
                new_parts = parts + ['']
                new_path = "/" + "/".join(new_parts)
                self.send_header("Location", new_path)
                self.end_headers()
                return None
            for index in "index.html", "index.htm":
                index_path = os.path.join(path, index)
                if os.path.exists(index_path):
                    path = index_path
                    break
            else:
                return super().send_head()

        ctype = self.guess_type(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        size = fs[6]

        range_header = self.headers.get('Range')
        if range_header:
            range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
            if range_match:
                start = int(range_match.group(1))
                end = int(range_match.group(2)) if range_match.group(2) else size - 1
                if start >= size:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    f.close()
                    return None
                end = min(end, size - 1)
                length = end - start + 1

                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()

                f.seek(start)
                return f

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        return f

def serve(port=8080):
    handler = RangedHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True

    # Check if requested port is available, or find an alternate
    for p in range(port, port + 10):
        try:
            with socketserver.TCPServer(("", p), handler) as httpd:
                print(f"✨ Genie Bath & Kitchen preview server running at:")
                print(f"   👉 http://localhost:{p}")
                print(f"   Serving folder: {SITE_DIR}")
                print(f"   Webhook proxy: http://localhost:{p}/api/webhooks/leads -> {UPSTREAM_WEBHOOK_URL}")
                print(f"   Press Ctrl+C to stop.\n")
                httpd.serve_forever()
                break
        except OSError as e:
            if "Address already in use" in str(e):
                continue
            raise

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    serve(port)
