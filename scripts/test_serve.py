#!/usr/bin/env python3
"""
Unit test for RangedHTTPRequestHandler logic.
Tests:
- MIME types (WebP, WOFF2, MP4, CSS, HTML)
- HTTP 200 OK responses
- HTTP 206 Partial Content (Range requests)
- CORS OPTIONS preflight
- Lead webhook proxy routing
"""

import io
import json
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Import handler from serve.py
sys.path.insert(0, str(Path(__file__).parent))
from serve import RangedHTTPRequestHandler, SITE_DIR

def test_handler():
    print("Testing RangedHTTPRequestHandler...")

    # Mock socket and request
    class MockSocket:
        def __init__(self, data):
            self.rfile = io.BytesIO(data)
            self.wfile = io.BytesIO()

        def makefile(self, mode, *args, **kwargs):
            if 'b' in mode:
                if 'r' in mode:
                    return self.rfile
                return self.wfile
            raise ValueError(mode)

        def sendall(self, data):
            self.wfile.write(data)

    def simulate_request(req_str):
        sock = MockSocket(req_str.encode("utf-8"))
        handler = RangedHTTPRequestHandler(sock, ("127.0.0.1", 54321), None)
        return sock.wfile.getvalue().decode("latin-1", errors="replace")

    # 1. Test GET /
    print("  Testing GET / (index.html)...")
    resp = simulate_request("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
    assert "200 OK" in resp, f"Expected 200 OK, got:\n{resp[:200]}"
    assert "Content-Type: text/html" in resp, "Expected text/html content type"
    print("  ✓ GET / returned 200 OK with text/html")

    # 2. Test GET WebP frame
    print("  Testing GET /assets/frames/f0001.webp...")
    resp = simulate_request("GET /assets/frames/f0001.webp HTTP/1.1\r\nHost: localhost\r\n\r\n")
    assert "200 OK" in resp, f"Expected 200 OK, got:\n{resp[:200]}"
    assert "Content-Type: image/webp" in resp, f"Expected image/webp, got:\n{resp[:300]}"
    print("  ✓ WebP MIME type verified as image/webp")

    # 3. Test GET WOFF2 font
    print("  Testing GET /assets/fonts/f1.woff2...")
    resp = simulate_request("GET /assets/fonts/f1.woff2 HTTP/1.1\r\nHost: localhost\r\n\r\n")
    assert "200 OK" in resp
    assert "Content-Type: font/woff2" in resp, f"Expected font/woff2, got:\n{resp[:300]}"
    print("  ✓ Font MIME type verified as font/woff2")

    # 4. Test Range request on video
    print("  Testing Range: bytes=0-1023 on /assets/video/hero.mp4...")
    resp = simulate_request("GET /assets/video/hero.mp4 HTTP/1.1\r\nHost: localhost\r\nRange: bytes=0-1023\r\n\r\n")
    assert "206 Partial Content" in resp, f"Expected 206 Partial Content, got:\n{resp[:200]}"
    assert "Content-Type: video/mp4" in resp, "Expected video/mp4"
    assert "Content-Range: bytes 0-1023/" in resp, "Expected Content-Range bytes 0-1023"
    assert "Content-Length: 1024" in resp, "Expected Content-Length: 1024"
    print("  ✓ HTTP 206 Partial Content range request verified for video")

    # 5. Test OPTIONS on /api/webhooks/leads (CORS Preflight)
    print("  Testing OPTIONS /api/webhooks/leads...")
    resp = simulate_request("OPTIONS /api/webhooks/leads HTTP/1.1\r\nHost: localhost\r\n\r\n")
    assert "200 OK" in resp, "Expected 200 OK for OPTIONS preflight"
    assert "Access-Control-Allow-Origin: *" in resp, "Expected Access-Control-Allow-Origin header"
    assert "Access-Control-Allow-Methods" in resp, "Expected Access-Control-Allow-Methods header"
    print("  ✓ OPTIONS preflight returns 200 OK with CORS headers")

    # 6. Test POST /api/webhooks/leads proxy logic (mocked upstream response)
    print("  Testing POST /api/webhooks/leads (proxy handler)...")
    test_lead = {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "2105550123",
        "Postal": "78233",
        "Source": "Website",
        "Product": "Bathroom - Remodel"
    }
    lead_json = json.dumps(test_lead)

    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps({"success": True, "message": "Lead created successfully"}).encode("utf-8")

    with patch("urllib.request.urlopen", return_value=mock_resp):
        req_str = f"POST /api/webhooks/leads HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {len(lead_json)}\r\n\r\n{lead_json}"
        resp = simulate_request(req_str)
        assert "200 OK" in resp, f"Expected 200 OK from webhook proxy, got:\n{resp[:250]}"
        assert "Access-Control-Allow-Origin: *" in resp, "Expected CORS allow origin header"
        assert "Lead created successfully" in resp, "Expected success response payload"
        print("  ✓ POST /api/webhooks/leads proxy successfully forwards and returns 200 OK with CORS headers")

    print("\n✅ All handler and webhook unit tests passed successfully!")

if __name__ == "__main__":
    test_handler()
