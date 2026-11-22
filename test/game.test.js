import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, chase, COLOURS, createGame, press, setRepeat } from '../public/js/game.js';

// Returns the given values in order, then `rest` forever.
function scripted(values, rest = 0.5) {
  let i = 0;
  return () => (i < values.length ? values[i++] : rest);
}

// A game with the hearts and enemy moved out of the way, the goal set, events emptied.
function quietGame({ goal = 'red' } = {}) {
  const game = createGame();
  game.hearts.forEach((heart, i) => Object.assign(heart, { x: 90 + i, y: 30 }));
  game.enemies[0].x = 2;
  game.enemies[0].y = 1;
  game.enemies[0].nextStepAt = Infinity;
  game.goal = goal;
  game.events.length = 0;
  return game;
}

const cell = (piece) => [piece.x, piece.y];
const heart = (game, colour) => game.hearts.find((h) => h.colour === colour);

describe('start state', () => {
  it('has the player, one enemy, three hearts, score 0 and the goal voice', () => {
    // hearts: red (0.10, 0.10), blue (0.50, 0.50), cyan (0.98, 0.99); goal 0.4 → blue
    const game = createGame(scripted([0.1, 0.1, 0.5, 0.5, 0.98, 0.99, 0.4]));
    assert.deepEqual(cell(game.player), [50, 17]);
    assert.equal(game.enemies.length, 1);
    assert.deepEqual(cell(game.enemies[0]), [33, 17]);
    assert.deepEqual(game.hearts.map((h) => h.colour), COLOURS);
    assert.deepEqual(game.hearts.map(cell), [[10, 3], [50, 17], [98, 1]]);
    assert.equal(game.score, 0);
    assert.equal(game.goal, 'blue');
    assert.deepEqual(game.events, ['voice-blue']);
    assert.equal(game.over, false);
  });

  it('places hearts on playable cells only, with the original formula', () => {
    // floor(0.0 * 100) = 0 → 99, floor(0.0 * 35) = 0 → 30; floor(0.999 * 35) = 34 → 1
    const game = createGame(scripted([0, 0, 0.015, 0.999, 0.999, 0.9]));
    assert.deepEqual(game.hearts.map(cell), [[99, 30], [99, 1], [99, 1]]);
    for (let i = 0; i < 200; i += 1) {
      for (const h of createGame().hearts) {
        assert.ok(h.x >= 2 && h.x <= 99 && h.y >= 1 && h.y <= 30, `${h.x},${h.y}`);
      }
    }
  });
});

describe('player movement', () => {
  it('moves one cell in each of the eight directions', () => {
    const moves = {
      up: [50, 16], down: [50, 18], left: [49, 17], right: [51, 17],
      upLeft: [49, 16], upRight: [51, 16], downLeft: [49, 18], downRight: [51, 18],
    };
    for (const [dir, expected] of Object.entries(moves)) {
      const game = quietGame();
      press(game, dir);
      assert.deepEqual(cell(game.player), expected, dir);
    }
  });

  it('ignores an unknown direction', () => {
    const game = quietGame();
    press(game, 'sideways');
    assert.deepEqual(cell(game.player), [50, 17]);
    assert.equal(game.held, null);
  });

  it('wraps around the four edges and a corner', () => {
    const cases = [
      [[2, 10], 'left', [99, 10]],
      [[99, 10], 'right', [2, 10]],
      [[40, 1], 'up', [40, 30]],
      [[40, 30], 'down', [40, 1]],
      [[2, 1], 'upLeft', [99, 30]],
    ];
    for (const [start, dir, expected] of cases) {
      const game = quietGame();
      Object.assign(game.player, { x: start[0], y: start[1] });
      press(game, dir);
      assert.deepEqual(cell(game.player), expected, `${start} ${dir}`);
    }
  });
});

describe('held direction', () => {
  it('moves a second cell 180 ms after the press, then one every 60 ms', () => {
    const game = quietGame();
    press(game, 'right');
    assert.equal(game.player.x, 51);
    advance(game, 179);
    assert.equal(game.player.x, 51);
    advance(game, 1);
    assert.equal(game.player.x, 52);
    advance(game, 60);
    assert.equal(game.player.x, 53);
    advance(game, 60);
    assert.equal(game.player.x, 54);
    setRepeat(game, null);
    advance(game, 500);
    assert.equal(game.player.x, 54);
  });

  it('moves one cell for a press released before 180 ms', () => {
    const game = quietGame();
    press(game, 'up');
    advance(game, 100);
    setRepeat(game, null);
    advance(game, 500);
    assert.deepEqual(cell(game.player), [50, 16]);
  });

  it('gives a long advance the same cells as many short ones', () => {
    const game = quietGame();
    press(game, 'right');
    advance(game, 300); // 180, 240, 300
    assert.equal(game.player.x, 54);
  });

  it('changes the direction of the next repeat on setRepeat, not its time', () => {
    const game = quietGame();
    press(game, 'right');       // 51,17; next repeat at 180
    advance(game, 100);
    setRepeat(game, 'down');
    advance(game, 79);
    assert.deepEqual(cell(game.player), [51, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.player), [51, 18]);
  });

  it('starts a fresh 180 ms when a new press comes while another direction is held', () => {
    const game = quietGame();
    press(game, 'right');
    advance(game, 150);
    press(game, 'down');        // 51,18 at once; next repeat at 330
    assert.deepEqual(cell(game.player), [51, 18]);
    advance(game, 179);
    assert.deepEqual(cell(game.player), [51, 18]);
    advance(game, 1);
    assert.deepEqual(cell(game.player), [51, 19]);
  });

  it('waits 180 ms when a direction starts repeating after nothing was', () => {
    const game = quietGame();
    advance(game, 5000);
    setRepeat(game, 'left');
    advance(game, 179);
    assert.deepEqual(cell(game.player), [50, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.player), [49, 17]);
  });
});

