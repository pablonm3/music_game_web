import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  advance, chase, COLOURS, createGame, isExpiring, isSafe, playerPose, positionAt, press, REPEAT_DELAY, setRepeat, showsBombHint,
  STRIDE_MS, throwBomb,
} from '../public/js/game.js';

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
const cells = (list) => list.map((piece) => `${piece.x},${piece.y}`).sort();
const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Holds every enemy on its cell, so the clock can run without a chase.
function hold(game) {
  for (const enemy of game.enemies) enemy.nextStepAt = Infinity;
}

// Runs the clock to `time` and holds every enemy that has arrived by then.
function runTo(game, time) {
  advance(game, time - game.time);
  hold(game);
}

// A quiet game with the player parked far from (33, 17) and lives to spare, run to
// `time` with every enemy held where it arrived.
function heldGame(time, random = Math.random) {
  const game = quietGame();
  game.random = random;
  Object.assign(game.enemies[0], { x: 33, y: 17 });
  Object.assign(game.player, { x: 90, y: 28 });
  game.lives = 1000;
  for (const at of [60_000, 120_000, 140_000, 160_000, 180_000, 200_000]) {
    if (at <= time) runTo(game, at);
  }
  runTo(game, time);
  return game;
}

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
    game.random = scripted([0.8, 0.8]);
    Object.assign(heart(game, 'cyan'), { x: 54, y: 17 });
    press(game, 'right');
    assert.equal(game.score, 0, 'on 51,17 the shroom is 3 columns away');
    advance(game, 180);
    assert.equal(game.score, 5);
  });

  it('counts the shroom of the named colour as right, whichever colour it is', () => {
    for (const goal of COLOURS) {
      const game = quietGame({ goal });
      Object.assign(heart(game, goal), { x: 51, y: 17 });
      press(game, 'right');
      assert.equal(game.score, 5, goal);
      assert.equal(game.events.length, 2, goal);
      assert.equal(game.events[0], 'goal', goal);
      assert.match(game.events[1], /^voice-(red|blue|cyan)$/, goal);
    }
  });

  it('counts the goal heart as right, once, when another heart lies on its cell', () => {
    for (const goal of COLOURS) {
      for (const other of COLOURS.filter((colour) => colour !== goal)) {
        const game = quietGame({ goal });
        // both move away, to (30, 10) and (60, 21); the new goal is the other heart's
        // colour, which must not count for it on this step
        game.random = scripted([0.3, 0.3, 0.6, 0.6, COLOURS.indexOf(other) / 3 + 0.01]);
        Object.assign(heart(game, goal), { x: 51, y: 17 });
        Object.assign(heart(game, other), { x: 51, y: 17 });
        press(game, 'right');
        assert.equal(game.score, 5, `${goal} with ${other}`);
        assert.deepEqual(game.events, ['goal', `voice-${other}`], `${goal} with ${other}`);
        assert.deepEqual(cells([heart(game, goal), heart(game, other)]), ['30,10', '60,21']);
      }
    }
  });

  it('counts two wrong hearts on one cell as two', () => {
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.3, 0.3, 0.6, 0.6]);
    Object.assign(heart(game, 'blue'), { x: 51, y: 17 });
    Object.assign(heart(game, 'cyan'), { x: 51, y: 17 });
    press(game, 'right');
    assert.equal(game.score, -30);
    assert.deepEqual(game.events, ['error', 'error']);
    assert.equal(game.goal, 'red');
  });
});

