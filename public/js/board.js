// Draws the game screen. A 100 by 33 grid of fixed-size cells (grid column = x, grid row
// = y + 1) holds the frame and the row under it (lives and held bombs, the throw hint, the
// score), in the terminal look. Behind the playable cells lies the backdrop: a picture of
// the rainforest with animals moving over it, decoration only. The pieces are images laid
// over the grid: draw() sets --x and --y of each to the point positionAt gives, and the
// CSS centres the image there, so pieces glide between cells.

import { EXPLOSION_MS, isExpiring, isSafe, playerPose, positionAt, showsBombHint } from './game.js';

const COLUMNS = 100;
const FRAME_BOTTOM = 31;
const TEXT_ROW = 32;
const STATUS_COLUMN = 2;
const HINT_COLUMN = 32; // the hint has columns 32 to 69: past the tallies, its middle under the board's
const SCORE_COLUMN = 89;
const FLIGHT_LIFT_ROWS = 2; // a thrown bomb rises this high in the middle of its flight
const MOST_ICONS = 5;       // a count above this shows as one icon and the number

const IMAGES = {
  player: 'img/player-walk.png',
  robot: 'img/robot.png',
  shooter: 'img/robot-shooter.png',
  red: 'img/mushroom-red.png',
  blue: 'img/mushroom-blue.png',
  cyan: 'img/mushroom-cyan.png',
  bomb: 'img/bomb.png',
  life: 'img/life.png',
  projectile: 'img/projectile.png',
  explosion: 'img/explosion.png',
};

// The animals of the backdrop: class and image. Where and how each moves is in style.css.
const CRITTERS = [
  ['monkey monkey-1', 'img/monkey.png'],
  ['monkey monkey-2', 'img/monkey.png'],
  ['bird bird-1', 'img/bird.png'],
  ['bird bird-2', 'img/bird.png'],
  ['bird bird-3', 'img/bird.png'],
  ['flies flies-1', 'img/flies.png'],
  ['flies flies-2', 'img/flies.png'],
  ['flies flies-3', 'img/flies.png'],
];

// The words of the hint under the frame. The phone layout has a BOMB button and no Space.
export function bombHintText(touch) {
  return touch ? 'PRESS THE BOMB BUTTON TO THROW BOMB' : 'PRESS SPACE TO THROW BOMB';
}

// `touch`: the phone layout, which picks the words of the throw hint.
export function createBoard(container, { touch = false } = {}) {
  container.replaceChildren();
  // Loaded once now, so a piece that first appears mid-game does not pop in late.
  const preloaded = Object.values(IMAGES).map((src) => Object.assign(new Image(), { src }));

  const fragment = document.createDocumentFragment();
  fragment.append(backdrop());
  for (let x = 1; x <= COLUMNS; x += 1) {
    fragment.append(frameCell(x, 0, x === 1 ? '╔' : x === COLUMNS ? '╗' : '═'));
    fragment.append(frameCell(x, FRAME_BOTTOM, x === 1 ? '╚' : x === COLUMNS ? '╝' : '═'));
  }
  for (let y = 1; y < FRAME_BOTTOM; y += 1) {
    fragment.append(frameCell(1, y, '║'));
    fragment.append(frameCell(COLUMNS, y, '║'));
  }

  const hearts = ['red', 'blue', 'cyan'].map((colour) => pieceImage(`heart ${colour}`, IMAGES[colour]));
  const player = pieceImage('player', IMAGES.player);
  const status = textCell('status', STATUS_COLUMN);
  status.setAttribute('role', 'img'); // one picture to a screen reader; draw() writes its label
  const lives = tally('lives', IMAGES.life);
  const bombs = tally('bombs', IMAGES.bomb);
  status.append(lives.element, bombs.element);
  const hint = textCell('bomb-hint', HINT_COLUMN);
  hint.textContent = bombHintText(touch);
  hint.hidden = true;
  const score = textCell('score', SCORE_COLUMN);
  fragment.append(...hearts, player, status, hint, score);
  container.append(fragment);

  // One element per object of the game's lists, made when the object first shows.
  const enemies = new Map();
  const projectiles = new Map();
  const lyingBombs = new Map();
  const thrownBombs = new Map();
  const explosions = new Map();
  const add = (element) => container.appendChild(element);

  return {
    preloaded, // held so the loads finish even for images no element shows yet

    draw(game) {
      const { time } = game;
      game.hearts.forEach((heart, i) => moveTo(hearts[i], heart));

      syncElements(enemies, game.enemies, (enemy) => add(enemy.shooter
        ? pieceImage('enemy shooter', IMAGES.shooter)
        : pieceImage('enemy', IMAGES.robot)));
      for (const [enemy, element] of enemies) {
        moveTo(element, positionAt(enemy, time));
        // The second pose on odd steps: the legs and arms move with every step.
        element.classList.toggle('stride', enemy.steps % 2 === 1);
      }

      syncElements(projectiles, game.projectiles, () => add(pieceImage('projectile', IMAGES.projectile)));
      for (const [projectile, element] of projectiles) moveTo(element, positionAt(projectile, time));

      syncElements(lyingBombs, game.lyingBombs, () => add(pieceImage('bomb', IMAGES.bomb)));
      for (const [bomb, element] of lyingBombs) {
        moveTo(element, bomb);
        element.classList.toggle('flicker', isExpiring(game, bomb));
      }

      syncElements(thrownBombs, game.thrownBombs, () => add(pieceImage('bomb thrown', IMAGES.bomb)));
      for (const [bomb, element] of thrownBombs) moveTo(element, inFlight(bomb, time));

      syncElements(explosions, game.explosions, () => add(image('explosion', IMAGES.explosion)));
      for (const [explosion, element] of explosions) {
        moveTo(element, explosion);
        setVar(element, '--part', Math.min((time - explosion.at) / EXPLOSION_MS, 1));
      }

      moveTo(player, positionAt(game.player, time));
      setVar(player, '--pose', playerPose(game));
      player.classList.toggle('flicker', isSafe(game));

      lives.show(game.lives);
      bombs.show(game.bombs);
      setLabel(status, `lives ${game.lives}, bombs ${game.bombs}`);
      setHidden(hint, !showsBombHint(game));
      setText(score, `score: ${game.score}`);
    },
  };
}

