import http.server
import socketserver
import sys

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

# Fix potential MIME type mapping issues for ES6 JS modules on some systems
Handler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
})

print("=" * 50)
print(" FIZZZIO LOCAL DEVELOPMENT SERVER")
print("=" * 50)
print(f"Server is starting on port {PORT}...")
print(f"URL: http://localhost:{PORT}")
print("Press CTRL+C to stop the server.")
print("=" * 50)

# Allow port reuse so restarting the server is instant
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n[System] Server stopped by user.")
    sys.exit(0)
except Exception as e:
    print(f"\n[Error] Failed to start server: {e}")
    sys.exit(1)
