// Serves the files under public/ with byte ranges (Safari fetches audio in ranges).

import fs from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
};

export function createStatic(publicDir) {
  const root = path.resolve(publicDir);

  return function serveStatic(req, res, pathname) {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return sendText(res, 405, 'method not allowed');
    }

    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return sendText(res, 400, 'bad request');
    }
    if (decoded.includes('\0')) return sendText(res, 400, 'bad request');

    const file = path.join(root, decoded === '/' ? 'index.html' : decoded);
    if (!file.startsWith(root + path.sep)) return sendText(res, 404, 'not found');

    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      return sendText(res, 404, 'not found');
    }
    if (!stat.isFile()) return sendText(res, 404, 'not found');

    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    // Audio and images change only under a new name, so a browser may keep them for a day.
    const cachedForADay = decoded.startsWith('/audio/') || decoded.startsWith('/img/');
    res.setHeader('Cache-Control', cachedForADay ? 'public, max-age=86400' : 'no-cache');

    const range = parseRange(req.headers.range, stat.size);
    if (range === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return sendText(res, 416, 'range not satisfiable');
    }

    const { start, end } = range ?? { start: 0, end: stat.size - 1 };
    if (range) {
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    } else {
      res.statusCode = 200;
    }
    res.setHeader('Content-Length', stat.size === 0 ? 0 : end - start + 1);

    if (req.method === 'HEAD' || stat.size === 0) return res.end();
    fs.createReadStream(file, { start, end })
      .on('error', () => res.destroy())
      .pipe(res);
  };
}

// Returns {start, end} for one satisfiable range, 'unsatisfiable', or null to send the
// whole file (no header, or a form this server does not handle, such as several ranges).
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;

  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (match[2] !== '' && Number(match[2]) < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}

function sendText(res, status, text) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(text);
}
