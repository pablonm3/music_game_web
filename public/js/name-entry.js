// The name being entered after a qualifying game: 0 to 5 letters with no gaps, and the
// selected slot, which is one of the letters or the first empty slot after them.
// Up and down step through the letters; only on the last letter (or the empty slot
// after it) is there one more stop between Z and A, "empty", which is how a name is
// lengthened and shortened with the arrows alone.

export const MAX_LETTERS = 5;
const ALPHABET = 26;
const EMPTY = ALPHABET; // the stop after Z: no letter
const CODE_A = 'A'.charCodeAt(0);

const letterIndex = (letter) => letter.charCodeAt(0) - CODE_A;
const letterAt = (index) => String.fromCharCode(CODE_A + index);

export function createNameEntry() {
  return { letters: ['A'], cursor: 0 };
}

export function nameOf(entry) {
  return entry.letters.join('');
}

// Applies one input action. Returns the name to send when `confirm` is accepted,
// otherwise null.
export function applyNameAction(entry, action) {
  switch (action.type) {
    case 'letter':
      typeLetter(entry, action.letter);
      break;
    case 'press':
      if (action.dir === 'up') step(entry, +1);
      else if (action.dir === 'down') step(entry, -1);
      else if (action.dir === 'left') entry.cursor = Math.max(0, entry.cursor - 1);
      else if (action.dir === 'right') entry.cursor = Math.min(entry.cursor + 1, lastSlot(entry));
      break;
    case 'erase':
      entry.letters.pop();
      entry.cursor = Math.min(entry.cursor, lastSlot(entry));
      break;
    case 'confirm':
      return entry.letters.length > 0 ? nameOf(entry) : null;
    default:
      break;
  }
  return null;
}

// The rightmost slot that can be selected: the first empty one, or the fifth.
function lastSlot(entry) {
  return Math.min(entry.letters.length, MAX_LETTERS - 1);
}

function typeLetter(entry, letter) {
  if (!/^[A-Z]$/.test(letter)) return;
  entry.letters[entry.cursor] = letter;
  entry.cursor = Math.min(entry.cursor + 1, lastSlot(entry));
}

function step(entry, by) {
  const { letters, cursor } = entry;
  const onLast = cursor >= letters.length - 1;
  const stopCount = onLast ? ALPHABET + 1 : ALPHABET;
  const current = cursor < letters.length ? letterIndex(letters[cursor]) : EMPTY;
  const next = (current + by + stopCount) % stopCount;
  if (next === EMPTY) letters.length = cursor;
  else letters[cursor] = letterAt(next);
}