describe('pick-up reach', () => {
  // A quiet game with the player on `from`, moved one cell `dir` with no repeat after it.
  function arrive(game, from, dir) {
    Object.assign(game.player, { x: from[0], y: from[1] });
    press(game, dir);
    setRepeat(game, null);
  }

  it('takes the goal shroom 2 columns and 1 row away like one stepped on', () => {
    // the shroom goes to (80, 28), the new goal is cyan
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.8, 0.8, 0.9]);
    Object.assign(heart(game, 'red'), { x: 52, y: 18 });
    arrive(game, [49, 17], 'right');
    assert.deepEqual(cell(game.player), [50, 17]);
    assert.equal(game.score, 5);
    assert.deepEqual(game.events, ['goal', 'voice-cyan']);
    assert.deepEqual(cell(heart(game, 'red')), [80, 28]);
    assert.equal(game.goal, 'cyan');
  });

  it('takes a shroom on each corner of the reach', () => {
    for (const [dx, dy] of [[2, 1], [2, -1], [-2, 1], [-2, -1]]) {
      const game = quietGame({ goal: 'red' });
      game.random = scripted([0.8, 0.8, 0.9]);
      Object.assign(heart(game, 'red'), { x: 50 + dx, y: 17 + dy });
      arrive(game, [49, 17], 'right');
      assert.equal(game.score, 5, `${dx},${dy}`);
      assert.deepEqual(cell(heart(game, 'red')), [80, 28], `${dx},${dy}`);
    }
  });

  it('counts each wrong shroom in reach: -15 and the error sound for each', () => {
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.3, 0.3, 0.6, 0.6]);
    Object.assign(heart(game, 'blue'), { x: 53, y: 17 });
    Object.assign(heart(game, 'cyan'), { x: 49, y: 18 });
    arrive(game, [50, 17], 'right');
    assert.equal(game.score, -30);
    assert.deepEqual(game.events, ['error', 'error']);
    assert.deepEqual(cells([heart(game, 'blue'), heart(game, 'cyan')]), ['30,10', '60,21']);
    assert.equal(game.goal, 'red');
  });

  it('counts the goal shroom once, and no other as wrong, when two in reach lie on different cells', () => {
    // red to (30, 10), blue to (60, 21), the new goal is blue
    const game = quietGame({ goal: 'red' });
    game.random = scripted([0.3, 0.3, 0.6, 0.6, 0.4]);
    Object.assign(heart(game, 'red'), { x: 52, y: 16 });
    Object.assign(heart(game, 'blue'), { x: 50, y: 18 });
    arrive(game, [50, 17], 'right');
    assert.equal(game.score, 5);
    assert.deepEqual(game.events, ['goal', 'voice-blue']);
    assert.deepEqual(cells([heart(game, 'red'), heart(game, 'blue')]), ['30,10', '60,21']);
  });

  it('takes a lying bomb 2 columns away, and every bomb in reach in one move', () => {
    const game = quietGame();
    game.lyingBombs.push({ x: 54, y: 18, placedAt: 0 });
    arrive(game, [51, 18], 'right');
    assert.deepEqual(cell(game.player), [52, 18]);
    assert.equal(game.bombs, 1);
    assert.deepEqual(game.lyingBombs, []);

    const two = quietGame();
    two.lyingBombs.push({ x: 50, y: 16, placedAt: 0 }, { x: 54, y: 18, placedAt: 0 });
    arrive(two, [51, 17], 'right');
    assert.equal(two.bombs, 2);
    assert.deepEqual(two.lyingBombs, []);
  });

  it('takes nothing 3 columns or 2 rows away, nor across an edge', () => {
    const game = quietGame({ goal: 'red' });
    Object.assign(heart(game, 'red'), { x: 54, y: 17 });
    Object.assign(heart(game, 'blue'), { x: 51, y: 19 });
    game.lyingBombs.push({ x: 48, y: 17, placedAt: 0 }, { x: 51, y: 15, placedAt: 0 });
    arrive(game, [50, 17], 'right');
    assert.equal(game.score, 0);
    assert.equal(game.bombs, 0);
    assert.deepEqual(cells(game.hearts), ['51,19', '54,17', '92,30']);
    assert.deepEqual(cells(game.lyingBombs), ['48,17', '51,15']);
    assert.deepEqual(game.events, []);

    const edge = quietGame({ goal: 'red' });
    Object.assign(heart(edge, 'red'), { x: 2, y: 10 });
    edge.lyingBombs.push({ x: 2, y: 11, placedAt: 0 });
    arrive(edge, [98, 10], 'right');
    assert.deepEqual(cell(edge.player), [99, 10]);
    assert.equal(edge.score, 0);
    assert.equal(edge.bombs, 0);
    assert.deepEqual(cell(heart(edge, 'red')), [2, 10]);
    assert.equal(edge.lyingBombs.length, 1);
    assert.deepEqual(edge.events, []);
  });

  it('still takes a life only on the same cell as a robot or a projectile', () => {
    const game = quietGame();
    Object.assign(game.enemies[0], { x: 52, y: 17 });
    game.projectiles.push({ x: 51, y: 18, originX: 51, originY: 18, dirX: 0, dirY: 1, steps: 0, nextStepAt: Infinity });
    arrive(game, [50, 17], 'right');
    assert.deepEqual(cell(game.player), [51, 17]);
    assert.equal(game.lives, 3);
    assert.deepEqual(game.events, []);
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

  it('adds a second and third enemy at 60 s and 120 s, at (33, 17), every 120 ms', () => {
    const game = quietGame();
    Object.assign(game.player, { x: 90, y: 5 });
    advance(game, 59_999);
    assert.equal(game.enemies.length, 1);
    advance(game, 1);
    assert.equal(game.enemies.length, 2);
    assert.deepEqual(cell(game.enemies[1]), [33, 17]);
    assert.equal(game.enemies[1].interval, 120);
    assert.deepEqual(game.events, ['enemy', 'bomb']);
    advance(game, 119);
    assert.deepEqual(cell(game.enemies[1]), [33, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.enemies[1]), [34, 16]);

    Object.assign(game.player, { x: 99, y: 30 });
    Object.assign(game.enemies[1], { x: 2, y: 30, nextStepAt: Infinity });
    advance(game, 120_000 - game.time);
    assert.equal(game.enemies.length, 3);
    assert.deepEqual(cell(game.enemies[2]), [33, 17]);
    assert.equal(game.enemies[2].interval, 120, 'the third as fast as the second');
    advance(game, 119);
    assert.deepEqual(cell(game.enemies[2]), [33, 17]);
    advance(game, 1);
    assert.deepEqual(cell(game.enemies[2]), [34, 18]);
  });

  it('places again a heart the enemy stands on when it is about to step', () => {
    const game = enemyGame([20, 20], [50, 10]);
    game.random = scripted([0.8, 0.8]);
    Object.assign(heart(game, 'blue'), { x: 20, y: 20 });
    advance(game, 150);
    assert.deepEqual(cell(heart(game, 'blue')), [80, 28]);
  });
});


