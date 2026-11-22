import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyNameAction, createNameEntry, nameOf } from '../public/js/name-entry.js';

const letter = (l) => ({ type: 'letter', letter: l });
const dir = (d) => ({ type: 'press', dir: d });
const ERASE = { type: 'erase' };
const CONFIRM = { type: 'confirm' };

function run(actions, entry = createNameEntry()) {
  for (const action of actions) applyNameAction(entry, action);
  return entry;
}

describe('name entry', () => {
  it('starts as the single letter A, selected', () => {
    assert.deepEqual(createNameEntry(), { letters: ['A'], cursor: 0 });
  });

  it('builds a typed name', () => {
    const entry = run([letter('B'), letter('O'), letter('B')]);
    assert.equal(nameOf(entry), 'BOB');
    assert.equal(applyNameAction(entry, CONFIRM), 'BOB');
  });

  it('replaces the fifth letter with a sixth typed one', () => {
    const entry = run(['A', 'B', 'C', 'D', 'E', 'F'].map(letter));
    assert.equal(nameOf(entry), 'ABCDF');
  });

  it('removes the last letter on Backspace', () => {
    const entry = run([letter('B'), letter('O'), letter('B'), ERASE]);
    assert.equal(nameOf(entry), 'BO');
    assert.equal(entry.cursor, 2);
  });

  it('builds BOB with directions only, then shortens it to BO', () => {
    const entry = createNameEntry();
    run([dir('up')], entry);                                   // B
    run([dir('right'), dir('down'), ...Array(11).fill(dir('down'))], entry); // empty → Z, then down to O
    assert.equal(nameOf(entry), 'BO');
    run([dir('right'), dir('up'), dir('up')], entry);          // empty → A → B
    assert.equal(nameOf(entry), 'BOB');
    run(Array(25).fill(dir('up')), entry);                     // B up to Z, then past Z: empty
    assert.equal(nameOf(entry), 'BO');
    assert.equal(applyNameAction(entry, CONFIRM), 'BO');
  });

  it('wraps a letter that is not the last from A to Z without emptying it', () => {
    const entry = run([letter('A'), letter('B'), dir('left'), dir('left'), dir('down')]);
    assert.equal(nameOf(entry), 'ZB');
  });

  it('can empty the single letter, and then refuses to confirm', () => {
    const entry = run([dir('down')]);
    assert.deepEqual(entry.letters, []);
    assert.equal(applyNameAction(entry, CONFIRM), null);
    run([dir('down')], entry);
    assert.equal(nameOf(entry), 'Z');
  });

  it('moves the selection no further than the first empty slot, nor the fifth', () => {
    const entry = run([dir('right'), dir('right'), dir('right')]);
    assert.equal(entry.cursor, 1);
    run(['B', 'C', 'D', 'E'].map(letter), entry);
    run([dir('right'), dir('right')], entry);
    assert.equal(entry.cursor, 4);
    run([dir('left'), dir('left'), dir('left'), dir('left'), dir('left')], entry);
    assert.equal(entry.cursor, 0);
  });

  it('ignores Escape and diagonals', () => {
    const entry = run([{ type: 'back' }, dir('upLeft'), dir('downRight'), { type: 'hold', dir: null }]);
    assert.deepEqual(entry, { letters: ['A'], cursor: 0 });
  });

  it('never leaves a gap and always gives a name of 1 to 5 letters A-Z or none', () => {
    const actions = [
      ...['A', 'M', 'Z'].map(letter),
      dir('up'), dir('down'), dir('left'), dir('right'), dir('upLeft'), ERASE, CONFIRM, { type: 'back' },
    ];
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const entry = createNameEntry();
    for (let i = 0; i < 20_000; i += 1) {
      const sent = applyNameAction(entry, actions[Math.floor(random() * actions.length)]);
      const name = nameOf(entry);
      assert.ok(name === '' || /^[A-Z]{1,5}$/.test(name), name);
      assert.ok(entry.letters.every((l) => /^[A-Z]$/.test(l)), 'no gap');
      assert.ok(entry.cursor >= 0 && entry.cursor <= Math.min(entry.letters.length, 4), `cursor ${entry.cursor}`);
      if (sent !== null) assert.match(sent, /^[A-Z]{1,5}$/);
    }
  });
});
