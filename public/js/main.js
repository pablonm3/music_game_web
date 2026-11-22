// Start-up and the frame loop. Every screen reads input actions (input.js), never keys,
// so keyboard and touch drive the same code.

import { createAfterGame } from './after-game.js';
import { createApi } from './api.js';
import { createAudio } from './audio.js';
import { createBoard } from './board.js';
import { advance, createGame, press, setRepeat } from './game.js';
import { attachButtons, attachKeys, createHeld } from './input.js';
import {
  HOW_TO_PLAY_LINES, leaderboardLines, MENU_ENTRIES, menuLines, renderLines,
} from './screens.js';

// A frame never runs more than this much game time, so a hidden tab pauses the game
// instead of letting the enemy catch up in one jump.
const MAX_FRAME_MS = 250;

const params = new URLSearchParams(location.search);
const debugMode = params.get('debug') === '1';
const touchMode = params.get('touch') === '1' || matchMedia('(pointer: coarse)').matches;
// On <html>: the size variables are computed on :root and would not see a body class.
if (touchMode) document.documentElement.classList.add('touch');

const boardElement = document.getElementById('board');
const textElement = document.getElementById('text');
const audio = createAudio();
const api = createApi();
const board = createBoard(boardElement);

let screen = null; // {name, onAction}
let game = null;
let afterGame = null;

function showText(lines) {
  boardElement.hidden = true;
  textElement.hidden = false;
  renderLines(textElement, lines);
}

function showBoard() {
  textElement.hidden = true;
  boardElement.hidden = false;
}

function leaveAfterGame() {
  afterGame?.dispose();
  afterGame = null;
}

function openMenu(selected = 0) {
  leaveAfterGame();
  let highlighted = selected;
  const draw = () => showText(menuLines(highlighted));
  const open = [startGame, openLeaderboard, openHowToPlay];
  draw();
  screen = {
    name: 'menu',
    onAction(action) {
      if (action.type === 'press' && (action.dir === 'up' || action.dir === 'down')) {
        const by = action.dir === 'up' ? -1 : 1;
        highlighted = Math.min(MENU_ENTRIES.length - 1, Math.max(0, highlighted + by));
        draw();
      } else if (action.type === 'confirm') {
        open[highlighted]();
      }
    },
  };
}

function openHowToPlay() {
  showText(HOW_TO_PLAY_LINES);
  screen = {
    name: 'how-to-play',
    onAction(action) {
      if (action.type === 'back') openMenu(MENU_ENTRIES.indexOf('HOW TO PLAY'));
    },
  };
}

function openLeaderboard() {
  showText(leaderboardLines(null));
  const current = {
    name: 'leaderboard',
    onAction(action) {
      if (action.type === 'back') openMenu(MENU_ENTRIES.indexOf('LEADERBOARD'));
    },
  };
  screen = current;
  api.load().then((result) => {
    if (screen === current) showText(leaderboardLines(result));
  });
}

// Runs inside a key or tap handler: browsers only let sound start there.
function startGame() {
  leaveAfterGame();
  audio.unlock();
  audio.startMusic();
  game = createGame();
  board.draw(game);
  showBoard();
  screen = {
    name: 'game',
    onAction(action) {
      if (action.type === 'press') press(game, action.dir);
      else if (action.type === 'repeat') setRepeat(game, action.dir);
    },
  };
}

function openAfterGame(score) {
  afterGame = createAfterGame({
    score,
    api,
    audio,
    render: showText,
    onPlayAgain: startGame,
    onMenu: () => openMenu(0),
  });
  const controller = afterGame;
  screen = { name: 'after-game', onAction: (action) => controller.onAction(action) };
}

function playEvents() {
  for (const event of game.events.splice(0)) {
    if (event === 'over') {
      audio.stopMusic();
      audio.play('error');
      openAfterGame(game.score);
      return;
    }
    audio.play(event);
  }
}

function onAction(action) {
  audio.unlock();
  screen.onAction(action);
}

openMenu(0);

const held = createHeld();
attachKeys(window, held, onAction);
attachButtons(document.getElementById('controls'), held, onAction);

const debug = debugMode
  ? (await import('./debug.js')).installDebug({ getGame: () => game, getScreen: () => screen.name, audio })
  : null;

let lastFrame = performance.now();
function frame(now) {
  const elapsed = Math.min(Math.max(now - lastFrame, 0), MAX_FRAME_MS);
  lastFrame = now;
  if (screen.name === 'game') {
    if (!debugMode) advance(game, elapsed);
    playEvents();
    board.draw(game);
  }
  debug?.update();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