describe('hearts and score', () => {
  it('takes the goal heart: +5, goal sound, heart moved, new goal and its voice', () => {
    // after the start: the goal heart goes to (80, 28), the new goal is cyan
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.8, 0.8, 0.9]);
    Object.assign(heart(game, 'red'), { x: 51, y: 17 });
    press(game, 'right');
    assert.equal(game.score, 5);
    assert.deepEqual(cell(heart(game, 'red')), [80, 28]);
    assert.equal(game.goal, 'cyan');
    assert.deepEqual(game.events, ['goal', 'voice-cyan']);
  });

  it('takes another heart: -15 and the error sound, the goal stays and is not repeated', () => {
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.8, 0.8]);
    Object.assign(heart(game, 'blue'), { x: 51, y: 17 });
    press(game, 'right');
    assert.equal(game.score, -15, 'the score can go below zero');
    assert.deepEqual(cell(heart(game, 'blue')), [80, 28]);
    assert.equal(game.goal, 'red');
    assert.deepEqual(game.events, ['error']);
  });

  it('checks hearts on every repeated cell too', () => {
    const game = quietGame({ goal: 'cyan' });
    Object.assign(heart(game, 'cyan'), { x: 52, y: 17 });
    press(game, 'right');
    advance(game, 180);
    assert.equal(game.score, 5);
  });
});

describe('enemies', () => {
  function enemyGame(enemyAt, playerAt) {
    const game = quietGame();
    Object.assign(game.player, { x: playerAt[0], y: playerAt[1] });
    Object.assign(game.enemies[0], { x: enemyAt[0], y: enemyAt[1], nextStepAt: 150 });
    return game;
  }

  it('steps every 150 ms by the original chase rule', () => {
    const game = enemyGame([33, 17], [50, 10]);
    advance(game, 149);
    assert.deepEqual(cell(game.enemies[0]), [33, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.enemies[0]), [34, 16], 'left of the player: right and toward the row');
    advance(game, 150);
    assert.deepEqual(cell(game.enemies[0]), [35, 15]);
  });

  it('moves only left, with no row change, when right of the player', () => {
    const enemy = { x: 60, y: 5 };
    chase(enemy, { x: 50, y: 20 });
    assert.deepEqual(cell(enemy), [59, 5]);
  });

  it('moves only along the column when in the column of the player', () => {
    const enemy = { x: 50, y: 25 };
    chase(enemy, { x: 50, y: 20 });
    assert.deepEqual(cell(enemy), [50, 24]);
  });

  it('does not use the wrap-around', () => {
    const enemy = { x: 98, y: 15 };
    chase(enemy, { x: 2, y: 15 });
    assert.deepEqual(cell(enemy), [97, 15]);
  });

  it('adds a second and third enemy at 60 s and 120 s, at (33, 17), every 120 and 90 ms', () => {
    const game = quietGame();
    Object.assign(game.player, { x: 90, y: 5 });
    advance(game, 59_999);
    assert.equal(game.enemies.length, 1);
    advance(game, 1);
    assert.equal(game.enemies.length, 2);
    assert.deepEqual(cell(game.enemies[1]), [33, 17]);
    assert.equal(game.enemies[1].interval, 120);
    assert.deepEqual(game.events, ['enemy']);
    advance(game, 119);
    assert.deepEqual(cell(game.enemies[1]), [33, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.enemies[1]), [34, 16]);

    Object.assign(game.player, { x: 99, y: 30 });
    Object.assign(game.enemies[1], { x: 2, y: 30, nextStepAt: Infinity });
    advance(game, 120_000 - game.time);
    assert.equal(game.enemies.length, 3);
    assert.deepEqual(cell(game.enemies[2]), [33, 17]);
    assert.equal(game.enemies[2].interval, 90);
    advance(game, 90);
    assert.deepEqual(cell(game.enemies[2]), [34, 18]);
    game.enemies[2].nextStepAt = Infinity;
    advance(game, 600_000);
    assert.equal(game.enemies.length, 3, 'never more than three');
  });

  it('places again a heart the enemy stands on when it is about to step', () => {
    const game = enemyGame([20, 20], [50, 10]);
    game.random = scripted([0.8, 0.8]);
    Object.assign(heart(game, 'blue'), { x: 20, y: 20 });
    advance(game, 150);
    assert.deepEqual(cell(heart(game, 'blue')), [80, 28]);
  });
});

describe('game over', () => {
  it('ends when an enemy steps onto the player, and nothing moves afterwards', () => {
    const game = createGame();
    advance(game, 10_000); // the enemy needs 17 steps of 150 ms
    assert.equal(game.over, true);
    assert.equal(game.time, 2550);
    assert.equal(game.events.at(-1), 'over');
    const before = JSON.stringify(game);
    press(game, 'up');
    setRepeat(game, 'up');
    advance(game, 1000);
    assert.equal(JSON.stringify(game), before);
  });

  it('ends when the player steps onto an enemy', () => {
    const game = quietGame();
    Object.assign(game.enemies[0], { x: 51, y: 17 });
    press(game, 'right');
    assert.equal(game.over, true);
    assert.deepEqual(game.events, ['over']);
  });

  it('ends when a held direction carries the player onto an enemy', () => {
    const game = quietGame();
    Object.assign(game.enemies[0], { x: 52, y: 17 });
    press(game, 'right');
    advance(game, 180);
    assert.equal(game.over, true);
    assert.equal(game.held, null);
  });
});