describe('glide', () => {
  it('draws an enemy step on the line between its cells over its step time, and counts it', () => {
    const game = quietGame();
    Object.assign(game.player, { x: 50, y: 10 });
    Object.assign(game.enemies[0], { x: 33, y: 17, nextStepAt: 150 });
    advance(game, 150);
    assert.deepEqual(cell(game.enemies[0]), [34, 16]);
    assert.equal(game.enemies[0].steps, 1);
    advance(game, 75);
    assert.deepEqual(positionAt(game.enemies[0], game.time), { x: 33.5, y: 16.5 });
    advance(game, 75);
    assert.deepEqual(positionAt(game.enemies[0], game.time), { x: 34, y: 16 });
    assert.equal(game.enemies[0].steps, 2);
  });

  it('draws a player step over 60 ms', () => {
    const game = quietGame();
    press(game, 'right');
    advance(game, 30);
    assert.deepEqual(positionAt(game.player, game.time), { x: 50.5, y: 17 });
    advance(game, 30);
    assert.deepEqual(positionAt(game.player, game.time), { x: 51, y: 17 });
  });

  it('draws a step across an edge on the new cell at once', () => {
    const game = quietGame();
    Object.assign(game.player, { x: 99, y: 10 });
    press(game, 'right');
    assert.deepEqual(positionAt(game.player, game.time), { x: 2, y: 10 });
  });

  it('starts a new glide where the piece is drawn, not from its last cell', () => {
    const game = quietGame();
    press(game, 'right');
    press(game, 'up');               // the same instant: nothing has been drawn moving yet
    assert.deepEqual(positionAt(game.player, game.time), { x: 50, y: 17 });
    advance(game, 30);
    assert.deepEqual(positionAt(game.player, game.time), { x: 50.5, y: 16.5 });
    press(game, 'up');               // mid-glide: from (50.5, 16.5) to (51, 15)
    assert.deepEqual(positionAt(game.player, game.time), { x: 50.5, y: 16.5 });
    advance(game, 60);
    assert.deepEqual(positionAt(game.player, game.time), { x: 51, y: 15 });
  });

  it('leaves a piece with no glide, or one placed from outside, on its cell', () => {
    assert.deepEqual(positionAt({ x: 7, y: 8 }, 1000), { x: 7, y: 8 });
  });

  it('gives a long advance the same glide fields as many short ones', () => {
    const one = quietGame();
    const many = quietGame();
    for (const game of [one, many]) {
      Object.assign(game.enemies[0], { x: 33, y: 17, nextStepAt: 150 });
      press(game, 'right');
    }
    advance(one, 1000);
    for (let i = 0; i < 100; i += 1) advance(many, 10);
    assert.deepEqual(
      { ...many.player, ...many.enemies[0] },
      { ...one.player, ...one.enemies[0] },
    );
  });
});

