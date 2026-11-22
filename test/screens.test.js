import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HOW_TO_PLAY_LINES, leaderboardLines, menuLines } from '../public/js/screens.js';

const MAX_LINES = 16;
const MAX_WIDTH = 50;

// A large line is drawn at three times the size, so it takes three lines of room.
const height = (lines) => lines.reduce((sum, line) => sum + (line.large ? 3 : 1), 0);
const text = (line) => line.text ?? line.parts.map((part) => part.text).join('');

describe('text screens', () => {
  it('fit in 16 lines of 50 characters', () => {
    for (const lines of [HOW_TO_PLAY_LINES, menuLines(0), leaderboardLines({ entries: [] })]) {
      assert.ok(height(lines) <= MAX_LINES, `${height(lines)} lines`);
      for (const line of lines) assert.ok(text(line).length <= MAX_WIDTH, text(line));
    }
  });

  it('explain lives, shooters, bombs and the throw key in HOW TO PLAY, and call the hearts shrooms', () => {
    const all = HOW_TO_PLAY_LINES.map(text).join('\n');
    for (const word of ['SHROOMS', 'LIVES', 'SHOOT', 'BOMB', 'SPACE']) assert.match(all, new RegExp(word));
    assert.doesNotMatch(all, /@/);
    assert.doesNotMatch(all, /HEART/i);
  });
});
