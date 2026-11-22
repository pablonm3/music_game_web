// Test mode, loaded only with ?debug=1: the game clock stands still (main.js does not
// advance it), a status line shows the state as text, and window.mg drives the clock:
//   mg.advance(ms)   runs the clock of the current game
//   mg.game          the state object of the current game (a new one after every PLAY)

import { advance } from './game.js';

export function installDebug({ getGame, getScreen, audio }) {
  const line = document.createElement('div');
  line.id = 'debug';
  document.body.append(line);

  window.mg = {
    get game() {
      return getGame();
    },
    advance(ms) {
      const game = getGame();
      if (game) advance(game, ms);
    },
  };

  return {
    update() {
      const text = statusText(getScreen(), getGame(), audio.status());
      if (line.textContent !== text) line.textContent = text;
    },
  };
}

function statusText(screen, game, sound) {
  const parts = ['DEBUG', `screen=${screen}`];
  if (game) {
    parts.push(
      `t=${Math.round(game.time)}ms`,
      `score=${game.score}`,
      `goal=${game.goal}`,
      `player=${game.player.x},${game.player.y}`,
      `enemies=${game.enemies.map((enemy) => `${enemy.x},${enemy.y}`).join(' ')}`,
      `hearts=${game.hearts.map((heart) => `${heart.colour}@${heart.x},${heart.y}`).join(' ')}`,
    );
    if (game.over) parts.push('over');
  }
  parts.push(`music=${sound.track} ${sound.playing ? 'playing' : 'stopped'}`);
  parts.push(`sounds=${sound.sounds.join(',') || '-'}`);
  return parts.join(' ');
}
