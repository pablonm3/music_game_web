// The request handler: the leaderboard API under /api/, the game's files everywhere else.

import { isValidScore } from './leaderboard.js';
import { createStatic } from './static.js';

const MAX_BODY_BYTES = 1024;

export function createApp({ leaderboard, publicDir }) {
  const serveStatic = createStatic(publicDir);

  return function handle(req, res) {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendJson(res, 400, { error: 'bad_request' });
    }
    if (url.pathname === '/api/leaderboard') return handleLeaderboard(leaderboard, req, res, url);
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });
    // The raw path, not url.pathname: URL parsing would resolve "/../" before the
    // static server can refuse it.
    return serveStatic(req, res, req.url.split('?')[0]);
  };
}

function handleLeaderboard(leaderboard, req, res, url) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const scoreParam = url.searchParams.get('score');
    if (scoreParam === null) return sendJson(res, 200, { entries: leaderboard.entries() });
    const score = /^-?\d+$/.test(scoreParam) ? Number(scoreParam) : NaN;
    if (!isValidScore(score)) return sendJson(res, 400, { error: 'invalid_score' });
    return sendJson(res, 200, { entries: leaderboard.entries(), qualifies: leaderboard.qualifies(score) });
  }

  if (req.method === 'POST') {
    return readBody(req, (error, text) => {
      if (error === 'too_large') return sendJson(res, 413, { error: 'too_large' });
      if (error) return sendJson(res, 400, { error: 'invalid_json' });

      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return sendJson(res, 400, { error: 'invalid_json' });
      }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(res, 400, { error: 'invalid_json' });
      }

      let result;
      try {
        result = leaderboard.add(body.name, body.score);
      } catch {
        return sendJson(res, 500, { error: 'storage' });
      }
      if (result.error === 'not_qualifying') {
        return sendJson(res, 409, { error: result.error, entries: leaderboard.entries() });
      }
      if (result.error) return sendJson(res, 400, { error: result.error });
      return sendJson(res, 201, { entries: leaderboard.entries(), rank: result.rank });
    });
  }

  res.setHeader('Allow', 'GET, HEAD, POST');
  return sendJson(res, 405, { error: 'method_not_allowed' });
}

// Reads the whole body, keeping at most MAX_BODY_BYTES; a longer body is drained and
// reported as too large.
function readBody(req, done) {
  const chunks = [];
  let size = 0;
  let finished = false;
  const finish = (error, text) => {
    if (finished) return;
    finished = true;
    done(error, text);
  };
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  });
  req.on('end', () => {
    if (size > MAX_BODY_BYTES) return finish('too_large');
    finish(null, Buffer.concat(chunks).toString('utf8'));
  });
  req.on('error', () => finish('read_error'));
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}
