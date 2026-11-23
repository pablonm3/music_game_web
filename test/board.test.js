import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bombHintText, tallyOf } from '../public/js/board.js';

describe('lives and bombs as icons', () => {
  it('shows one icon for each, up to five, and no number', () => {
    for (const count of [0, 1, 2, 3, 5]) {
      assert.deepEqual(tallyOf(count), { icons: count, number: '' }, String(count));
    }
  });

  it('shows one icon and the number above five', () => {
    for (const count of [6, 10, 99, 100]) {
      assert.deepEqual(tallyOf(count), { icons: 1, number: String(count) }, String(count));
    }
  });
});

describe('throw hint', () => {
  const HINT_COLUMNS = 38; // columns 32 to 69 of the row under the frame

  it('names Space on a desktop and the BOMB button on a phone, within its columns', () => {
    assert.equal(bombHintText(false), 'PRESS SPACE TO THROW BOMB');
    assert.match(bombHintText(true), /BOMB BUTTON/);
    assert.doesNotMatch(bombHintText(true), /SPACE/);
    for (const touch of [false, true]) assert.ok(bombHintText(touch).length <= HINT_COLUMNS, bombHintText(touch));
  });
});
