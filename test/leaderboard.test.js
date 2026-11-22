import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { isValidName, isValidScore, openLeaderboard } from '../server/leaderboard.js';
import { tempFile } from './helpers/server.js';

function fill(leaderboard, scores) {
  scores.forEach((score, i) => {
    const result = leaderboard.add(String.fromCharCode(65 + i), score);
    assert.ok(result.rank, `entry ${i} with ${score} is stored`);
  });
}

describe('leaderboard rules', () => {
  it('accepts names of one to five letters A-Z only', () => {
    for (const name of ['A', 'ABC', 'ABCDE']) assert.ok(isValidName(name), name);
    for (const name of ['', 'ABCDEF', 'abc', 'A1C', 'AB C', 123, null, undefined]) {
      assert.ok(!isValidName(name), JSON.stringify(name));
    }
  });

  it('accepts scores that are integers and multiples of 5', () => {
    for (const score of [0, 5, -5, 120]) assert.ok(isValidScore(score), String(score));
    for (const score of [7, 5.5, '35', null, undefined, Number.NaN, 2 ** 60]) {
      assert.ok(!isValidScore(score), String(score));
    }
  });

  it('ranks higher scores first and the earlier entry first on a tie', () => {
    const leaderboard = openLeaderboard(tempFile());
    assert.deepEqual(leaderboard.add('AL', 35), { rank: 1 });
    assert.deepEqual(leaderboard.add('PABLO', 120), { rank: 1 });
    assert.deepEqual(leaderboard.add('BOB', 35), { rank: 3 });
    assert.deepEqual(leaderboard.entries(), [
      { name: 'PABLO', score: 120 },
      { name: 'AL', score: 35 },
      { name: 'BOB', score: 35 },
    ]);
  });

  it('never takes a score of 0 or less', () => {
    const leaderboard = openLeaderboard(tempFile());
    assert.equal(leaderboard.qualifies(0), false);
    assert.equal(leaderboard.qualifies(-5), false);
    assert.deepEqual(leaderboard.add('BOB', 0), { error: 'not_qualifying' });
    assert.deepEqual(leaderboard.entries(), []);
  });

  it('with 10 entries takes only a score above the 10th, which pushes the 10th out', () => {
    const leaderboard = openLeaderboard(tempFile());
    fill(leaderboard, [100, 95, 90, 85, 80, 75, 70, 65, 60, 55]);
    assert.equal(leaderboard.qualifies(55), false, 'equal to the 10th');
    assert.deepEqual(leaderboard.add('LOW', 50), { error: 'not_qualifying' });
    assert.deepEqual(leaderboard.add('TIE', 55), { error: 'not_qualifying' });
    assert.deepEqual(leaderboard.add('NEW', 60), { rank: 10 });
    const entries = leaderboard.entries();
    assert.equal(entries.length, 10);
    assert.deepEqual(entries[8], { name: 'I', score: 60 });
    assert.deepEqual(entries[9], { name: 'NEW', score: 60 });
    assert.ok(!entries.some((entry) => entry.score === 55), 'the old 10th is gone');
  });

  it('refuses a bad name or score without changing anything', () => {
    const leaderboard = openLeaderboard(tempFile());
    leaderboard.add('AL', 35);
    assert.deepEqual(leaderboard.add('abc', 40), { error: 'invalid_name' });
    assert.deepEqual(leaderboard.add('BOB', 7), { error: 'invalid_score' });
    assert.deepEqual(leaderboard.entries(), [{ name: 'AL', score: 35 }]);
  });
});

describe('leaderboard file', () => {
  it('treats a missing file as empty and creates its folder on the first add', () => {
    const file = path.join(path.dirname(tempFile()), 'nested', 'data', 'leaderboard.json');
    const leaderboard = openLeaderboard(file);
    assert.deepEqual(leaderboard.entries(), []);
    leaderboard.add('AL', 35);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { entries: [{ name: 'AL', score: 35 }] });
  });

  it('gives the same entries to a second open of the same file (a restart)', () => {
    const file = tempFile();
    const first = openLeaderboard(file);
    first.add('PABLO', 120);
    first.add('AL', 35);
    assert.deepEqual(openLeaderboard(file).entries(), first.entries());
  });

  it('refuses to open a file that is not a leaderboard, and leaves it as it is', () => {
    const file = tempFile();
    for (const text of ['not json', '{"scores":[]}', '{"entries":[{"name":"x","score":1}]}']) {
      fs.writeFileSync(file, text);
      assert.throws(() => openLeaderboard(file), /leaderboard file/);
      assert.equal(fs.readFileSync(file, 'utf8'), text);
    }
  });

  it('changes nothing when the file cannot be written', () => {
    const file = tempFile();
    const leaderboard = openLeaderboard(file);
    leaderboard.add('AL', 35);
    fs.mkdirSync(`${file}.${process.pid}.tmp`); // the temp file cannot be created
    assert.throws(() => leaderboard.add('BOB', 40));
    assert.deepEqual(leaderboard.entries(), [{ name: 'AL', score: 35 }]);
    assert.deepEqual(openLeaderboard(file).entries(), [{ name: 'AL', score: 35 }]);
  });
});
