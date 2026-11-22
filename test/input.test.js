import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createHeld, keyDirection, readKey } from '../public/js/input.js';

const key = (k, extra = {}) => ({ key: k, repeat: false, ctrlKey: false, altKey: false, metaKey: false, ...extra });

describe('readKey', () => {
  it('gives a direction for the arrows', () => {
    assert.deepEqual(readKey(key('ArrowUp')), { dir: 'up' });
    assert.deepEqual(readKey(key('ArrowDown')), { dir: 'down' });
    assert.deepEqual(readKey(key('ArrowLeft')), { dir: 'left' });
    assert.deepEqual(readKey(key('ArrowRight')), { dir: 'right' });
  });

  it('gives a diagonal and a letter for q e a d, in either case', () => {
    const diagonals = { q: 'upLeft', e: 'upRight', a: 'downLeft', d: 'downRight' };
    for (const [k, dir] of Object.entries(diagonals)) {
      assert.deepEqual(readKey(key(k)), { letter: k.toUpperCase(), dir });
      assert.deepEqual(readKey(key(k.toUpperCase())), { letter: k.toUpperCase(), dir });
    }
  });

  it('gives a letter for the other letters, and the actions for Enter, Escape and Backspace', () => {
    assert.deepEqual(readKey(key('b')), { letter: 'B' });
    assert.deepEqual(readKey(key('Z')), { letter: 'Z' });
    assert.deepEqual(readKey(key('Enter')), { action: 'confirm' });
    assert.deepEqual(readKey(key('Escape')), { action: 'back' });
    assert.deepEqual(readKey(key('Backspace')), { action: 'erase' });
  });

  it('ignores the browser key repeat, modifiers and keys it does not use', () => {
    assert.equal(readKey(key('ArrowRight', { repeat: true })), null);
    assert.equal(readKey(key('d', { repeat: true })), null);
    assert.equal(readKey(key('r', { ctrlKey: true })), null);
    assert.equal(readKey(key('r', { metaKey: true })), null);
    assert.equal(readKey(key('ArrowLeft', { altKey: true })), null);
    assert.equal(readKey(key('1')), null);
    assert.equal(readKey(key(' ')), null);
    assert.equal(readKey(key('Tab')), null);
    assert.equal(readKey(key('é')), null);
  });
});

describe('keyDirection', () => {
  it('reads the direction of a released key whatever the modifiers', () => {
    assert.equal(keyDirection(key('ArrowUp', { metaKey: true })), 'up');
    assert.equal(keyDirection(key('Q')), 'upLeft');
    assert.equal(keyDirection(key('x')), null);
    assert.equal(keyDirection(key('Enter')), null);
  });
});

describe('createHeld', () => {
  it('says whether a direction is newly down', () => {
    const held = createHeld();
    assert.equal(held.down('right'), true);
    assert.equal(held.down('right'), false);
  });

  it('returns the last direction still down on a release', () => {
    const held = createHeld();
    held.down('right');
    held.down('up');
    assert.equal(held.up('up'), 'right');
    assert.equal(held.up('right'), null);
  });

  it('keeps the newest direction when an older one is released', () => {
    const held = createHeld();
    held.down('right');
    held.down('up');
    assert.equal(held.up('right'), 'up');
  });

  it('forgets every direction on clear', () => {
    const held = createHeld();
    held.down('right');
    held.down('up');
    held.clear();
    assert.equal(held.up('left'), null);
    assert.equal(held.down('right'), true);
  });
});
