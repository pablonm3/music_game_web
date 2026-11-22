import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tallyOf } from '../public/js/board.js';

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
