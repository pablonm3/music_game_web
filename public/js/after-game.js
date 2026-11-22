// The screen that follows a game: GAME OVER with the score, then either the name entry
// (when the score qualifies) or the leaderboard, then play again or back to the menu.

import { applyNameAction, createNameEntry, MAX_LETTERS } from './name-entry.js';
import { rankingLines } from './screens.js';

// As the original paused here; it also keeps keys still being mashed out of the name.
const INPUT_PAUSE_MS = 1000;

export function createAfterGame({ score, api, audio, render, onPlayAgain, onMenu }) {
  // waiting → (name → sending →) board
  let phase = 'waiting';
  let entry = null;
  let board = null;
  let active = true;

  const pause = new Promise((resolve) => setTimeout(resolve, INPUT_PAUSE_MS));
  Promise.all([api.load(score), pause]).then(([answer]) => {
    if (!active) return;
    if (!answer.unavailable && answer.qualifies) {
      audio.play('record');
      entry = createNameEntry();
      phase = 'name';
      draw();
    } else {
      showBoard(answer.unavailable ? answer : { entries: answer.entries });
    }
  });
  draw();

  function showBoard(result) {
    board = result;
    phase = 'board';
    draw();
  }

  function draw() {
    const lines = [{ text: `GAME OVER, YOUR SCORE: ${score}` }];
    if (phase === 'name') {
      lines.push(
        { text: '' },
        { text: 'NEW HIGH SCORE! ENTER YOUR NAME' },
        { text: '' },
        { large: true, parts: nameSlots(entry) },
        { text: '' },
        { text: 'TYPE OR USE ARROWS   ENTER: OK', tone: 'hint' },
      );
    } else if (phase === 'sending') {
      lines.push({ text: '' }, { text: 'SAVING...' });
    } else if (phase === 'board') {
      lines.push(
        { text: '' },
        { text: 'LEADERBOARD', tone: 'title' },
        { text: '' },
        ...rankingLines(board),
        { text: '' },
        { text: 'ENTER: PLAY AGAIN   ESC: MENU', tone: 'hint' },
      );
    }
    render(lines);
  }

  return {
    onAction(action) {
      if (phase === 'name') {
        const name = applyNameAction(entry, action);
        if (name) {
          phase = 'sending';
          api.submit(name, score).then((result) => {
            if (!active) return;
            showBoard(result.unavailable ? result : { entries: result.entries, highlight: result.rank });
          });
        }
        draw();
      } else if (phase === 'board') {
        if (action.type === 'confirm') onPlayAgain();
        else if (action.type === 'back') onMenu();
      }
    },

    dispose() {
      active = false;
    },
  };
}

// Five slots, '_' for an empty one, the selected slot in inverse colours: B O B _ _
function nameSlots(entry) {
  const parts = [];
  for (let slot = 0; slot < MAX_LETTERS; slot += 1) {
    if (slot > 0) parts.push({ text: ' ' });
    parts.push({ text: entry.letters[slot] ?? '_', highlight: slot === entry.cursor });
  }
  return parts;
}