// How a count shows in the row under the frame: one icon for each up to MOST_ICONS, above
// that one icon and the number.
export function tallyOf(count) {
  return count > MOST_ICONS ? { icons: 1, number: String(count) } : { icons: Math.max(count, 0), number: '' };
}

// One count of the row under the frame, drawn as icons. Hidden from a screen reader: the
// row's label says both counts in words.
function tally(word, src) {
  const element = document.createElement('span');
  element.className = `tally ${word}`;
  element.setAttribute('aria-hidden', 'true');
  let shown = null;
  return {
    element,
    show(count) {
      if (count === shown) return;
      shown = count;
      const { icons, number } = tallyOf(count);
      element.replaceChildren(...Array.from({ length: icons }, () => image('icon', src)));
      if (!number) return;
      const digits = document.createElement('span');
      digits.className = 'number';
      digits.textContent = number;
      element.append(digits);
    },
  };
}

// Keeps one element per object of `list`; `elements` is a Map from object to element.
function syncElements(elements, list, create) {
  for (const [object, element] of elements) {
    if (!list.includes(object)) {
      element.remove();
      elements.delete(object);
    }
  }
  for (const object of list) {
    if (!elements.has(object)) elements.set(object, create(object));
  }
}

// Where a thrown bomb is drawn: on its line, lifted in the middle of the flight so it
// reads as a throw, never above row 1 where the frame would cut it off.
function inFlight(bomb, time) {
  const { x, y } = positionAt(bomb, time);
  const part = Math.min(Math.max((time - bomb.movedAt) / bomb.glideMs, 0), 1);
  const lift = FLIGHT_LIFT_ROWS * 4 * part * (1 - part);
  return { x, y: Math.max(y - lift, 1) };
}

function backdrop() {
  const element = document.createElement('div');
  element.className = 'backdrop';
  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.append(image('still', 'img/background.jpg'));
  for (const [className, src] of CRITTERS) {
    const critter = document.createElement('div');
    critter.className = `critter ${className}`;
    critter.append(image('', src));
    scene.append(critter);
  }
  element.append(scene);
  return element;
}

function frameCell(x, y, character) {
  const cell = document.createElement('div');
  cell.className = 'frame';
  cell.textContent = character;
  place(cell, x, y);
  return cell;
}

function textCell(className, x) {
  const cell = document.createElement('div');
  cell.className = className;
  place(cell, x, TEXT_ROW);
  return cell;
}

function pieceImage(className, src) {
  return image(`piece ${className}`, src);
}

function image(className, src) {
  const element = document.createElement('img');
  if (className) element.className = className;
  element.src = src;
  element.alt = '';
  element.draggable = false;
  return element;
}

function place(element, x, y) {
  element.style.gridColumnStart = String(x);
  element.style.gridRowStart = String(y + 1);
}

function moveTo(element, { x, y }) {
  setVar(element, '--x', x);
  setVar(element, '--y', y);
}

// Writes only on a change, so a piece standing still costs the browser nothing.
function setVar(element, name, value) {
  const text = String(Math.round(value * 1000) / 1000);
  if (element.style.getPropertyValue(name) !== text) element.style.setProperty(name, text);
}

function setLabel(element, text) {
  if (element.getAttribute('aria-label') !== text) element.setAttribute('aria-label', text);
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function setHidden(element, hidden) {
  if (element.hidden !== hidden) element.hidden = hidden;
}
