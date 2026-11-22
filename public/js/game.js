// The rules of the original game, with no DOM, audio or timers: time enters only through
// advance(game, ms). Coordinates are the original console's: x is the column, y the row;
// the playable cells are x 2 to 99 and y 1 to 30.
//
// The page empties game.events every frame and plays a clip of the same name for each:
// voice-red, voice-blue, voice-cyan, goal, error, enemy; `over` ends the game.

export const COLOURS = ['red', 'blue', 'cyan'];

export const DIRECTIONS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  upLeft: [-1, -1],
  upRight: [1, -1],
  downLeft: [-1, 1],
  downRight: [1, 1],
};

export const PLAYER_START = { x: 50, y: 17 };
export const ENEMY_START = { x: 33, y: 17 };
export const ENEMY_INTERVALS = [150, 120, 90];  // ms per step of the first, second, third enemy
export const ENEMY_ARRIVALS = [60_000, 120_000]; // ms at which the second and third arrive
export const REPEAT_DELAY = 180;                 // ms from a press to the second cell
export const REPEAT_EVERY = 60;                  // ms between the cells after that
const GOAL_POINTS = 5;
const WRONG_HEART_POINTS = 15;

export function wrapX(x) {
  if (x <= 1) return 99;
  if (x >= 100) return 2;
  return x;
}

export function wrapY(y) {
  if (y <= 0) return 30;
  if (y > 30) return 1;
  return y;
}

export function createGame(random = Math.random) {
  const game = {
    random,
    time: 0,
    score: 0,
    goal: null,
    player: { ...PLAYER_START },
    hearts: COLOURS.map((colour) => ({ colour, x: 0, y: 0 })),
    enemies: [newEnemy(0, 0)],
    held: null,
    nextRepeatAt: 0,
    over: false,
    events: [],
  };
  for (const heart of game.hearts) placeHeart(game, heart);
  pickGoal(game);
  return game;
}

// Moves the player one cell now and starts the repeat of `dir`. Every press starts its
// own REPEAT_DELAY, also when another direction is already held.
export function press(game, dir) {
  if (game.over || !DIRECTIONS[dir]) return;
  movePlayer(game, dir);
  game.held = dir;
  game.nextRepeatAt = game.time + REPEAT_DELAY;
}

// Changes which direction repeats (null stops it), without moving the player and without
// restarting the wait of a repeat already running. The page calls it on a release.
export function setRepeat(game, dir) {
  if (game.over) return;
  const next = DIRECTIONS[dir] ? dir : null;
  // Nothing was repeating, so the stored time is stale: start a fresh wait.
  if (game.held === null && next !== null) game.nextRepeatAt = game.time + REPEAT_DELAY;
  game.held = next;
}

// Runs the clock for `ms` milliseconds. What is due at time T happens when the clock
// reaches T; at one instant the order is player, new enemy, enemies by arrival.
export function advance(game, ms) {
  if (!(ms > 0)) return;
  const end = game.time + ms;
  while (!game.over) {
    const due = nextDue(game);
    if (!due || due.at > end) break;
    game.time = due.at;
    due.run();
  }
  if (!game.over) game.time = end;
}

function nextDue(game) {
  let due = null;
  const consider = (at, run) => {
    if (!due || at < due.at) due = { at, run };
  };

  if (game.held !== null) {
    consider(game.nextRepeatAt, () => {
      game.nextRepeatAt += REPEAT_EVERY;
      movePlayer(game, game.held);
    });
  }
  const at = nextArrivalAt(game);
  if (at !== undefined) {
    consider(at, () => {
      const enemy = newEnemy(game.enemies.length, at);
      game.enemies.push(enemy);
      game.events.push('enemy');
      if (sameCell(enemy, game.player)) endGame(game);
    });
  }
  for (const enemy of game.enemies) {
    consider(enemy.nextStepAt, () => {
      enemy.nextStepAt += enemy.interval;
      stepEnemy(game, enemy);
    });
  }
  return due;
}

// The first enemy is there from the start; ENEMY_ARRIVALS[i] brings enemy i+1.
// Undefined once every enemy has arrived.
function nextArrivalAt(game) {
  return ENEMY_ARRIVALS[game.enemies.length - 1];
}

function newEnemy(index, arrivedAt) {
  const interval = ENEMY_INTERVALS[index];
  return { ...ENEMY_START, interval, nextStepAt: arrivedAt + interval };
}

function movePlayer(game, dir) {
  const [dx, dy] = DIRECTIONS[dir];
  game.player.x = wrapX(game.player.x + dx);
  game.player.y = wrapY(game.player.y + dy);

  for (const heart of game.hearts) {
    if (!sameCell(heart, game.player)) continue;
    if (heart.colour === game.goal) {
      game.score += GOAL_POINTS;
      game.events.push('goal');
      placeHeart(game, heart);
      pickGoal(game);
    } else {
      game.score -= WRONG_HEART_POINTS;
      game.events.push('error');
      placeHeart(game, heart);
    }
  }

  if (game.enemies.some((enemy) => sameCell(enemy, game.player))) endGame(game);
}

function stepEnemy(game, enemy) {
  for (const heart of game.hearts) {
    if (sameCell(heart, enemy)) placeHeart(game, heart);
  }
  chase(enemy, game.player);
  if (sameCell(enemy, game.player)) endGame(game);
}

// The original's rule, kept on purpose: an enemy right of the player only moves left;
// otherwise it closes in on the column and the row together. Enemies never wrap.
export function chase(enemy, player) {
  if (enemy.x > player.x) {
    enemy.x -= 1;
    return;
  }
  if (enemy.x < player.x) enemy.x += 1;
  if (enemy.y > player.y) enemy.y -= 1;
  else if (enemy.y < player.y) enemy.y += 1;
}

// The original's formula: it always lands on a playable cell, and makes row 1, row 30
// and column 99 more likely than the others.
function placeHeart(game, heart) {
  heart.x = wrapX(Math.floor(game.random() * 100));
  heart.y = wrapY(Math.floor(game.random() * 35));
}

function pickGoal(game) {
  game.goal = COLOURS[Math.floor(game.random() * COLOURS.length)];
  game.events.push(`voice-${game.goal}`);
}

function endGame(game) {
  game.over = true;
  game.held = null;
  game.events.push('over');
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}