describe('lives', () => {
  // The enemy reaches the idle player on (50, 17) with its 17th step, at 2550 ms.
  function contactGame() {
    const game = quietGame();
    Object.assign(game.enemies[0], { x: 33, y: 17, nextStepAt: 150 });
    return game;
  }

  it('starts with 3 lives, 0 bombs and nothing in the air', () => {
    const game = createGame();
    assert.equal(game.lives, 3);
    assert.equal(game.bombs, 0);
    assert.deepEqual([game.projectiles, game.lyingBombs, game.thrownBombs], [[], [], []]);
  });

  it('takes one life on a contact and goes on, with the player far from every enemy', () => {
    const game = contactGame();
    game.score = 35;
    advance(game, 2550);
    assert.equal(game.lives, 2);
    assert.equal(game.over, false);
    assert.deepEqual(game.events, ['life-lost']);
    assert.equal(game.time, 2550);
    assert.equal(game.score, 35);
    assert.deepEqual(game.hearts.map(cell), [[90, 30], [91, 30], [92, 30]]);
    assert.deepEqual(cell(game.enemies[0]), [50, 17]);
    assert.ok(distance(game.player, game.enemies[0]) >= 15, `${cell(game.player)}`);
    assert.deepEqual(positionAt(game.player, game.time), { x: game.player.x, y: game.player.y });
    assert.equal(isSafe(game), true);
  });

  it('keeps a held direction moving the player from the new cell', () => {
    const game = contactGame();
    Object.assign(game.enemies[0], { x: 51, y: 17 });
    press(game, 'right');
    const { x, y } = game.player;
    advance(game, 180);
    assert.equal(game.player.x, x === 99 ? 2 : x + 1);
    assert.equal(game.player.y, y);
  });

  it('takes no life for 3 s after the player reappears, and counts a contact still there then', () => {
    const game = contactGame();
    advance(game, 2550);
    const enemy = game.enemies[0];
    Object.assign(enemy, { x: game.player.x, y: game.player.y });
    const steps = enemy.steps;
    advance(game, 2999);
    assert.equal(game.lives, 2);
    assert.equal(enemy.steps, steps, 'an enemy on the safe player stands still');
    advance(game, 1);
    assert.equal(game.lives, 1);
    assert.deepEqual(game.events, ['life-lost', 'life-lost']);
  });

  it('ends the game on the third loss, with over and no life-lost, and nothing moves afterwards', () => {
    const game = contactGame();
    advance(game, 2550);
    for (let lost = 0; lost < 2; lost += 1) {
      Object.assign(game.enemies[0], { x: game.player.x, y: game.player.y });
      advance(game, 3000);
    }
    assert.equal(game.over, true);
    assert.equal(game.lives, 0);
    assert.deepEqual(game.events, ['life-lost', 'life-lost', 'over']);
    const before = JSON.stringify(game);
    press(game, 'up');
    setRepeat(game, 'up');
    throwBomb(game);
    advance(game, 1000);
    assert.equal(JSON.stringify(game), before);
  });

  it('takes a life when the player steps onto an enemy, also with a held direction', () => {
    const game = quietGame();
    Object.assign(game.enemies[0], { x: 51, y: 17 });
    press(game, 'right');
    assert.equal(game.lives, 2);
    assert.deepEqual(game.events, ['life-lost']);

    const held = quietGame();
    Object.assign(held.enemies[0], { x: 52, y: 17 });
    press(held, 'right');
    advance(held, 180);
    assert.equal(held.lives, 2);
  });

  it('takes the cells farthest from their nearest enemy when none is 15 away', () => {
    const game = contactGame();
    // An enemy every 20 columns on rows 5, 15 and 25: no cell is 15 cells from all of them.
    for (const x of [10, 30, 50, 70, 90]) {
      for (const y of [5, 15, 25]) game.enemies.push({ x, y, interval: 150, nextStepAt: Infinity, steps: 0 });
    }
    game.random = () => 0;
    advance(game, 2550);
    assert.equal(game.lives, 2);
    const nearest = Math.min(...game.enemies.map((enemy) => distance(enemy, game.player)));
    assert.equal(nearest, 10);
  });
});

describe('later enemies', () => {
  it('steps every 150, 120 and 120 ms, then from 90 to 150 ms at random', () => {
    for (const [random, interval] of [[0, 90], [0.5, 120], [0.999, 150]]) {
      const game = heldGame(139_999, () => random);
      assert.deepEqual(game.enemies.map((enemy) => enemy.interval), [150, 120, 120]);
      runTo(game, 140_000);
      assert.equal(game.enemies.length, 4);
      assert.deepEqual(cell(game.enemies[3]), [33, 17]);
      assert.equal(game.enemies[3].interval, interval);
    }
  });

  it('brings one more every 20 s after the third, without end, with the enemy sound', () => {
    const game = heldGame(159_999);
    assert.equal(game.enemies.length, 4);
    runTo(game, 160_000);
    assert.equal(game.enemies.length, 5);
    runTo(game, 200_000);
    assert.equal(game.enemies.length, 7);
    runTo(game, 600_000);
    assert.equal(game.enemies.length, 27);
    assert.equal(game.events.filter((event) => event === 'enemy').length, 26);
  });

  it('makes arrivals 3, 5, 7, … shooters', () => {
    const game = heldGame(200_000);
    assert.deepEqual(game.enemies.map((enemy) => enemy.shooter), [false, false, true, false, true, false, true]);
  });
});

