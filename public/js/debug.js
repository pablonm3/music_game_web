// Test mode, loaded only with ?debug=1: the game clock stands still (main.js does not
// advance it), a status line shows the state as text, and window.mg drives the clock:
//   mg.advance(ms)   runs the clock of the current game, and with it every timed effect
//   mg.game          the state object of the current game (a new one after every PLAY)

import { advance, isExpiring, isSafe } from './game.js';

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

// The state as text. Cells are x,y; a shooter's ends in `s`, a lying bomb that flickers
// in `f`; `thrown=` lists the landing cells of bombs in the air; `-` is an empty list.
// The shrooms are game.hearts in the code.
function statusText(screen, game, sound) {
  const parts = ['DEBUG', `screen=${screen}`];
  if (game) {
    parts.push(
      `t=${Math.round(game.time)}ms`,
      `score=${game.score}`,
      `lives=${game.lives}`,
      `bombs=${game.bombs}`,
      `goal=${game.goal}`,
      `player=${at(game.player)}`,
    );
    if (isSafe(game)) parts.push(`safe=${Math.round(game.player.safeUntil - game.time)}ms`);
    parts.push(
      `enemies=${list(game.enemies, (enemy) => at(enemy) + (enemy.shooter ? 's' : ''))}`,
      `shrooms=${list(game.hearts, (heart) => `${heart.colour}@${at(heart)}`)}`,
      `lying=${list(game.lyingBombs, (bomb) => at(bomb) + (isExpiring(game, bomb) ? 'f' : ''))}`,
      `thrown=${list(game.thrownBombs, at)}`,
      `projectiles=${list(game.projectiles, at)}`,
    );
    if (game.over) parts.push('over');
  }
  parts.push(`music=${sound.track} ${sound.playing ? 'playing' : 'stopped'}`);
  parts.push(`sounds=${sound.sounds.join(',') || '-'}`);
  return parts.join(' ');
}

function at(piece) {
  return `${piece.x},${piece.y}`;
}

function list(items, describe) {
  return items.map(describe).join(' ') || '-';
}
