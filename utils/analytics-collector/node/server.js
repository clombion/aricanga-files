// Demo analytics collector server (stdlib only - no external dependencies)
// Aggregates player events from multiple sessions

import { createServer } from 'node:http';
import {
  computeChoiceStats,
  computePathStats,
  computeSessionSummaries,
  topPaths,
} from './aggregate.js';

const PORT = process.env.PORT || 3001;

// In-memory storage (use a real database for production)
const db = [];

/**
 * Parse JSON body from request
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Parse query string from URL
 * @param {string} urlString
 * @returns {{ pathname: string, query: Record<string, string> }}
 */
function parseUrl(urlString) {
  const url = new URL(urlString, 'http://localhost');
  const query = Object.fromEntries(url.searchParams);
  return { pathname: url.pathname, query };
}

/**
 * Send JSON response with CORS headers
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Send status response with CORS headers
 */
function sendStatus(res, status) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

const server = createServer(async (req, res) => {
  const { pathname, query } = parseUrl(req.url || '/');
  const method = req.method || 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return sendStatus(res, 204);
  }

  try {
    // POST /events - Real-time single event ingestion
    if (method === 'POST' && pathname === '/events') {
      const entry = await parseBody(req);

      if (!entry || !entry.type || !entry.sessionId) {
        return sendJson(res, { error: 'Invalid event: requires type and sessionId' }, 400);
      }

      db.push(entry);
      console.log(`[${new Date().toISOString()}] Event: ${entry.type} from ${entry.sessionId}`);
      return sendStatus(res, 200);
    }

    // POST /batch - Batch session upload
    if (method === 'POST' && pathname === '/batch') {
      const body = await parseBody(req);
      const { sessionId, entries } = body || {};

      if (!entries || !Array.isArray(entries)) {
        return sendJson(res, { error: 'Invalid batch: requires entries array' }, 400);
      }

      entries.forEach((e) => db.push(e));
      console.log(`[${new Date().toISOString()}] Batch: ${entries.length} events from ${sessionId}`);
      return sendStatus(res, 200);
    }

    // GET /stats - Aggregated choice statistics
    if (method === 'GET' && pathname === '/stats') {
      return sendJson(res, computePathStats(db));
    }

    // GET /stats/choices - Telltale-style choice statistics
    // Query: ?choice=knot:0&choice=knot:1
    if (method === 'GET' && pathname === '/stats/choices') {
      const url = new URL(req.url, 'http://localhost');
      const choiceIds = url.searchParams.getAll('choice');

      if (choiceIds.length === 0) {
        return sendJson(res, { error: 'No choice IDs provided. Use ?choice=knot:0' }, 400);
      }

      return sendJson(res, computeChoiceStats(db, choiceIds));
    }

    // GET /sessions - Session summaries
    if (method === 'GET' && pathname === '/sessions') {
      return sendJson(res, computeSessionSummaries(db));
    }

    // GET /top-paths - Most visited paths
    if (method === 'GET' && pathname === '/top-paths') {
      const limit = parseInt(query.limit, 10) || 10;
      return sendJson(res, topPaths(db, limit));
    }

    // GET /events - Raw events (for debugging)
    if (method === 'GET' && pathname === '/events') {
      const limit = parseInt(query.limit, 10) || 100;
      const type = query.type;
      const sessionId = query.sessionId;

      let filtered = db;

      if (type) {
        filtered = filtered.filter((e) => e.type === type);
      }
      if (sessionId) {
        filtered = filtered.filter((e) => e.sessionId === sessionId);
      }

      return sendJson(res, filtered.slice(-limit));
    }

    // DELETE /events - Clear all events (for testing)
    if (method === 'DELETE' && pathname === '/events') {
      db.length = 0;
      console.log(`[${new Date().toISOString()}] Events cleared`);
      return sendStatus(res, 200);
    }

    // GET /health - Health check
    if (method === 'GET' && pathname === '/health') {
      return sendJson(res, { status: 'ok', eventCount: db.length });
    }

    // 404 Not Found
    return sendJson(res, { error: 'Not Found' }, 404);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    return sendJson(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Analytics collector running on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /events        - Ingest single event');
  console.log('  POST /batch         - Ingest batch of events');
  console.log('  GET  /stats         - Choice statistics (full)');
  console.log('  GET  /stats/choices - Choice statistics by ID (Telltale-style)');
  console.log('  GET  /sessions      - Session summaries');
  console.log('  GET  /top-paths     - Most visited paths');
  console.log('  GET  /events        - Raw events (debug)');
  console.log('  DELETE /events      - Clear all events');
  console.log('');
});