describe('shooters and projectiles', () => {
  // The third enemy, a shooter, arrived at 120 000 ms and is held on (33, 17).
  function shooterGame(at) {
    const game = heldGame(at - 1);
    game.lives = 3;
    return game;
  }

  it('fires 3 s after arriving and every 3 s, one cell every 80 ms toward the player', () => {
    const game = shooterGame(123_000);
    Object.assign(game.player, { x: 43, y: 17 });
    assert.equal(game.projectiles.length, 0);
    runTo(game, 123_000);
    assert.deepEqual(cells(game.projectiles), ['33,17']);
    const [shot] = game.projectiles;
    Object.assign(game.player, { x: 90, y: 28 });
    runTo(game, 123_079);
    assert.deepEqual(cell(shot), [33, 17]);
    runTo(game, 123_080);
    assert.deepEqual(cell(shot), [34, 17]);
    assert.deepEqual(positionAt(shot, 123_120), { x: 33.5, y: 17 });
    runTo(game, 125_999);
    assert.equal(game.projectiles.length, 1);
    runTo(game, 126_000);
    assert.equal(game.projectiles.length, 2, 'the next shot');
    runTo(game, 123_000 + 66 * 80);
    assert.deepEqual(cell(shot), [99, 17]);
    runTo(game, 123_000 + 67 * 80);
    assert.ok(!game.projectiles.includes(shot), 'removed at the edge');
    assert.equal(game.lives, 3);
  });

  it('flies a straight line through the cell the player was on', () => {
    const game = shooterGame(123_000);
    Object.assign(game.player, { x: 43, y: 12 });
    runTo(game, 123_000);
    Object.assign(game.player, { x: 90, y: 28 });
    const visited = [];
    for (let n = 1; n <= 10; n += 1) {
      runTo(game, 123_000 + n * 80);
      visited.push(cell(game.projectiles[0]));
    }
    assert.deepEqual(visited.slice(0, 3), [[34, 17], [35, 16], [36, 16]]);
    assert.deepEqual(visited.at(-1), [43, 12]);
  });

  it('passes over hearts, lying bombs and enemies without changing them', () => {
    const game = shooterGame(123_000);
    Object.assign(game.player, { x: 43, y: 17 });
    runTo(game, 123_000);
    Object.assign(game.player, { x: 90, y: 28 });
    Object.assign(heart(game, 'red'), { x: 36, y: 17 });
    game.lyingBombs = [{ x: 38, y: 17, placedAt: 122_000 }];
    const enemy = { x: 40, y: 17, interval: 150, nextStepAt: Infinity, steps: 0 };
    game.enemies.push(enemy);
    const score = game.score;
    runTo(game, 123_000 + 10 * 80);
    assert.deepEqual(cells(game.projectiles), ['43,17']);
    assert.deepEqual(cell(heart(game, 'red')), [36, 17]);
    assert.deepEqual(cells(game.lyingBombs), ['38,17']);
    assert.ok(game.enemies.includes(enemy));
    assert.equal(game.score, score);
  });

  it('takes one life on a hit and removes that projectile only', () => {
    const game = shooterGame(123_000);
    Object.assign(game.player, { x: 43, y: 17 });
    runTo(game, 123_000);
    const other = { x: 60, y: 5, originX: 60, originY: 5, dirX: 0, dirY: 1, steps: 0, nextStepAt: Infinity };
    game.projectiles.push(other);
    runTo(game, 123_800);
    assert.equal(game.lives, 2);
    assert.deepEqual(game.projectiles, [other]);
    assert.ok(game.events.includes('life-lost'));
  });

  it('takes a life when the player steps onto a projectile, and none while the player is safe', () => {
    const game = shooterGame(123_000);
    Object.assign(game.player, { x: 43, y: 17 });
    runTo(game, 123_000);
    Object.assign(game.player, { x: 35, y: 16 });
    runTo(game, 123_080);              // the projectile is on (34, 17)
    press(game, 'downLeft');
    setRepeat(game, null);
    assert.equal(game.lives, 2);
    assert.equal(game.projectiles.length, 0);

    game.player.safeUntil = Infinity;  // as after a lost life
    Object.assign(game.player, { x: 70, y: 17 });
    runTo(game, 126_000);
    runTo(game, 126_000 + 37 * 80);    // the shot reaches (70, 17)
    assert.equal(game.lives, 2);
    assert.equal(game.projectiles.length, 1, 'it flies on');
  });

  it('never fires from an enemy that is not a shooter', () => {
    const game = heldGame(140_000);    // arrivals 1, 2 and 4 do not shoot, 3 does
    const shooter = game.enemies[2];
    for (const [i, x, y] of [[0, 10, 5], [1, 10, 25], [3, 60, 5]]) Object.assign(game.enemies[i], { x, y });
    game.projectiles.length = 0;
    runTo(game, 152_000);
    assert.ok(game.projectiles.length > 0);
    for (const projectile of game.projectiles) {
      assert.deepEqual([projectile.originX, projectile.originY], cell(shooter));
    }
  });
});

