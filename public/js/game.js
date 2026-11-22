// The rules of the game, with no DOM, audio or timers: time enters only through
// advance(game, ms), and every timed effect is scheduled on that clock. Coordinates are
// the original console's: x is the column, y the row; the playable cells are x 2 to 99
// and y 1 to 30.
//
// The page empties game.events every frame and plays a clip of the same name for each:
// voice-red, voice-blue, voice-cyan, goal, error, enemy, life-lost, explosion; `over`
// ends the game.
//
// Pieces change cell in one instant, as in the original, and contact is decided by
// cell. Each moving piece also records how its last move is drawn (its glide):
//   fromX, fromY  where it was drawn when it moved, in fractions of a cell
//   movedAt       the game time of that move
//   glideMs       how long the move is drawn for; 0 or missing: drawn on its cell
//   steps         how many times it has changed cell; a robot's pose follows it
// positionAt(piece, time) gives the point to draw.

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
export const ENEMY_INTERVALS = [150, 120, 120]; // ms per step of the first, second, third enemy
export const ENEMY_ARRIVALS = [60_000, 120_000]; // ms at which the second and third arrive
export const LATER_ARRIVAL_EVERY = 20_000;      // ms between arrivals after the third
export const LATER_INTERVAL_MIN = 90;           // ms per step of the fourth and later,
export const LATER_INTERVAL_MAX = 150;          // picked at random, both ends included
export const REPEAT_DELAY = 180;                 // ms from a press to the second cell
export const REPEAT_EVERY = 60;                  // ms between the cells after that
export const LIVES = 3;
export const SAFE_MS = 3000;                     // the player flickers and cannot lose a life
export const RESPAWN_DISTANCE = 15;              // cells from every enemy, the larger of dx and dy
export const SHOT_EVERY = 3000;                  // ms from a shooter's arrival to its first shot, and between shots
export const PROJECTILE_STEP = 80;               // ms per cell of a projectile
export const BOMB_EVERY = 3;                     // a bomb comes with every third arrival
export const BOMB_STEADY_MS = 10_000;            // a lying bomb, then
export const BOMB_FLICKER_MS = 2000;             // flickering, then gone
export const THROW_CELLS = 12;
export const FLIGHT_MS = 1000;
export const BLAST_COLUMNS = 8;                  // the blast is an ellipse with these half axes
export const BLAST_ROWS = 5;
export const EXPLOSION_MS = 600;                 // how long the explosion is drawn
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

export function isPlayable(x, y) {
  return x >= 2 && x <= 99 && y >= 1 && y <= 30;
}

export function createGame(random = Math.random) {
  const game = {
    random,
    time: 0,
    score: 0,
    goal: null,
    lives: LIVES,
    bombs: 0,
    player: { ...PLAYER_START, steps: 0, facing: 'right', safeUntil: 0, safeEndPending: false },
    hearts: COLOURS.map((colour) => ({ colour, x: 0, y: 0 })),
    enemies: [newEnemy(1, 0, random)],
    arrivals: 1,
    projectiles: [],
    lyingBombs: [],
    thrownBombs: [],
    explosions: [],
    held: null,
    nextRepeatAt: 0,
    over: false,
    events: [],
  };
  for (const heart of game.hearts) placeHeart(game, heart);
  pickGoal(game);
  return game;
}

// Where to draw `piece` at `time`: on the line from where it was drawn when it last moved
// to its cell, or on its cell once the glide is over (or when it has none).
export function positionAt(piece, time) {
  const done = piece.glideMs > 0 ? (time - piece.movedAt) / piece.glideMs : 1;
  if (done >= 1) return { x: piece.x, y: piece.y };
  const part = Math.max(done, 0);
  return {
    x: piece.fromX + (piece.x - piece.fromX) * part,
    y: piece.fromY + (piece.y - piece.fromY) * part,
  };
}

// The 3 s after the player reappears, when no life can be taken.
export function isSafe(game) {
  return game.time < game.player.safeUntil;
}

