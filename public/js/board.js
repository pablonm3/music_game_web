// Draws the board as a 100 by 33 grid of fixed-size cells: grid column = x, grid row =
// y + 1. The frame and the score label are built once; draw() moves the seven pieces.

const COLUMNS = 100;
const FRAME_BOTTOM = 31;
const SCORE_ROW = 32;
const SCORE_COLUMN = 89;
const MAX_ENEMIES = 3;
// U+FE0E asks for the text form, so phones do not draw these as emoji.
const TEXT_STYLE = '︎';

export function createBoard(container) {
  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (let x = 1; x <= COLUMNS; x += 1) {
    fragment.append(frameCell(x, 0, x === 1 ? '╔' : x === COLUMNS ? '╗' : '═'));
    fragment.append(frameCell(x, FRAME_BOTTOM, x === 1 ? '╚' : x === COLUMNS ? '╝' : '═'));
  }
  for (let y = 1; y < FRAME_BOTTOM; y += 1) {
    fragment.append(frameCell(1, y, '║'));
    fragment.append(frameCell(COLUMNS, y, '║'));
  }

  const hearts = ['red', 'blue', 'cyan'].map((colour) => piece(`heart ${colour}`, `♥${TEXT_STYLE}`));
  const enemies = Array.from({ length: MAX_ENEMIES }, () => piece('enemy', '@'));
  const player = piece('player', `☺${TEXT_STYLE}`);
  const score = document.createElement('div');
  score.className = 'score';
  place(score, SCORE_COLUMN, SCORE_ROW);

  fragment.append(...hearts, ...enemies, player, score);
  container.append(fragment);

  return {
    draw(game) {
      game.hearts.forEach((heart, i) => place(hearts[i], heart.x, heart.y));
      enemies.forEach((element, i) => {
        const enemy = game.enemies[i];
        element.hidden = !enemy;
        if (enemy) place(element, enemy.x, enemy.y);
      });
      place(player, game.player.x, game.player.y);
      const text = `score: ${game.score}`;
      if (score.textContent !== text) score.textContent = text;
    },
  };
}

function frameCell(x, y, character) {
  const cell = document.createElement('div');
  cell.className = 'frame';
  cell.textContent = character;
  place(cell, x, y);
  return cell;
}

function piece(className, text) {
  const element = document.createElement('div');
  element.className = `piece ${className}`;
  element.textContent = text;
  return element;
}

function place(element, x, y) {
  const column = String(x);
  const row = String(y + 1);
  if (element.style.gridColumnStart !== column) element.style.gridColumnStart = column;
  if (element.style.gridRowStart !== row) element.style.gridRowStart = row;
}
