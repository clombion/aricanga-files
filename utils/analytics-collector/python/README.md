# Analytics Collector (Python)

Demo analytics server using Python stdlib only - **zero dependencies**.

## Quick Start

```bash
python server.py
```

Server runs on http://localhost:3001

No `pip install` required - uses native `http.server` module.

Requires Python 3.10+ (for type hint syntax).

## API Endpoints

### Ingestion

**POST /events** - Single event (real-time streaming)
```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"type":"choice","sessionId":"abc","payload":{"choiceIndex":1}}'
```

**POST /batch** - Batch upload (session end)
```bash
curl -X POST http://localhost:3001/batch \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc","entries":[...]}'
```

### Analytics

**GET /stats** - Aggregated choice statistics
```json
{
  "totalChoices": 42,
  "uniqueSessions": 5,
  "pathDistribution": {
    "pat_chat.inquiry": {
      "0": { "count": 3, "text": "Ask about the contract" },
      "1": { "count": 2, "text": "Change the subject" }
    }
  }
}
```

**GET /sessions** - Session summaries
```json
[
  {
    "sessionId": "session-abc",
    "startTime": 1705500000000,
    "endTime": 1705501000000,
    "choiceCount": 15,
    "paths": ["pat_chat.start", "pat_chat.inquiry"],
    "durationMs": 1000000
  }
]
```

**GET /top-paths?limit=10** - Most visited paths

### Debug

**GET /events** - Raw events (supports `?type=choice&sessionId=abc&limit=100`)
**DELETE /events** - Clear all stored events
**GET /health** - Health check

## Files

- `server.py` - HTTP server using `http.server` module
- `aggregate.py` - Analytics computation functions

## Environment Variables

- `PORT` - Server port (default: 3001)
