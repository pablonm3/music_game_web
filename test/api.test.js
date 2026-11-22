import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startApp } from './helpers/server.js';

const post = (app, body, headers = { 'content-type': 'application/json' }) => fetch(`${app.url}/api/leaderboard`, {
  method: 'POST',
  headers,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const entries = async (app) => (await (await fetch(`${app.url}/api/leaderboard`)).json()).entries;

describe('leaderboard API', () => {
  let app;
  before(async () => { app = await startApp(); });
  after(() => app.close());

  it('starts empty, with no caching', async () => {
    const response = await fetch(`${app.url}/api/leaderboard`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await response.json(), { entries: [] });
  });

  it('stores an entry and returns it with its rank, and to any later request', async () => {
    const response = await post(app, { name: 'PABLO', score: 120 });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { entries: [{ name: 'PABLO', score: 120 }], rank: 1 });

    const second = await post(app, { name: 'AL', score: 35 });
    assert.equal((await second.json()).rank, 2);
    assert.deepEqual(await entries(app), [{ name: 'PABLO', score: 120 }, { name: 'AL', score: 35 }]);
  });

  it('says whether a score qualifies', async () => {
    const answer = async (score) => {
      const response = await fetch(`${app.url}/api/leaderboard?score=${score}`);
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await answer(35)).body.qualifies, true);
    assert.equal((await answer(0)).body.qualifies, false);
    assert.equal((await answer(-15)).body.qualifies, false);
    assert.ok(Array.isArray((await answer(35)).body.entries));
    for (const bad of ['7', '5.5', 'abc', '']) {
      const { status, body } = await answer(bad);
      assert.equal(status, 400, `score=${bad}`);
      assert.deepEqual(body, { error: 'invalid_score' });
    }
  });

  it('refuses bad names and scores and leaves the list unchanged', async () => {
    const cases = [
      [{ name: '', score: 40 }, 'invalid_name'],
      [{ name: 'ABCDEF', score: 40 }, 'invalid_name'],
      [{ name: 'abc', score: 40 }, 'invalid_name'],
      [{ name: 'A1C', score: 40 }, 'invalid_name'],
      [{ name: 'AB C', score: 40 }, 'invalid_name'],
      [{ name: 123, score: 40 }, 'invalid_name'],
      [{ score: 40 }, 'invalid_name'],
      [{ name: 'BOB', score: 7 }, 'invalid_score'],
      [{ name: 'BOB', score: 5.5 }, 'invalid_score'],
      [{ name: 'BOB', score: '35' }, 'invalid_score'],
      [{ name: 'BOB' }, 'invalid_score'],
    ];
    for (const [body, error] of cases) {
      const before = await entries(app);
      const response = await post(app, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.deepEqual(await response.json(), { error });
      assert.deepEqual(await entries(app), before, JSON.stringify(body));
    }
    for (const score of [0, -5]) {
      const before = await entries(app);
      const response = await post(app, { name: 'BOB', score });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, 'not_qualifying');
      assert.deepEqual(await entries(app), before);
    }
  });

  it('refuses a body that is not a JSON object, or over 1 KB', async () => {
    for (const body of ['not json', '[1,2]', 'null', '"BOB"']) {
      const response = await post(app, body);
      assert.equal(response.status, 400, body);
      assert.deepEqual(await response.json(), { error: 'invalid_json' });
    }
    const response = await post(app, { name: 'BOB', score: 40, padding: 'x'.repeat(2000) });
    assert.equal(response.status, 413);
  });

  it('answers 405 to other methods and 404 to other API paths', async () => {
    assert.equal((await fetch(`${app.url}/api/leaderboard`, { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(`${app.url}/api/other`)).status, 404);
  });
});

describe('leaderboard API with a full list', () => {
  let app;
  before(async () => { app = await startApp(); });
  after(() => app.close());

  it('answers 409 with the list to a score equal to or below the 10th, 201 to one above', async () => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await post(app, { name: String.fromCharCode(65 + i), score: 100 - 5 * i })).status, 201);
    }
    const before = await entries(app);
    for (const score of [55, 50]) {
      const response = await post(app, { name: 'BOB', score });
      assert.equal(response.status, 409, String(score));
      const body = await response.json();
      assert.equal(body.error, 'not_qualifying');
      assert.deepEqual(body.entries, before);
    }
    const response = await post(app, { name: 'BOB', score: 60 });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.rank, 10);
    assert.equal(body.entries.length, 10);
    assert.deepEqual(body.entries.at(-1), { name: 'BOB', score: 60 });
  });
});

describe('leaderboard API across a restart', () => {
  it('shows the entries stored before the restart', async () => {
    const first = await startApp();
    await post(first, { name: 'PABLO', score: 120 });
    await post(first, { name: 'AL', score: 35 });
    const stored = await entries(first);
    await first.close();

    const second = await startApp({ file: first.file });
    try {
      assert.deepEqual(await entries(second), stored);
      assert.equal(stored.length, 2);
    } finally {
      await second.close();
    }
  });
});
