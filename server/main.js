// Starts the game server: `npm start`, then http://localhost:8130.
// PORT, HOST and LEADERBOARD_FILE change the defaults.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';
import { openLeaderboard } from './leaderboard.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8130);
const host = process.env.HOST || '127.0.0.1';
const leaderboardFile = process.env.LEADERBOARD_FILE
  ? path.resolve(process.env.LEADERBOARD_FILE)
  : path.join(repoRoot, 'data', 'leaderboard.json');

let leaderboard;
try {
  leaderboard = openLeaderboard(leaderboardFile);
} catch (error) {
  console.error(`music-game-web: ${error.message}`);
  process.exit(1);
}

const server = http.createServer(createApp({ leaderboard, publicDir: path.join(repoRoot, 'public') }));

server.on('error', (error) => {
  console.error(`music-game-web: cannot listen on ${host}:${port}: ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  const shownHost = host === '127.0.0.1' || host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`music-game-web: http://${shownHost}:${port}  (leaderboard file: ${leaderboardFile}; Ctrl-C to stop)`);
});
