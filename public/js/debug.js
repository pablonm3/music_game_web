// Test mode, loaded only with ?debug=1: the clock of the screen on show stands still
// (main.js does not run it), a status line shows the state as text, and window.mg drives
// the clock:
//   mg.advance(ms)   runs the clock of the screen on show: on the game screen the game's,
//                    and with it every timed effect; on the legend its writing
//   mg.game          the state object of the current game (a new one after every PLAY;
//                    null while the legend shows)

import { isExpiring, isSafe } from './game.js';

export function installDebug({ getGame, getScreen, audio }) {
  const line = document.createElement('div');
  line.id = 'debug';
  document.body.append(line);

  window.mg = {
    get game() {
      return getGame();
    },
    advance(ms) {
      getScreen().onTime?.(ms);
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
// The shrooms are game.hearts in the code. A screen may add its own part (the legend:
// `written=<n>/<total>`).
function statusText(screen, game, sound) {
  const parts = ['DEBUG', `screen=${screen.name}`];
  if (screen.status) parts.push(screen.status());
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
