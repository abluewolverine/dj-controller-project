#!/usr/bin/env python3
"""
Simple standalone server for OMNI DJ Controller
No backend dependencies required - runs completely client-side
"""
import http.server
import socketserver
import os
import sys

PORT = 8080

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def end_headers(self):
        # Add headers to prevent CORS issues
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

def main():
    # Try different ports if 8080 is busy
    for port in [8080, 8081, 8082, 3000, 3001]:
        try:
            with socketserver.TCPServer(("", port), CustomHandler) as httpd:
                print(f"\n🎛️  OMNI DJ CONTROLLER RUNNING!")
                print(f"🌐 Open: http://localhost:{port}")
                print(f"📁 Serving from: {os.path.dirname(os.path.abspath(__file__))}")
                print(f"⚡ Features: Custom Code, Themes, Presets (Local Storage)")
                print(f"🛑 Press Ctrl+C to stop\n")
                httpd.serve_forever()
        except OSError as e:
            if e.errno == 98:  # Address already in use
                continue
            else:
                raise
    
    print("❌ All ports busy! Try stopping other servers first.")
    sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 OMNI DJ Controller stopped. Thanks for using!")
        sys.exit(0)