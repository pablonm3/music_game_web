import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createApi } from '../public/js/api.js';

const ENTRIES = [{ name: 'PABLO', score: 120 }];

function answering(status, body) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return { status, json: async () => body };
  };
  return { api: createApi({ fetch }), calls };
}

describe('leaderboard client', () => {
  it('loads the list, and with a score whether it qualifies', async () => {
    const { api, calls } = answering(200, { entries: ENTRIES, qualifies: true });
    assert.deepEqual(await api.load(), { entries: ENTRIES });
    assert.deepEqual(await api.load(35), { entries: ENTRIES, qualifies: true });
    assert.equal(calls[0].url, 'api/leaderboard');
    assert.equal(calls[1].url, 'api/leaderboard?score=35');
  });

  it('sends a name and returns the stored rank on 201', async () => {
    const { api, calls } = answering(201, { entries: ENTRIES, rank: 1 });
    assert.deepEqual(await api.submit('PABLO', 120), { entries: ENTRIES, rank: 1 });
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), { name: 'PABLO', score: 120 });
  });

  it('returns the list without a rank on 409', async () => {
    const { api } = answering(409, { error: 'not_qualifying', entries: ENTRIES });
    assert.deepEqual(await api.submit('BOB', 5), { entries: ENTRIES });
  });

  it('reports the leaderboard unavailable on a 500, an odd answer or a network error', async () => {
    assert.deepEqual(await answering(500, { error: 'storage' }).api.submit('BOB', 5), { unavailable: true });
    assert.deepEqual(await answering(500, { error: 'storage' }).api.load(), { unavailable: true });
    assert.deepEqual(await answering(200, { entries: 'x' }).api.load(), { unavailable: true });
    assert.deepEqual(await answering(200, { entries: ENTRIES }).api.load(35), { unavailable: true });

    const rejecting = createApi({ fetch: async () => { throw new TypeError('fetch failed'); } });
    assert.deepEqual(await rejecting.load(), { unavailable: true });
    assert.deepEqual(await rejecting.submit('BOB', 5), { unavailable: true });

    const badJson = createApi({ fetch: async () => ({ status: 200, json: async () => { throw new SyntaxError('x'); } }) });
    assert.deepEqual(await badJson.load(), { unavailable: true });
  });

  it('gives up after the timeout', async () => {
    const hanging = (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
    const api = createApi({ fetch: hanging, timeout: 20 });
    // Node does not keep the process alive for AbortSignal.timeout alone.
    const keepAlive = setTimeout(() => {}, 1000);
    assert.deepEqual(await api.load(), { unavailable: true });
    clearTimeout(keepAlive);
  });
});
