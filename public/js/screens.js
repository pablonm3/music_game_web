// The text screens: menu, the legend PLAY opens, how to play (the legend, then the rules),
// leaderboard. A screen is a list of lines; the line builders have no DOM, renderLines
// draws them. Every screen fits in 16 lines of 50 characters (a large line counts as
// three), so it still fits at twice the size on a phone. Every line but the first is at
// most 50 characters wide, a large character counting three, so on a phone it fits
// between the controls of the two bottom corners.
//
// A line is {text, large?, highlight?, tone?} or {parts: [{text, highlight?}], large?}.
// A highlighted line is drawn in inverse colours and starts with '>'.

export const MENU_ENTRIES = ['PLAY', 'LEADERBOARD', 'HOW TO PLAY'];

const BLANK = { text: '' };

export function menuLines(selected) {
  return [
    { text: 'PROGRAMMER SAVE HUMANITY', large: true, tone: 'title' },
    BLANK,
    ...MENU_ENTRIES.map((entry, i) => choice(entry, i === selected, { large: true })),
    BLANK,
    { text: 'UP/DOWN: CHOOSE   ENTER: OPEN', tone: 'hint' },
  ];
}

export const HOW_TO_PLAY_LINES = [
  { text: 'HOW TO PLAY', tone: 'title' },
  BLANK,
  { text: 'TURN THE SOUND ON. A VOICE NAMES A COLOUR:' },
  { text: 'RED, BLUE OR CYAN. IT IS NOT SHOWN ON SCREEN.' },
  { text: 'TAKE THAT SHROOM: +5. THE OTHER SHROOMS: -15.' },
  BLANK,
  { text: 'YOU HAVE 3 LIVES. ROBOTS CHASE YOU. ONE MORE COMES' },
  { text: 'AFTER 1 AND 2 MINUTES, THEN EVERY 20 SECONDS. SOME' },
  { text: 'SHOOT. A TOUCH OR A SHOT COSTS A LIFE. EDGES WRAP.' },
  BLANK,
  { text: 'PICK UP BOMBS BEFORE THEY VANISH. A THROWN BOMB' },
  { text: 'LANDS 14 CELLS AHEAD AND BLOWS UP ROBOTS AND SHOTS' },
  { text: 'AROUND IT. STAND CLEAR: IT COSTS A LIFE.' },
  BLANK,
  { text: 'MOVE: ARROWS, Q E A D (PHONE: THE JOYSTICK)' },
  { text: 'BOMB: SPACE (PHONE: BOMB)   ESC: MENU', tone: 'hint' },
];

// The legend, as laid out on screen: one string per line, broken between its sentences
// and inside them at a space.
const LEGEND = [
  '2027, THE WORLD HAS BEEN TAKEN BY AI',
  'AND YOU ARE THE LAST HOPE.',
  'LISTEN CAREFULLY TO THE MUSIC AND COLLECT THE',
  'MUSHROOMS OF THE CORRECT COLOUR TO HELP HUMANITY',
  'REGAIN THEIR LOST CONSCIOUSNESS AND SAVE US.',
  'MUSHROOMS OF THE WRONG COLOUR ARE POISONOUS.',
];

export const LEGEND_LENGTH = LEGEND.reduce((sum, line) => sum + line.length, 0);
const LEGEND_MS_PER_CHARACTER = 30;

// How many characters of the legend are written `ms` after its screen opened.
export function legendWrittenAt(ms) {
  return Math.min(LEGEND_LENGTH, Math.floor(ms / LEGEND_MS_PER_CHARACTER));
}

// The legend with its first `written` characters, in reading order. Spaces stand in for
// the rest: a line has its full length from the start, so its centred text never moves.
function legendText(written) {
  let above = 0; // characters on the lines above this one
  return LEGEND.map((line) => {
    const shown = line.slice(0, Math.max(0, written - above));
    above += line.length;
    return { text: shown.padEnd(line.length) };
  });
}

// The screen PLAY opens.
export function legendLines(written) {
  return [...legendText(written), BLANK, { text: 'PRESS ENTER TO START', tone: 'hint' }];
}

// The first screen of HOW TO PLAY; ENTER goes on to HOW_TO_PLAY_LINES.
export const HOW_TO_PLAY_LEGEND_LINES = [
  ...legendText(LEGEND_LENGTH),
  BLANK,
  { text: 'ENTER: RULES   ESC: MENU', tone: 'hint' },
];

// The ranked list, shared by the leaderboard screen and the screen after a game.
// `board` is {entries, highlight?} or {unavailable: true}; null while loading.
export function rankingLines(board) {
  if (!board) return [{ text: 'LOADING...' }];
  if (board.unavailable) return [{ text: 'LEADERBOARD UNAVAILABLE' }];
  if (board.entries.length === 0) return [{ text: 'NO SCORES YET' }];
  return board.entries.map((entry, i) => {
    const rank = i + 1;
    const text = `${String(rank).padStart(2)}. ${entry.name.padEnd(5)}${String(entry.score).padStart(7)}`;
    return choice(text, rank === board.highlight);
  });
}

export function leaderboardLines(board) {
  return [
    { text: 'LEADERBOARD', tone: 'title' },
    BLANK,
    ...rankingLines(board),
    BLANK,
    { text: 'ESC: MENU', tone: 'hint' },
  ];
}

function choice(text, highlighted, extra = {}) {
  return { ...extra, text: `${highlighted ? '>' : ' '} ${text}`, highlight: highlighted };
}

export function renderLines(container, lines) {
  container.replaceChildren(...lines.map(lineElement));
}

function lineElement(line) {
  const element = document.createElement('div');
  element.className = ['line', line.large && 'large', line.highlight && 'highlight', line.tone]
    .filter(Boolean)
    .join(' ');
  if (line.parts) {
    for (const part of line.parts) {
      const span = document.createElement('span');
      if (part.highlight) span.className = 'highlight';
      span.textContent = part.text;
      element.append(span);
    }
  } else {
    // A non-breaking space keeps the height of an empty line.
    element.textContent = line.text || ' ';
  }
  return element;
}
