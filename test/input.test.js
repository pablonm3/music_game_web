import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, createGame, press, setRepeat } from '../public/js/game.js';
import { createHeld, keyDirection, readKey, stickAction, stickDirection } from '../public/js/input.js';

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

  it('gives a letter for the other letters, and the actions for Enter, Escape, Backspace and Space', () => {
    assert.deepEqual(readKey(key('b')), { letter: 'B' });
    assert.deepEqual(readKey(key('Z')), { letter: 'Z' });
    assert.deepEqual(readKey(key('Enter')), { action: 'confirm' });
    assert.deepEqual(readKey(key('Escape')), { action: 'back' });
    assert.deepEqual(readKey(key('Backspace')), { action: 'erase' });
    assert.deepEqual(readKey(key(' ')), { action: 'bomb' });
  });

  it('ignores the browser key repeat, modifiers and keys it does not use', () => {
    assert.equal(readKey(key('ArrowRight', { repeat: true })), null);
    assert.equal(readKey(key('d', { repeat: true })), null);
    assert.equal(readKey(key('r', { ctrlKey: true })), null);
    assert.equal(readKey(key('r', { metaKey: true })), null);
    assert.equal(readKey(key('ArrowLeft', { altKey: true })), null);
    assert.equal(readKey(key('1')), null);
    assert.equal(readKey(key(' ', { repeat: true })), null, 'holding Space throws once');
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

describe('stickDirection', () => {
  const at = (degrees, distance = 40) => {
    const angle = (degrees * Math.PI) / 180;
    return stickDirection(Math.cos(angle) * distance, Math.sin(angle) * distance, 20);
  };

  it('gives each of the eight directions at its own angle, y growing downward', () => {
    const expected = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];
    expected.forEach((dir, i) => assert.equal(at(i * 45), dir, `${i * 45} degrees`));
    assert.equal(stickDirection(0, -40, 20), 'up');
    assert.equal(stickDirection(-30, 30, 20), 'downLeft');
  });

  it('takes the nearest direction: the line between two is at 22.5 degrees', () => {
    assert.equal(at(20), 'right');
    assert.equal(at(25), 'downRight');
    assert.equal(at(-20), 'right');
    assert.equal(at(-25), 'upRight');
    assert.equal(at(170), 'left');
    assert.equal(at(-170), 'left');
  });

  it('gives none at the middle and up to `centre` px from it', () => {
    assert.equal(stickDirection(0, 0, 20), null);
    assert.equal(stickDirection(20, 0, 20), null);
    assert.equal(stickDirection(12, -16, 20), null, '20 px away');
    assert.equal(stickDirection(20.1, 0, 20), 'right');
  });

  it('still gives a direction for a finger far outside the joystick', () => {
    assert.equal(stickDirection(0, -300, 20), 'up');
    assert.equal(stickDirection(-200, 20, 20), 'left');
  });
});

describe('stickAction', () => {
  it('presses on a push from rest and stops on the way back', () => {
    const held = createHeld();
    assert.deepEqual(stickAction(held, null, 'right'), { type: 'press', dir: 'right' });
    assert.deepEqual(stickAction(held, 'right', null), { type: 'repeat', dir: null });
  });

  it('repeats the new direction on a slide, and lets go of the old one', () => {
    const held = createHeld();
    stickAction(held, null, 'right');
    assert.deepEqual(stickAction(held, 'right', 'up'), { type: 'repeat', dir: 'up' });
    assert.deepEqual(stickAction(held, 'up', null), { type: 'repeat', dir: null }, 'right is not held any more');
  });

  it('sends nothing while the direction stays the same', () => {
    const held = createHeld();
    assert.equal(stickAction(held, null, null), null);
    stickAction(held, null, 'down');
    assert.equal(stickAction(held, 'down', 'down'), null);
  });

  it('shares the held directions with the keys', () => {
    const held = createHeld();
    held.down('left'); // a key
    stickAction(held, null, 'up');
    assert.deepEqual(stickAction(held, 'up', null), { type: 'repeat', dir: 'left' }, 'the key still repeats');
    assert.equal(stickAction(held, null, 'left'), null, 'a push in the direction a key holds');
  });

  it('turns without an extra cell and without a new wait when applied as the game screen does', () => {
    const game = createGame();
    game.enemies[0].nextStepAt = Infinity;
    const held = createHeld();
    const steer = (from, to) => {
      const action = stickAction(held, from, to);
      if (action?.type === 'press') press(game, action.dir);
      if (action?.type === 'repeat') setRepeat(game, action.dir);
    };
    const cell = () => [game.player.x, game.player.y];

    steer(null, 'right');
    assert.deepEqual(cell(), [51, 17]);
    advance(game, 240); // 180, 240
    assert.deepEqual(cell(), [53, 17]);
    steer('right', 'up');
    assert.deepEqual(cell(), [53, 17], 'no cell at the slide');
    advance(game, 300); // 300, 360, 420, 480, 540
    assert.deepEqual(cell(), [53, 12]);
    steer('up', null);
    advance(game, 500);
    assert.deepEqual(cell(), [53, 12]);
  });
});
