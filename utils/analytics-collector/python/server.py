#!/usr/bin/env python3
"""Demo analytics collector server (stdlib only - no external dependencies).

Aggregates player events from multiple sessions.
"""

import json
import os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any
from urllib.parse import urlparse, parse_qs

from aggregate import (
    compute_choice_stats,
    compute_path_stats,
    compute_session_summaries,
    top_paths,
)

PORT = int(os.environ.get("PORT", 3001))

# In-memory storage (use a real database for production)
db: list[dict[str, Any]] = []


class AnalyticsHandler(BaseHTTPRequestHandler):
    """HTTP request handler for analytics endpoints."""

    def _set_cors_headers(self) -> None:
        """Set CORS headers for all responses."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data: Any, status: int = 200) -> None:
        """Send JSON response with CORS headers."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_status(self, status: int) -> None:
        """Send status-only response with CORS headers."""
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _read_body(self) -> dict[str, Any] | None:
        """Read and parse JSON body from request."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return None
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8"))

    def _log(self, message: str) -> None:
        """Log timestamped message."""
        timestamp = datetime.now().isoformat()
        print(f"[{timestamp}] {message}")

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self._send_status(204)

    def do_POST(self) -> None:
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            # POST /events - Real-time single event ingestion
            if path == "/events":
                entry = self._read_body()

                if not entry or not entry.get("type") or not entry.get("sessionId"):
                    self._send_json(
                        {"error": "Invalid event: requires type and sessionId"}, 400
                    )
                    return

                db.append(entry)
                self._log(f"Event: {entry['type']} from {entry['sessionId']}")
                self._send_status(200)
                return

            # POST /batch - Batch session upload
            if path == "/batch":
                body = self._read_body() or {}
                session_id = body.get("sessionId")
                entries = body.get("entries")

                if not entries or not isinstance(entries, list):
                    self._send_json(
                        {"error": "Invalid batch: requires entries array"}, 400
                    )
                    return

                db.extend(entries)
                self._log(f"Batch: {len(entries)} events from {session_id}")
                self._send_status(200)
                return

            # 404 Not Found
            self._send_json({"error": "Not Found"}, 404)

        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON"}, 400)
        except Exception as e:
            self._log(f"Error: {e}")
            self._send_json({"error": str(e)}, 500)

    def do_GET(self) -> None:
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            # GET /stats - Aggregated choice statistics
            if path == "/stats":
                self._send_json(compute_path_stats(db))
                return

            # GET /stats/choices - Telltale-style choice statistics
            # Query: ?choice=knot:0&choice=knot:1
            if path == "/stats/choices":
                choice_ids = query.get("choice", [])

                if not choice_ids:
                    self._send_json(
                        {"error": "No choice IDs provided. Use ?choice=knot:0"}, 400
                    )
                    return

                self._send_json(compute_choice_stats(db, choice_ids))
                return

            # GET /sessions - Session summaries
            if path == "/sessions":
                self._send_json(compute_session_summaries(db))
                return

            # GET /top-paths - Most visited paths
            if path == "/top-paths":
                limit = int(query.get("limit", ["10"])[0])
                self._send_json(top_paths(db, limit))
                return

            # GET /events - Raw events (for debugging)
            if path == "/events":
                limit = int(query.get("limit", ["100"])[0])
                event_type = query.get("type", [None])[0]
                session_id = query.get("sessionId", [None])[0]

                filtered = db

                if event_type:
                    filtered = [e for e in filtered if e.get("type") == event_type]
                if session_id:
                    filtered = [e for e in filtered if e.get("sessionId") == session_id]

                self._send_json(filtered[-limit:])
                return

            # GET /health - Health check
            if path == "/health":
                self._send_json({"status": "ok", "eventCount": len(db)})
                return

            # 404 Not Found
            self._send_json({"error": "Not Found"}, 404)

        except Exception as e:
            self._log(f"Error: {e}")
            self._send_json({"error": str(e)}, 500)

    def do_DELETE(self) -> None:
        """Handle DELETE requests."""
        parsed = urlparse(self.path)
        path = parsed.path

        # DELETE /events - Clear all events (for testing)
        if path == "/events":
            db.clear()
            self._log("Events cleared")
            self._send_status(200)
            return

        # 404 Not Found
        self._send_json({"error": "Not Found"}, 404)

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress default HTTP logging (we do our own)."""
        pass


def main() -> None:
    """Start the analytics collector server."""
    server = HTTPServer(("", PORT), AnalyticsHandler)

    print(f"Analytics collector running on http://localhost:{PORT}")
    print()
    print("Endpoints:")
    print("  POST /events        - Ingest single event")
    print("  POST /batch         - Ingest batch of events")
    print("  GET  /stats         - Choice statistics (full)")
    print("  GET  /stats/choices - Choice statistics by ID (Telltale-style)")
    print("  GET  /sessions      - Session summaries")
    print("  GET  /top-paths     - Most visited paths")
    print("  GET  /events        - Raw events (debug)")
    print("  DELETE /events      - Clear all events")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