describe('bombs', () => {
  // Puts the player on the bomb's cell and moves him one row, which keeps it in reach.
  function pickUpLying(game, bomb) {
    Object.assign(game.player, { x: bomb.x, y: bomb.y });
    press(game, bomb.y > 1 ? 'up' : 'down');
    setRepeat(game, null);
  }

  it('places the first bomb at 60 s on a free cell, none before', () => {
    const game = heldGame(59_999);
    assert.equal(game.lyingBombs.length, 0);
    assert.ok(!game.events.includes('bomb'));
    runTo(game, 60_000);
    assert.equal(game.lyingBombs.length, 1);
    const [bomb] = game.lyingBombs;
    assert.equal(bomb.placedAt, 60_000);
    const others = [game.player, ...game.hearts, ...game.enemies];
    assert.ok(!others.some((piece) => piece.x === bomb.x && piece.y === bomb.y));
  });

  it('places one bomb every 20 s from 60 s on, at no other time', () => {
    const game = heldGame(0);
    for (let at = 60_000; at <= 320_000; at += 20_000) {
      runTo(game, at - 1);
      assert.deepEqual(game.lyingBombs, [], `before ${at}: the last one went after 12 s`);
      runTo(game, at);
      assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [at]);
    }
    runTo(game, 330_000);
    assert.equal(game.events.filter((event) => event === 'bomb').length, 14);
  });

  it("keeps the bombs' clock when a bomb is picked up and when no enemy is left", () => {
    const game = heldGame(60_000);
    pickUpLying(game, game.lyingBombs[0]);
    assert.equal(game.bombs, 1);
    assert.deepEqual(game.lyingBombs, []);
    runTo(game, 70_000);
    game.enemies.length = 0;           // as after a blast at 70 s
    runTo(game, 79_999);
    assert.deepEqual(game.lyingBombs, []);
    runTo(game, 80_000);
    assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [80_000]);
    runTo(game, 100_000);
    assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [100_000]);
    assert.equal(game.enemies.length, 0);
  });

  it('names a new bomb with the bomb event, and nothing else a bomb does', () => {
    const game = heldGame(79_999);
    game.events.length = 0;
    runTo(game, 80_000);
    assert.deepEqual(game.events, ['bomb']);
    game.events.length = 0;
    // picked up, thrown to the side, exploded; the bomb of 100 s expires at 112 s
    Object.assign(game.lyingBombs[0], { x: 52, y: 17 });
    Object.assign(game.player, { x: 50, y: 17 });
    press(game, 'right');
    setRepeat(game, null);
    assert.equal(game.bombs, 1);
    throwBomb(game);
    runTo(game, 119_999);
    assert.deepEqual(game.lyingBombs, []);
    assert.equal(game.lives, 1000);
    assert.deepEqual(game.events, ['explosion', 'bomb']);
  });

  it('names both when a robot and a bomb come at the same instant', () => {
    const game = heldGame(0);
    game.player.safeUntil = Infinity;  // no shot takes a life at those instants
    for (const at of [60_000, 120_000, 140_000]) {
      runTo(game, at - 1);
      game.events.length = 0;
      runTo(game, at);
      assert.deepEqual(game.events, ['enemy', 'bomb'], `at ${at}`);
    }
  });

  it('flickers from 10 s on and is gone at 12 s, and can be picked up until then', () => {
    const game = heldGame(120_000);
    const [bomb] = game.lyingBombs;
    runTo(game, 129_999);
    assert.equal(isExpiring(game, bomb), false);
    runTo(game, 130_000);
    assert.equal(isExpiring(game, bomb), true);
    runTo(game, 131_999);
    Object.assign(game.player, { x: bomb.x - 1, y: bomb.y });
    if (bomb.x === 2) Object.assign(game.player, { x: bomb.x + 1 });
    press(game, bomb.x === 2 ? 'left' : 'right');
    assert.equal(game.bombs, 1);
    assert.deepEqual(game.lyingBombs, []);

    const late = heldGame(131_999);
    runTo(late, 132_000);
    assert.equal(late.lyingBombs.length, 0);
  });

  it('adds every bomb picked up, with no limit, whether or not the player is safe', () => {
    const game = quietGame();
    game.bombs = 7;
    game.player.safeUntil = Infinity;
    game.lyingBombs.push({ x: 51, y: 17, placedAt: 0 });
    press(game, 'right');
    assert.equal(game.bombs, 8);
  });

  it('throws 14 cells in the direction of the last move, right before any, stopping before the frame', () => {
    const cases = [
      [[50, 17], null, [64, 17]],
      [[95, 17], null, [99, 17]],
      [[51, 6], 'upRight', [56, 1]],
      [[50, 20], 'left', [35, 20]],
      [[50, 17], 'upRight', [65, 2]],
      [[50, 20], 'up', [50, 5]],
    ];
    for (const [start, dir, landing] of cases) {
      const game = quietGame();
      Object.assign(game.player, { x: start[0], y: start[1] });
      if (dir) {
        press(game, dir);
        setRepeat(game, null);
      }
      game.bombs = 2;
      throwBomb(game);
      assert.equal(game.bombs, 1);
      assert.deepEqual(cells(game.thrownBombs), [landing.join(',')], `${start} ${dir}`);
    }
  });

  it('does nothing when no bomb is held', () => {
    const game = quietGame();
    const before = JSON.stringify(game);
    throwBomb(game);
    assert.equal(JSON.stringify(game), before);
  });

  it('draws the bomb in the air from the player to the landing cell over 1 s', () => {
    const game = quietGame();
    game.bombs = 1;
    throwBomb(game);
    advance(game, 500);
    assert.deepEqual(positionAt(game.thrownBombs[0], game.time), { x: 57, y: 17 });
  });

  // Moves the player one cell towards `dir`, with no repeat after it.
  function step(game, dir) {
    press(game, dir);
    setRepeat(game, null);
  }

  it('leaves a thrower who stands still clear of a throw to the side', () => {
    const right = quietGame();
    right.bombs = 1;
    throwBomb(right);
    assert.deepEqual(cells(right.thrownBombs), ['64,17']);
    advance(right, 1000);
    assert.equal(right.lives, 3);

    const left = quietGame();
    step(left, 'left');
    left.bombs = 1;
    throwBomb(left);
    assert.deepEqual(cells(left.thrownBombs), ['35,17']);
    advance(left, 1000);
    assert.equal(left.lives, 3);

    // One step towards the bomb during its flight is still clear, two are not.
    for (const [steps, lives] of [[1, 3], [2, 2]]) {
      const game = quietGame();
      game.bombs = 1;
      throwBomb(game);
      for (let i = 0; i < steps; i += 1) step(game, 'right');
      advance(game, 1000);
      assert.equal(game.lives, lives, `${steps} steps`);
    }
  });

  it('reaches a thrower when the frame stops the bomb short', () => {
    for (const [x, lives] of [[87, 2], [86, 3]]) {
      const game = quietGame();
      Object.assign(game.player, { x, y: 17 });
      game.bombs = 1;
      throwBomb(game);
      assert.deepEqual(cells(game.thrownBombs), ['99,17']);
      advance(game, 1000);
      assert.equal(game.lives, lives, `from ${x}`);
    }
  });

  it('shows the throw hint from the first bomb held until the first throw of the game', () => {
    const pickUp = (game) => {
      const { x, y } = game.player;
      game.lyingBombs.push({ x: x + 1, y, placedAt: game.time });
      step(game, 'right');
    };
    const game = quietGame();
    assert.equal(showsBombHint(game), false);
    throwBomb(game); // with no bomb held: not a throw
    pickUp(game);
    assert.equal(game.bombs, 1);
    assert.equal(showsBombHint(game), true);
    advance(game, 5000);
    assert.equal(showsBombHint(game), true);
    pickUp(game);
    assert.equal(game.bombs, 2);
    assert.equal(showsBombHint(game), true);
    throwBomb(game);
    assert.equal(game.bombs, 1);
    assert.equal(showsBombHint(game), false, 'gone at the throw, a bomb still held');
    pickUp(game);
    assert.equal(game.bombs, 2);
    assert.equal(showsBombHint(game), false, 'not again in this game');

    const next = quietGame();
    pickUp(next);
    assert.equal(showsBombHint(next), true, 'back in a new game');
  });

  describe('explosion', () => {
    // A bomb thrown from (50, 17) lands on (64, 17) and explodes 1 s later. The thrower
    // stays on (50, 17), outside the blast.
    function blastGame() {
      const game = quietGame();
      game.enemies.length = 0;
      const enemy = (x, y) => ({ x, y, interval: 150, nextStepAt: Infinity, steps: 0 });
      const inside = [[60, 17], [76, 17], [64, 24], [68, 24], [74, 21]];
      const outside = [[77, 17], [64, 25], [69, 24], [75, 20]];
      for (const [x, y] of [...inside, ...outside]) {
        game.enemies.push(enemy(x, y));
      }
      game.projectiles.push({ x: 62, y: 16, originX: 62, originY: 16, dirX: 0, dirY: 1, steps: 0, nextStepAt: Infinity });
      game.lyingBombs.push({ x: 65, y: 18, placedAt: 0 });
      Object.assign(heart(game, 'red'), { x: 63, y: 17 });
      game.bombs = 1;
      throwBomb(game);
      return game;
    }

    it('removes the enemies and projectiles inside 12 columns and 7.5 rows after 1 s, nothing else', () => {
      const game = blastGame();
      advance(game, 999);
      assert.equal(game.enemies.length, 9);
      assert.deepEqual(game.events, []);
      advance(game, 1);
      assert.deepEqual(cells(game.enemies), ['64,25', '69,24', '75,20', '77,17']);
      assert.deepEqual(game.projectiles, []);
      assert.deepEqual(cell(heart(game, 'red')), [63, 17]);
      assert.deepEqual(cells(game.lyingBombs), ['65,18']);
      assert.deepEqual(game.thrownBombs, []);
      assert.equal(game.score, 0);
      assert.equal(game.lives, 3);
      assert.deepEqual(game.events, ['explosion']);
      assert.deepEqual(game.explosions, [{ x: 64, y: 17, at: 1000 }]);
      advance(game, 599);
      assert.equal(game.explosions.length, 1);
      advance(game, 1);
      assert.deepEqual(game.explosions, [], 'the explosion is drawn for 600 ms');
    });

    it('takes a life from a player inside the blast, none from a safe one', () => {
      const game = blastGame();
      Object.assign(game.player, { x: 65, y: 19 });
      advance(game, 1000);
      assert.equal(game.lives, 2);
      assert.ok(game.events.includes('life-lost'));

      const safe = blastGame();
      Object.assign(safe.player, { x: 65, y: 19 });
      safe.player.safeUntil = 5000;
      advance(safe, 1000);
      assert.equal(safe.lives, 3);
    });
  });

  it('keeps later arrivals, their shooters and the bombs when every enemy is destroyed', () => {
    const game = heldGame(125_000);
    game.lyingBombs.length = 0;
    game.enemies.length = 0;           // as after a blast at 125 s
    runTo(game, 139_999);
    assert.equal(game.enemies.length, 0, 'nothing comes back');
    runTo(game, 140_000);
    assert.equal(game.enemies.length, 1);
    assert.equal(game.enemies[0].shooter, false);
    assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [140_000]);
    runTo(game, 160_000);
    assert.equal(game.enemies.length, 2);
    assert.equal(game.enemies[1].shooter, true);
    assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [160_000]);
    runTo(game, 180_000);
    assert.equal(game.enemies.length, 3);
    assert.deepEqual(game.lyingBombs.map((bomb) => bomb.placedAt), [180_000]);
  });
});

