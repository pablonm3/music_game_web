// The leaderboard rules and its JSON file. The page never repeats these rules: it asks
// the API whether a score qualifies and sends names that the server checks here.

import fs from 'node:fs';
import path from 'node:path';

export const MAX_ENTRIES = 10;
const NAME_PATTERN = /^[A-Z]{1,5}$/;

export function isValidName(name) {
  return typeof name === 'string' && NAME_PATTERN.test(name);
}

export function isValidScore(score) {
  return typeof score === 'number' && Number.isSafeInteger(score) && score % 5 === 0;
}

export function qualifies(entries, score) {
  if (score <= 0) return false;
  return entries.length < MAX_ENTRIES || score > entries[MAX_ENTRIES - 1].score;
}

// Loads the file once. Throws when the file exists but is not a leaderboard, so that the
// server refuses to start instead of overwriting it.
export function openLeaderboard(file) {
  let entries = readEntries(file);

  return {
    file,

    entries() {
      return entries.map((entry) => ({ ...entry }));
    },

    qualifies(score) {
      return qualifies(entries, score);
    },

    // Synchronous from the rule check to the swap in memory, so two submissions are
    // handled one after the other. A failed write throws and changes nothing.
    add(name, score) {
      if (!isValidName(name)) return { error: 'invalid_name' };
      if (!isValidScore(score)) return { error: 'invalid_score' };
      if (!qualifies(entries, score)) return { error: 'not_qualifying' };

      let index = entries.findIndex((entry) => entry.score < score);
      if (index === -1) index = entries.length;
      const next = [...entries.slice(0, index), { name, score }, ...entries.slice(index)].slice(0, MAX_ENTRIES);

      writeEntries(file, next);
      entries = next;
      return { rank: index + 1 };
    },
  };
}

function readEntries(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`leaderboard file ${file} is not valid JSON; fix or remove it`);
  }
  const valid = Array.isArray(data?.entries)
    && data.entries.every((entry) => isValidName(entry?.name) && isValidScore(entry?.score));
  if (!valid) throw new Error(`leaderboard file ${file} has no valid "entries" list; fix or remove it`);

  return data.entries.slice(0, MAX_ENTRIES).map(({ name, score }) => ({ name, score }));
}

function writeEntries(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify({ entries })}\n`);
    fs.renameSync(temp, file);
  } catch (error) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // the write error below is the one worth reporting
    }
    throw error;
  }
}
