import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { THROW_CELLS } from '../public/js/game.js';
import {
  HOW_TO_PLAY_LEGEND_LINES, HOW_TO_PLAY_LINES, LEGEND_LENGTH, leaderboardLines, legendLines, legendWrittenAt, menuLines,
} from '../public/js/screens.js';

const MAX_LINES = 16;
const MAX_WIDTH = 50;
// A phone row holds 83 normal characters and a large one is three wide.
const MAX_LARGE_WIDTH = 27;
// Below its first line a phone screen stands between the controls: room for 50
// characters, a large one counting three.
const MAX_WIDTH_BETWEEN_CONTROLS = 50;

// The ticket's words, as typed.
const TICKET_LEGEND = '2027, the world has been taken by AI and you are the last hope. Listen carefully to the music '
  + 'and collect the mushrooms of the correct colour to help humanity regain their lost consciousness and save us. '
  + 'Mushrooms of the wrong colour are poisonous.';

// A large line is drawn at three times the size, so it takes three lines of room.
const height = (lines) => lines.reduce((sum, line) => sum + (line.large ? 3 : 1), 0);
const text = (line) => line.text ?? line.parts.map((part) => part.text).join('');
const width = (line) => text(line).length * (line.large ? 3 : 1);

const FULL_LEADERBOARD = {
  entries: Array.from({ length: 10 }, (_, i) => ({ name: 'WWWWW', score: 99999 - i })),
  highlight: 1,
};
const SCREENS = [
  HOW_TO_PLAY_LINES, HOW_TO_PLAY_LEGEND_LINES, menuLines(0), leaderboardLines({ entries: [] }),
  leaderboardLines(FULL_LEADERBOARD), legendLines(0), legendLines(LEGEND_LENGTH),
];

describe('text screens', () => {
  it('fit in 16 lines of 50 characters', () => {
    for (const lines of SCREENS) {
      assert.ok(height(lines) <= MAX_LINES, `${height(lines)} lines`);
      for (const line of lines) {
        assert.ok(text(line).length <= (line.large ? MAX_LARGE_WIDTH : MAX_WIDTH), text(line));
      }
    }
  });

  it('keep every line below the first narrow enough to fit between the phone controls', () => {
    for (const lines of SCREENS) {
      for (const line of lines.slice(1)) assert.ok(width(line) <= MAX_WIDTH_BETWEEN_CONTROLS, text(line));
    }
  });

  it('name the joystick, not the pad, for moving on a phone in HOW TO PLAY', () => {
    const all = HOW_TO_PLAY_LINES.map(text).join('\n');
    assert.match(all, /JOYSTICK/);
    assert.doesNotMatch(all, /PAD/);
  });

  it('explain lives, shooters, bombs and the throw key in HOW TO PLAY, and call the hearts shrooms', () => {
    const all = HOW_TO_PLAY_LINES.map(text).join('\n');
    for (const word of ['SHROOMS', 'LIVES', 'SHOOT', 'BOMB', 'SPACE']) assert.match(all, new RegExp(word));
    assert.doesNotMatch(all, /@/);
    assert.doesNotMatch(all, /HEART/i);
  });

  it("names the throw's length in the rules", () => {
    const all = HOW_TO_PLAY_LINES.map(text).join(' ');
    assert.match(all, new RegExp(`LANDS ${THROW_CELLS} CELLS AHEAD`));
  });

  it('title the menu with the name of the game, large', () => {
    const [title, ...rest] = menuLines(0);
    assert.equal(title.text, 'PROGRAMMER SAVE HUMANITY');
    assert.equal(title.large, true);
    for (const line of [title, ...rest]) assert.doesNotMatch(text(line), /MUSIC GAME/);
  });
});

describe('legend', () => {
  it("is the ticket's text in upper case, no word split between lines", () => {
    const lines = legendLines(LEGEND_LENGTH).slice(0, 6).map(text);
    assert.equal(lines.join(' '), TICKET_LEGEND.toUpperCase());
  });

  it('is written in reading order, every line at its full length from the start, the prompt always below', () => {
    const complete = legendLines(LEGEND_LENGTH).slice(0, 6).map(text);
    const final = complete.join('');
    assert.equal(final.length, LEGEND_LENGTH);
    for (let written = 0; written <= LEGEND_LENGTH; written += 1) {
      const lines = legendLines(written);
      assert.equal(lines.length, 8);
      const legend = lines.slice(0, 6).map(text);
      legend.forEach((line, i) => assert.equal(line.length, complete[i].length, `${written}: line ${i + 1}`));
      const shown = legend.join('');
      for (let p = 0; p < LEGEND_LENGTH; p += 1) {
        assert.equal(shown[p], p < written ? final[p] : ' ', `${written}: character ${p}`);
      }
      assert.equal(text(lines[6]), '');
      assert.equal(text(lines[7]), 'PRESS ENTER TO START');
    }
  });

  it('writes one character every 30 ms and is complete between 6 and 10 s', () => {
    assert.equal(legendWrittenAt(0), 0);
    assert.equal(legendWrittenAt(29), 0);
    assert.equal(legendWrittenAt(30), 1);
    assert.ok(legendWrittenAt(5999) < LEGEND_LENGTH);
    assert.equal(legendWrittenAt(10_000), LEGEND_LENGTH);
    assert.equal(legendWrittenAt(1e9), LEGEND_LENGTH);
  });

  it('opens HOW TO PLAY whole, with the keys for the rules and the menu and no start prompt', () => {
    assert.deepEqual(
      HOW_TO_PLAY_LEGEND_LINES.slice(0, 6).map(text),
      legendLines(LEGEND_LENGTH).slice(0, 6).map(text),
    );
    assert.ok(!HOW_TO_PLAY_LEGEND_LINES.some((line) => text(line) === 'PRESS ENTER TO START'));
    const last = text(HOW_TO_PLAY_LEGEND_LINES.at(-1));
    for (const word of ['ENTER', 'RULES', 'ESC', 'MENU']) assert.match(last, new RegExp(word));
  });
});
