# Event Logging & Analytics Reference

How to capture and analyze player behavior.

---

## Overview

The foundation layer includes an event logging system for capturing player choices and behavior. All data stays in the player's browser (IndexedDB) unless you configure external hooks.

---

## Basic Setup

Choice logging is enabled by default in `main.js`. Each choice is logged with:

| Field | Description |
|-------|-------------|
| `choiceIndex` | Which option was selected (0-based) |
| `choiceText` | Text of the selected choice |
| `chatId` | Current chat |
| `knotPath` | Current story position |
| `availableChoices` | Total choices offered |

---

## Querying Logs

In browser DevTools console:

```javascript
// Get choice statistics
await logStore.getChoiceStats();
// → { totalChoices: 42, uniqueSessions: 3, pathDistribution: {...} }

// Query specific session
await logStore.query({ sessionId: logger.getSessionId() });

// Export all data
const data = await logStore.exportJSON();
```

---

## EventLogger API

The `EventLogger` class provides the following public methods:

| Method | Signature | Description |
|--------|-----------|-------------|
| `start(eventTypes)` | `Array<{event, type}>` → `Function` | Subscribe to EventBus events; returns cleanup function |
| `stop()` | none | Unsubscribe from all events |
| `log(type, payload)` | `string`, `Object` → `Promise` | Log an event manually |
| `getSessionId()` | none → `string` | Get current session ID |
| `newSession()` | none → `Promise` | End current session and start new one |
| `getSessionEntries()` | none → `Array` | Get entries from current session (in memory) |
| `getStore()` | none → `EventLogStore` | Access underlying storage backend |

---

## EventLogStore API

The `EventLogStore` class provides IndexedDB-backed storage for analytics events.

**File:** `packages/framework/src/foundation/services/event-log-store.js`

```javascript
import { EventLogStore } from '../foundation/services/event-log-store.js';

const logStore = new EventLogStore({
  retention: { maxAgeDays: 30, maxEntries: 10000 }
});
await logStore.init();
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `init()` | none → `Promise<void>` | Initialize IndexedDB connection (required before use) |
| `add(entry)` | `Object` → `Promise<void>` | Add a log entry |
| `query(filters?)` | `Object` → `Promise<Array>` | Query entries with optional filters |
| `getChoiceStats()` | none → `Promise<Object>` | Get aggregated choice statistics |
| `getSession(sessionId)` | `string` → `Promise<Array>` | Get all entries for a session |
| `exportJSON(filters?)` | `Object` → `Promise<Array>` | Export entries as array |
| `prune()` | none → `Promise<number>` | Apply retention policy; returns deleted count |
| `clear()` | none → `Promise<void>` | Delete all entries |
| `close()` | none | Close database connection |

### Query Filters

```javascript
await logStore.query({
  type: 'choice',           // Filter by event type
  sessionId: 'abc123',      // Filter by session
  since: Date.now() - 86400000,  // After timestamp
  until: Date.now(),        // Before timestamp
  limit: 100                // Max results (default: 1000)
});
```

### Entry Structure

Each log entry has:

```javascript
{
  id: 'unique-id',          // UUID
  type: 'choice',           // Event type
  sessionId: 'session-id',  // Session identifier
  timestamp: 1704067200000, // Unix ms
  payload: { ... },         // Event-specific data
  context: { ... }          // Optional context (day, etc.)
}
```

### Choice Statistics

```javascript
const stats = await logStore.getChoiceStats();
// {
//   totalChoices: 42,
//   uniqueSessions: 3,
//   pathDistribution: {
//     'pat_chat': { 0: { count: 15, text: 'Yes' }, 1: { count: 27, text: 'No' } }
//   }
// }
```

---

## Custom Event Logging

Log custom events beyond choices:

```javascript
// In your code
logger.log('navigation', {
  from: 'hub',
  to: 'pat',
});

logger.log('custom', {
  action: 'viewedHint',
  hintId: 'hint-123',
});

// Session management
const sessionId = logger.getSessionId();
const entries = logger.getSessionEntries();
await logger.newSession(); // Triggers onSessionEnd hook

// Direct store access
const store = logger.getStore();
await store.query({ type: 'choice' });
```

---

## Cross-Player Analytics

For centralized analytics, configure hooks when creating the logger:

```javascript
const logger = new EventLogger({
  store: logStore,
  eventBus,
  getContext: () => ({ day: timeContext.getDay() }),

  // Real-time streaming
  onEvent: async (entry) => {
    await fetch('https://your-analytics.example/events', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },

  // Batch on session end
  onSessionEnd: async ({ sessionId, entries }) => {
    await fetch('https://your-analytics.example/batch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, entries }),
    });
  },
});
```

---

## Demo Analytics Collector

Reference implementations are provided in `utils/analytics-collector/` with **zero dependencies** (stdlib only):

**Node.js:**
```bash
cd utils/analytics-collector/node
node server.js  # http://localhost:3001
```

**Python:**
```bash
cd utils/analytics-collector/python
python server.py  # http://localhost:3001
```

Both expose identical endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/events` | POST | Single event |
| `/batch` | POST | Batch upload |
| `/stats` | GET | Full aggregated statistics |
| `/stats/choices?choice=knot:0` | GET | Per-choice stats |
| `/sessions` | GET | Session summaries |

---

## Community Stats (Telltale-Style)

Show players what percentage chose each option:

```javascript
import { CommunityService } from '../foundation/services/index.js';

const community = new CommunityService({
  endpoint: 'http://localhost:3001',
});

// Fetch stats for specific choices
const stats = await community.getChoiceStats(['interrogation:0', 'interrogation:1']);
// → Map { "interrogation:0" => { total: 142, percentage: 67 } }

// Or single choice
const stat = await community.getChoiceStat('interrogation', 0);
// → { total: 142, percentage: 67 }
```

**Privacy note:** Only sends choice IDs to server (no session data). Responses are cached for 1 minute.

---

## Reliable Exit Capture

Analytics uses beacon API to capture session end even on abrupt tab close:

```javascript
import { setupExitTracking, sendBatch } from '../foundation/services/index.js';

// Setup automatic exit tracking
const cleanup = setupExitTracking(logger, runtime, config);

// Manual batch send
await sendBatch(sessionId, entries, { endpoint: 'http://...' });
```

Events tracked: `pagehide`, `beforeunload`, `visibilitychange` (hidden).

---

## Data Retention

By default, logs are pruned to:
- Max 30 days old
- Max 10,000 entries

Configure via:
```javascript
const logStore = new EventLogStore({
  retention: { maxAgeDays: 7, maxEntries: 5000 }
});
```

---

## TOML Configuration

Analytics can be enabled via config:

```toml
[analytics]
enabled = true
endpoint = "http://localhost:3001"

[analytics.retention]
max_age_days = 7
max_entries = 5000
```

---

## Files

| File | Purpose |
|------|---------|
| `packages/framework/src/foundation/services/event-log-store.js` | IndexedDB storage |
| `packages/framework/src/foundation/services/event-logger.js` | Logging service |
| `experiences/{impl}/main.js` | Initialization |
| `utils/analytics-collector/` | Demo server |

---

## Related

- [TOML Schema](toml-schema.md) - Analytics configuration
- [Framework vs Content](../concepts/framework-vs-content.md) - Foundation layer services
