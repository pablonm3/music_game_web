// Turns keys and touch buttons into the actions every screen reads:
//   {type: 'press', dir}   a direction newly down
//   {type: 'repeat', dir}  the direction that keeps repeating after a release, or null
//   {type: 'confirm'} {type: 'back'} {type: 'erase'} {type: 'letter', letter}
// readKey and createHeld have no DOM and are tested in Node.

const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const DIAGONAL_LETTERS = { q: 'upLeft', e: 'upRight', a: 'downLeft', d: 'downRight' };
const KEY_ACTIONS = { Enter: 'confirm', Escape: 'back', Backspace: 'erase' };

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

// Touch buttons: [data-dir] buttons behave like held keys, [data-action] buttons send
// their action on click (sound may only start at the end of a touch, not at its start).
export function attachButtons(root, held, onAction) {
  for (const button of root.querySelectorAll('[data-dir]')) {
    const dir = button.dataset.dir;
    let pointer = null;
    const release = () => {
      if (pointer === null) return;
      pointer = null;
      button.classList.remove('down');
      onAction({ type: 'repeat', dir: held.up(dir) });
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (pointer !== null) return;
      pointer = event.pointerId;
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('down');
      if (held.down(dir)) onAction({ type: 'press', dir });
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  for (const button of root.querySelectorAll('[data-action]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onAction({ type: button.dataset.action });
    });
  }

  root.addEventListener('contextmenu', (event) => event.preventDefault());
}

function releaseAll(held, onAction) {
  held.clear();
  onAction({ type: 'repeat', dir: null });
}
