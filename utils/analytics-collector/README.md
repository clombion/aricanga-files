# Analytics Collector

Demo server for aggregating player analytics from multiple game sessions.

**Zero dependencies** - both implementations use stdlib only.

## Choose Your Implementation

| | Node.js | Python |
|---|---------|--------|
| **Directory** | `node/` | `python/` |
| **Start command** | `node server.js` | `python server.py` |
| **Requirements** | Node.js 18+ | Python 3.10+ |
| **Dependencies** | None (native `http`) | None (native `http.server`) |

Both implementations:
- Run on http://localhost:3001 by default
- Expose identical API endpoints
- Return identical JSON responses
- Support CORS out of the box

## Quick Start

**Node.js:**
```bash
cd node
node server.js
```

**Python:**
```bash
cd python
python server.py
```

## API Endpoints

All endpoints are identical between implementations.

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events` | Single event (real-time) |
| POST | `/batch` | Batch upload (session end) |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Aggregated choice statistics (full) |
| GET | `/stats/choices?choice=knot:0` | Per-choice statistics (Telltale-style) |
| GET | `/sessions` | Session summaries |
| GET | `/top-paths?limit=N` | Most visited paths |

### Debug

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | Raw events (filterable) |
| DELETE | `/events` | Clear all events |
| GET | `/health` | Health check |

## Example Usage

```bash
# Test event ingestion
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{"type":"choice","sessionId":"test-123","timestamp":1705500000000,"payload":{"choiceIndex":1,"choiceText":"Ask about it","knotPath":"pat_chat.start"}}'

# Get full statistics
curl http://localhost:3001/stats

# Get per-choice statistics (Telltale-style)
curl "http://localhost:3001/stats/choices?choice=pat_chat:0&choice=pat_chat:1"

# Get session summaries
curl http://localhost:3001/sessions

# Get top paths
curl "http://localhost:3001/top-paths?limit=5"

# Clear all data
curl -X DELETE http://localhost:3001/events
```

## Wiring Up the Game

Configure the EventLogger in `main.js` with hooks:

```javascript
const logger = new EventLogger({
  store: logStore,
  eventBus,
  getContext: () => ({
    day: timeContext.getDay(),
    storyTime: timeContext.format(),
  }),

  // Real-time streaming (optional)
  onEvent: async (entry) => {
    await fetch('http://localhost:3001/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  },

  // Batch on session end (optional)
  onSessionEnd: async ({ sessionId, entries }) => {
    await fetch('http://localhost:3001/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, entries }),
    });
  },
});
```

## Enabling Analytics in the Game

Analytics is disabled by default. Two ways to enable:

### Option 1: Edit TOML (permanent)

In `src/experiences/{impl}/data/base-config.toml`:

```toml
[analytics]
enabled = true
endpoint = "http://localhost:3001"
```

Then rebuild: `mise run build:config`

### Option 2: Environment variables (CI/build-time)

```bash
ANALYTICS_ENABLED=true \
ANALYTICS_ENDPOINT=http://localhost:3001 \
mise run build:config
```

Env vars override TOML values. Useful for CI where you want different configs per environment without changing files.

## Production Considerations

This is a demo server with in-memory storage. For production:

- Use a persistent database (SQLite, PostgreSQL, etc.)
- Add authentication for the API
- Consider rate limiting
- Deploy behind HTTPS
- Add data retention policies
