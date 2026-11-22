// Starts the app on a free port with a leaderboard file in a new temp folder.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../server/app.js';
import { openLeaderboard } from '../../server/leaderboard.js';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const publicDir = path.join(repoRoot, 'public');

const tempDirs = [];
process.on('exit', () => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// A path in a new temp folder, removed when the test process exits. The file itself is
// not created.
export function tempFile(name = 'leaderboard.json') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgw-test-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

export async function startApp({ file = tempFile() } = {}) {
  const leaderboard = openLeaderboard(file);
  const server = http.createServer(createApp({ leaderboard, publicDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    file,
    port,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// A request with the path sent exactly as given (fetch would normalise "/../").
export function rawRequest(port, { method = 'GET', path: requestPath, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: requestPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}