// A lying bomb flickers for its last BOMB_FLICKER_MS.
export function isExpiring(game, bomb) {
  return game.time >= bomb.placedAt + BOMB_STEADY_MS;
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

// Throws one held bomb THROW_CELLS cells in the direction of the player's last move. It
// stops on the last playable cell before the frame and explodes after FLIGHT_MS.
export function throwBomb(game) {
  if (game.over || game.bombs <= 0) return;
  game.bombs -= 1;
  const { player } = game;
  const [dx, dy] = DIRECTIONS[player.facing];
  let { x, y } = player;
  for (let i = 0; i < THROW_CELLS && isPlayable(x + dx, y + dy); i += 1) {
    x += dx;
    y += dy;
  }
  const from = positionAt(player, game.time);
  game.thrownBombs.push({
    x, y, fromX: from.x, fromY: from.y, movedAt: game.time, glideMs: FLIGHT_MS, explodesAt: game.time + FLIGHT_MS,
  });
}

// Runs the clock for `ms` milliseconds. What is due at time T happens when the clock
// reaches T; at one instant the order is: player, end of the safe time, new enemy,
// enemies by arrival, shots, projectiles, bombs that expire, bombs that explode, the end
// of an explosion.
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
  if (game.player.safeEndPending) {
    consider(game.player.safeUntil, () => {
      game.player.safeEndPending = false;
      checkContact(game); // a contact still there when the safe time ends counts now
    });
  }
  const at = arrivalTime(game.arrivals + 1);
  consider(at, () => arrive(game, at));
  for (const enemy of game.enemies) {
    consider(enemy.nextStepAt, () => {
      enemy.nextStepAt += enemy.interval;
      stepEnemy(game, enemy);
    });
  }
  for (const enemy of game.enemies) {
    if (!enemy.shooter) continue;
    consider(enemy.nextShotAt, () => {
      enemy.nextShotAt += SHOT_EVERY;
      fire(game, enemy);
    });
  }
  for (const projectile of game.projectiles) {
    consider(projectile.nextStepAt, () => {
      projectile.nextStepAt += PROJECTILE_STEP;
      stepProjectile(game, projectile);
    });
  }
  for (const bomb of game.lyingBombs) {
    consider(bomb.placedAt + BOMB_STEADY_MS + BOMB_FLICKER_MS, () => remove(game.lyingBombs, bomb));
  }
  for (const bomb of game.thrownBombs) {
    consider(bomb.explodesAt, () => explode(game, bomb));
  }
  for (const explosion of game.explosions) {
    consider(explosion.at + EXPLOSION_MS, () => remove(game.explosions, explosion));
  }
  return due;
}

// When arrival `number` (2, 3, 4, …) comes: ENEMY_ARRIVALS, then one every
// LATER_ARRIVAL_EVERY without end. Arrival 1 is the enemy present at the start.
function arrivalTime(number) {
  const listed = ENEMY_ARRIVALS[number - 2];
  return listed ?? ENEMY_ARRIVALS.at(-1) + (number - 1 - ENEMY_ARRIVALS.length) * LATER_ARRIVAL_EVERY;
}

// The arrival count never goes down, so a destroyed enemy changes no later arrival.
function arrive(game, at) {
  game.arrivals += 1;
  const enemy = newEnemy(game.arrivals, at, game.random);
  game.enemies.push(enemy);
  game.events.push('enemy');
  if (game.arrivals % BOMB_EVERY === 0) placeBomb(game);
  if (sameCell(enemy, game.player)) hitPlayer(game);
}

// Arrival numbers 3, 5, 7, … shoot. Step times: ENEMY_INTERVALS, then random.
function newEnemy(number, arrivedAt, random) {
  const interval = ENEMY_INTERVALS[number - 1]
    ?? LATER_INTERVAL_MIN + Math.floor(random() * (LATER_INTERVAL_MAX - LATER_INTERVAL_MIN + 1));
  const shooter = number >= 3 && number % 2 === 1;
  const enemy = { ...ENEMY_START, interval, nextStepAt: arrivedAt + interval, steps: 0, shooter };
  if (shooter) enemy.nextShotAt = arrivedAt + SHOT_EVERY;
  return enemy;
}

