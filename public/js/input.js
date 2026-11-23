// Turns keys, touch buttons and the joystick into the actions every screen reads:
//   {type: 'press', dir}   a direction newly down
//   {type: 'repeat', dir}  the direction that keeps repeating after a release, or null;
//                          also the joystick's new direction when the finger slides to it
//   {type: 'confirm'} {type: 'back'} {type: 'erase'} {type: 'bomb'} {type: 'letter', letter}
// readKey, createHeld, stickDirection and stickAction have no DOM and are tested in Node.

const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const DIAGONAL_LETTERS = { q: 'upLeft', e: 'upRight', a: 'downLeft', d: 'downRight' };
const KEY_ACTIONS = { Enter: 'confirm', Escape: 'back', Backspace: 'erase', ' ': 'bomb' };

// What a keydown means: {dir?, letter?, action?}, or null for a key the page leaves to
// the browser. The browser's own key repeat is ignored: the game does the repeating.
export function readKey(event) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key;
  if (ARROWS[key]) return { dir: ARROWS[key] };
  if (KEY_ACTIONS[key]) return { action: KEY_ACTIONS[key] };
  if (typeof key === 'string' && /^[a-z]$/i.test(key)) {
    // q, e, a and d are both a diagonal and a letter: the name entry ignores diagonals
    // and the game ignores letters.
    const meaning = { letter: key.toUpperCase() };
    const dir = DIAGONAL_LETTERS[key.toLowerCase()];
    if (dir) meaning.dir = dir;
    return meaning;
  }
  return null;
}

// The direction a key stands for, whatever the modifiers; used on release.
export function keyDirection(event) {
  const key = event.key;
  if (ARROWS[key]) return ARROWS[key];
  return typeof key === 'string' ? DIAGONAL_LETTERS[key.toLowerCase()] ?? null : null;
}

// The directions currently down, in press order.
export function createHeld() {
  let down = [];
  return {
    // true when `dir` was not down yet
    down(dir) {
      if (down.includes(dir)) return false;
      down.push(dir);
      return true;
    },
    // the direction that should repeat now: the last one still down, or null
    up(dir) {
      down = down.filter((other) => other !== dir);
      return down.at(-1) ?? null;
    },
    clear() {
      down = [];
    },
  };
}

export function attachKeys(target, held, onAction) {
  target.addEventListener('keydown', (event) => {
    const meaning = readKey(event);
    if (!meaning) return;
    event.preventDefault();
    if (meaning.dir && held.down(meaning.dir)) onAction({ type: 'press', dir: meaning.dir });
    if (meaning.letter) onAction({ type: 'letter', letter: meaning.letter });
    if (meaning.action) onAction({ type: meaning.action });
  });

  target.addEventListener('keyup', (event) => {
    // macOS sends no keyup for keys released while Cmd is down: forget them all.
    if (event.key === 'Meta') return releaseAll(held, onAction);
    const dir = keyDirection(event);
    if (dir) onAction({ type: 'repeat', dir: held.up(dir) });
  });

  target.addEventListener('blur', () => releaseAll(held, onAction));
}

// Touch buttons: [data-action] buttons send their action on click (sound may only start
// at the end of a touch, not at its start), [data-press] buttons send theirs on
// pointerdown: a second finger tapping while the first holds the joystick does not
// reliably make a click.
export function attachButtons(root, onAction) {
  for (const button of root.querySelectorAll('[data-action]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onAction({ type: button.dataset.action });
    });
  }

  for (const button of root.querySelectorAll('[data-press]')) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      onAction({ type: button.dataset.press });
    });
  }

  root.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Clockwise from right, as the screen's angles run (y grows downward).
const STICK_DIRECTIONS = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];
const EIGHTH_TURN = Math.PI / 4;

// The direction a finger `dx`, `dy` px from the joystick's middle asks for: the nearest
// of the eight, or null within `centre` px of the middle. There is no outer limit, so a
// finger that slid off the joystick still steers.
export function stickDirection(dx, dy, centre) {
  if (Math.hypot(dx, dy) <= centre) return null;
  const eighths = Math.round(Math.atan2(dy, dx) / EIGHTH_TURN); // -4 to 4
  return STICK_DIRECTIONS[(eighths + 8) % 8];
}

// The action for a change of the joystick's direction (null: at rest), or null for none;
// `held` is the one the keys use. A push from rest is a press, as a key going down. A
// slide only changes which direction repeats: no cell is added and the repeat keeps its
// time. Back at rest, whatever else is still held repeats.
export function stickAction(held, from, to) {
  if (from === to) return null;
  if (from === null) return held.down(to) ? { type: 'press', dir: to } : null;
  const stillDown = held.up(from);
  if (to === null) return { type: 'repeat', dir: stillDown };
  held.down(to);
  return { type: 'repeat', dir: to };
}

// Of the joystick's radius. A finger sends a direction once it is further than PUSH_AT
// from the middle, and none again once it is back within REST_AT: with one line for
// both, a finger resting on it would press again and again.
const PUSH_AT = 1 / 3;
const REST_AT = 1 / 5;

// One finger steers the joystick at a time; it is captured, so it keeps steering outside
// the drawn circle until it lifts. While a direction is sent the joystick has
// data-sending="<dir>", and --dx, --dy (-1 to 1) place its knob on that direction.
export function attachJoystick(stick, held, onAction) {
  let finger = null; // pointerId of the finger steering
  let dir = null;    // the direction being sent

  const steer = (next) => {
    const action = stickAction(held, dir, next);
    dir = next;
    showDirection(stick, dir);
    if (action) onAction(action);
  };
  const read = (event) => {
    const box = stick.getBoundingClientRect();
    const radius = box.width / 2;
    const centre = radius * (dir === null ? PUSH_AT : REST_AT);
    steer(stickDirection(event.clientX - box.left - radius, event.clientY - box.top - radius, centre));
  };
  const release = (event) => {
    if (event.pointerId !== finger) return;
    finger = null;
    steer(null);
  };

  stick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (finger !== null) return;
    finger = event.pointerId;
    stick.setPointerCapture?.(finger);
    read(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === finger) read(event);
  });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);
  stick.addEventListener('lostpointercapture', release);
}

// For the CSS: the knob's place, on the circle in the direction sent or in the middle.
function showDirection(stick, dir) {
  const angle = STICK_DIRECTIONS.indexOf(dir) * EIGHTH_TURN;
  const [dx, dy] = dir === null ? [0, 0] : [Math.cos(angle), Math.sin(angle)];
  stick.style.setProperty('--dx', String(Math.round(dx * 1000) / 1000));
  stick.style.setProperty('--dy', String(Math.round(dy * 1000) / 1000));
  if (dir === null) delete stick.dataset.sending;
  else stick.dataset.sending = dir;
}

function releaseAll(held, onAction) {
  held.clear();
  onAction({ type: 'repeat', dir: null });
}
