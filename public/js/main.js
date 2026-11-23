// Start-up and the frame loop. Every screen reads input actions (input.js), never keys,
// so keyboard and touch drive the same code.

import { createAfterGame } from './after-game.js';
import { createApi } from './api.js';
import { createAudio } from './audio.js';
import { createBoard } from './board.js';
import { advance, createGame, press, setRepeat, throwBomb } from './game.js';
import { attachButtons, attachKeys, createHeld } from './input.js';
import {
  HOW_TO_PLAY_LEGEND_LINES, HOW_TO_PLAY_LINES, leaderboardLines, LEGEND_LENGTH, legendLines, legendWrittenAt,
  MENU_ENTRIES, menuLines, renderLines,
} from './screens.js';

// A frame never runs more than this much of the clock of the screen on show, so a hidden
// tab pauses the game instead of letting the enemy catch up in one jump.
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
const board = createBoard(boardElement, { touch: touchMode });

let screen = null; // {name, onAction, onTime?, status?}: onTime(ms) runs the screen's
                   // clock, status() adds to the test mode status line
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
  const open = [openLegend, openLeaderboard, openHowToPlay];
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

// The legend PLAY opens, written one character at a time on the screen's clock. ENTER
// starts the game, written or not; ESC goes back to the menu.
function openLegend() {
  game = null; // no game yet: the one that ended, if any, is not shown as current
  let elapsed = 0;
  let written = 0;
  showText(legendLines(written));
  screen = {
    name: 'legend',
    onAction(action) {
      if (action.type === 'confirm') startGame();
      else if (action.type === 'back') openMenu(MENU_ENTRIES.indexOf('PLAY'));
    },
    onTime(ms) {
      if (!(ms > 0)) return;
      elapsed += ms;
      const now = legendWrittenAt(elapsed);
      if (now === written) return;
      written = now;
      showText(legendLines(written));
    },
    status: () => `written=${written}/${LEGEND_LENGTH}`,
  };
}

// HOW TO PLAY opens on the legend; ENTER shows the rules.
function openHowToPlay() {
  showText(HOW_TO_PLAY_LEGEND_LINES);
  screen = {
    name: 'how-to-play-legend',
    onAction(action) {
      if (action.type === 'confirm') openHowToPlayRules();
      else if (action.type === 'back') openMenu(MENU_ENTRIES.indexOf('HOW TO PLAY'));
    },
  };
}

// The rules page, `screen=how-to-play` on the test mode status line.
function openHowToPlayRules() {
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
      else if (action.type === 'bomb') throwBomb(game);
    },
    onTime: (ms) => advance(game, ms),
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
  ? (await import('./debug.js')).installDebug({ getGame: () => game, getScreen: () => screen, audio })
  : null;

let lastFrame = performance.now();
function frame(now) {
  const elapsed = Math.min(Math.max(now - lastFrame, 0), MAX_FRAME_MS);
  lastFrame = now;
  if (!debugMode) screen.onTime?.(elapsed); // test mode: only mg.advance runs a clock
  if (screen.name === 'game') {
    playEvents();
    board.draw(game);
  }
  debug?.update();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