describe('player pose', () => {
  // The pose at every 10 ms from now until `until`, as runs of [pose, ms it lasted];
  // `runs` continues an earlier list.
  function poseRuns(game, until, runs = []) {
    while (game.time < until) {
      const pose = playerPose(game);
      if (runs.length > 0 && runs.at(-1)[0] === pose) runs.at(-1)[1] += 10;
      else runs.push([pose, 10]);
      advance(game, 10);
    }
    return runs;
  }

  it('stands at the start and for as long as no key is pressed', () => {
    const game = quietGame();
    assert.equal(playerPose(game), 0);
    advance(game, 5000);
    assert.equal(playerPose(game), 0);
  });

  it('takes two strides of 120 ms for one press, then stands', () => {
    const game = quietGame();
    advance(game, 1000);
    press(game, 'right');
    setRepeat(game, null);
    assert.deepEqual(poseRuns(game, 2000), [[1, 120], [2, 120], [0, 760]]);
  });

  it('changes stride every 120 ms while a direction is held, from the press on', () => {
    const game = quietGame();
    advance(game, 1000);
    press(game, 'right');
    const runs = poseRuns(game, 2200);
    assert.deepEqual(runs, Array.from({ length: 10 }, (_, i) => [1 + (i % 2), 120]));
  });

  it('finishes its stride after a release and stands less than 300 ms after the last move', () => {
    for (const heldFor of [200, 250, 310, 370, 500, 990]) {
      const game = quietGame();
      const pressedAt = 1000;
      advance(game, pressedAt);
      press(game, 'up');
      const runs = poseRuns(game, pressedAt + heldFor);
      setRepeat(game, null);
      const lastMove = game.player.movedAt;
      poseRuns(game, lastMove + 600, runs);
      const strides = runs.slice(0, -1);
      assert.equal(runs.at(-1)[0], 0, `held ${heldFor} ms`);
      assert.ok(strides.every(([pose, ms], i) => pose === 1 + (i % 2) && ms === STRIDE_MS), `held ${heldFor} ms: ${JSON.stringify(runs)}`);
      const stoodAfter = pressedAt + strides.length * STRIDE_MS - lastMove;
      assert.ok(stoodAfter >= REPEAT_DELAY && stoodAfter < REPEAT_DELAY + STRIDE_MS, `held ${heldFor} ms: stood ${stoodAfter} ms after the last move`);
    }
  });

  it('starts every walk with the same stride', () => {
    const game = quietGame();
    for (const at of [1000, 1700, 2433, 3001]) {
      advance(game, at - game.time);
      assert.equal(playerPose(game), 0);
      press(game, 'left');
      setRepeat(game, null);
      assert.equal(playerPose(game), 1);
    }
  });

  it('keeps walking across an edge', () => {
    const game = quietGame();
    Object.assign(game.player, { x: 98, y: 10 });
    advance(game, 1000);
    press(game, 'right');
    const runs = poseRuns(game, 1600);
    assert.equal(game.player.x < 98, true, 'wrapped');
    assert.deepEqual(runs, Array.from({ length: 5 }, (_, i) => [1 + (i % 2), 120]));
  });

  it('stands when he reappears after a lost life, until his next move, and walks while safe', () => {
    const game = quietGame();
    game.random = () => 0.5;
    advance(game, 1000);
    press(game, 'right');
    advance(game, 200);
    assert.notEqual(playerPose(game), 0);
    setRepeat(game, null);
    Object.assign(game.enemies[0], { x: game.player.x + 1, y: game.player.y });
    press(game, 'right'); // onto the enemy
    setRepeat(game, null);
    assert.equal(game.lives, 2);
    assert.equal(playerPose(game), 0);
    advance(game, 500);
    assert.equal(playerPose(game), 0);
    press(game, 'down');
    assert.ok(isSafe(game));
    assert.equal(playerPose(game), 1);
    advance(game, 130);
    assert.equal(playerPose(game), 2);
  });

  it('gives a long advance the same pose as many short ones', () => {
    const run = (stepMs) => {
      const game = quietGame();
      const poses = [];
      advance(game, 1000);
      press(game, 'right');
      for (let t = 0; t < 1200; t += 300) {
        for (let done = 0; done < 300; done += stepMs) advance(game, stepMs);
        poses.push(playerPose(game), game.player.walkSince);
      }
      return poses;
    };
    assert.deepEqual(run(300), run(10));
  });
});