function movePlayer(game, dir) {
  const { player } = game;
  const [dx, dy] = DIRECTIONS[dir];
  const x = wrapX(player.x + dx);
  const y = wrapY(player.y + dy);
  // Across an edge the player is drawn on the new cell at once, not across the board.
  const wrapped = x !== player.x + dx || y !== player.y + dy;
  glide(game, player, wrapped ? 0 : REPEAT_EVERY, () => {
    player.x = x;
    player.y = y;
  });
  player.facing = dir;

  for (const heart of game.hearts) {
    if (!sameCell(heart, player)) continue;
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
  for (const bomb of game.lyingBombs.filter((lying) => sameCell(lying, player))) {
    remove(game.lyingBombs, bomb);
    game.bombs += 1;
  }

  checkContact(game);
}

function stepEnemy(game, enemy) {
  for (const heart of game.hearts) {
    if (sameCell(heart, enemy)) placeHeart(game, heart);
  }
  glide(game, enemy, enemy.interval, () => chase(enemy, game.player));
  if (sameCell(enemy, game.player)) hitPlayer(game);
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

// A projectile flies from the shooter's cell in a straight line through the cell the
// player is on now: after n steps it is on origin + round(n × direction), where one step
// is one cell along the longer axis.
function fire(game, shooter) {
  const dx = game.player.x - shooter.x;
  const dy = game.player.y - shooter.y;
  const longer = Math.max(Math.abs(dx), Math.abs(dy));
  if (longer === 0) return; // the safe player stands on the shooter: no direction
  game.projectiles.push({
    x: shooter.x,
    y: shooter.y,
    originX: shooter.x,
    originY: shooter.y,
    dirX: dx / longer,
    dirY: dy / longer,
    steps: 0,
    nextStepAt: game.time + PROJECTILE_STEP,
  });
}

// Every step changes the cell along the longer axis, so `steps` counts the cells flown.
// The step that would leave the playable area removes the projectile. It passes over
// hearts, bombs and enemies without changing them.
function stepProjectile(game, projectile) {
  const n = projectile.steps + 1;
  const x = projectile.originX + Math.round(n * projectile.dirX);
  const y = projectile.originY + Math.round(n * projectile.dirY);
  if (!isPlayable(x, y)) {
    remove(game.projectiles, projectile);
    return;
  }
  glide(game, projectile, PROJECTILE_STEP, () => {
    projectile.x = x;
    projectile.y = y;
  });
  if (sameCell(projectile, game.player)) shotHits(game, projectile);
}

// While the player is safe a projectile is left alone and flies on.
function shotHits(game, projectile) {
  if (isSafe(game)) return;
  remove(game.projectiles, projectile);
  hitPlayer(game);
}

// The player on a cell an enemy or a projectile also holds: one life.
function checkContact(game) {
  if (game.enemies.some((enemy) => sameCell(enemy, game.player))) {
    hitPlayer(game);
    return;
  }
  const projectile = game.projectiles.find((shot) => sameCell(shot, game.player));
  if (projectile) shotHits(game, projectile);
}

// One bomb on a random cell that holds no other piece.
function placeBomb(game) {
  const taken = [game.player, ...game.hearts, ...game.enemies, ...game.projectiles, ...game.lyingBombs];
  const cells = playableCells().filter((cell) => !taken.some((piece) => sameCell(piece, cell)));
  if (cells.length === 0) return;
  game.lyingBombs.push({ ...randomCell(game, cells), placedAt: game.time });
}

function explode(game, bomb) {
  remove(game.thrownBombs, bomb);
  const inBlast = (piece) => ((piece.x - bomb.x) / BLAST_COLUMNS) ** 2 + ((piece.y - bomb.y) / BLAST_ROWS) ** 2 <= 1;
  removeWhere(game.enemies, inBlast);
  removeWhere(game.projectiles, inBlast);
  game.explosions.push({ x: bomb.x, y: bomb.y, at: game.time });
  game.events.push('explosion');
  if (inBlast(game.player)) hitPlayer(game);
}

// Takes one life unless the player is safe. With lives left the game goes on: the player
// reappears far from every enemy and is safe for SAFE_MS; the held direction stays.
function hitPlayer(game) {
  if (isSafe(game)) return;
  game.lives -= 1;
  if (game.lives <= 0) {
    endGame(game);
    return;
  }
  game.events.push('life-lost');
  Object.assign(game.player, respawnCell(game), {
    glideMs: 0, safeUntil: game.time + SAFE_MS, safeEndPending: true,
  });
}

// A random playable cell with no heart or lying bomb, at least RESPAWN_DISTANCE cells
// from every enemy; when there is none, one of the cells farthest from their nearest enemy.
function respawnCell(game) {
  const occupied = [...game.hearts, ...game.lyingBombs];
  let best = -1;
  let cells = [];
  for (const cell of playableCells()) {
    if (occupied.some((piece) => sameCell(piece, cell))) continue;
    let nearest = RESPAWN_DISTANCE;
    for (const enemy of game.enemies) {
      nearest = Math.min(nearest, Math.max(Math.abs(enemy.x - cell.x), Math.abs(enemy.y - cell.y)));
    }
    if (nearest > best) {
      best = nearest;
      cells = [];
    }
    if (nearest === best) cells.push(cell);
  }
  return randomCell(game, cells);
}

// One call of game.random(), so a scripted random always ends.
function randomCell(game, cells) {
  return cells[Math.floor(game.random() * cells.length)];
}

function playableCells() {
  const cells = [];
  for (let y = 1; y <= 30; y += 1) {
    for (let x = 2; x <= 99; x += 1) cells.push({ x, y });
  }
  return cells;
}

// Moves `piece` with `move`; when its cell changed, counts the step and draws the move
// over `ms`, starting from where the piece is drawn now.
function glide(game, piece, ms, move) {
  const from = positionAt(piece, game.time);
  const { x, y } = piece;
  move();
  if (piece.x === x && piece.y === y) return;
  Object.assign(piece, {
    fromX: from.x, fromY: from.y, movedAt: game.time, glideMs: ms, steps: (piece.steps ?? 0) + 1,
  });
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

function remove(list, item) {
  const index = list.indexOf(item);
  if (index >= 0) list.splice(index, 1);
}

// Removes in place, so a list held elsewhere (the page, a test) stays the game's list.
function removeWhere(list, test) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (test(list[i])) list.splice(i, 1);
  }
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}
