import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { parseRange } from '../server/static.js';
import { publicDir, rawRequest, startApp } from './helpers/server.js';

describe('static files', () => {
  let app;
  before(async () => { app = await startApp(); });
  after(() => app.close());

  it('serves index.html at /', async () => {
    const response = await fetch(`${app.url}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await response.text(), /<title>MUSIC GAME<\/title>/);
  });

  it('serves modules with a JavaScript type', async () => {
    const response = await fetch(`${app.url}/js/main.js`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
  });

  it('answers HEAD with the headers and no body', async () => {
    const response = await rawRequest(app.port, { method: 'HEAD', path: '/css/style.css' });
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /^text\/css/);
    assert.equal(response.body.length, 0);
  });

  it('refuses paths that leave public/ once decoded', async () => {
    for (const requestPath of ['/../package.json', '/%2e%2e/package.json', '/js/..%2f..%2fpackage.json']) {
      const response = await rawRequest(app.port, { path: requestPath });
      assert.equal(response.status, 404, requestPath);
    }
  });

  it('answers 404 for a folder and a missing file, 400 for a path that cannot be decoded', async () => {
    assert.equal((await rawRequest(app.port, { path: '/js/' })).status, 404);
    assert.equal((await rawRequest(app.port, { path: '/nope.js' })).status, 404);
    assert.equal((await rawRequest(app.port, { path: '/%E0%A4%A.js' })).status, 400);
  });

  it('answers 405 to other methods', async () => {
    const response = await fetch(`${app.url}/`, { method: 'POST' });
    assert.equal(response.status, 405);
  });

  it('serves byte ranges of audio, cached for a day', async () => {
    const file = path.join(publicDir, 'audio', 'nextGoal', 'error.mp3');
    const bytes = fs.readFileSync(file);
    const response = await fetch(`${app.url}/audio/nextGoal/error.mp3`, { headers: { range: 'bytes=10-19' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 10-19/${bytes.length}`);
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(10, 20));
  });

  it('serves images with an image type, cached for a day', async () => {
    const png = await fetch(`${app.url}/img/player.png`);
    assert.equal(png.status, 200);
    assert.equal(png.headers.get('content-type'), 'image/png');
    assert.equal(png.headers.get('cache-control'), 'public, max-age=86400');
    const jpeg = await fetch(`${app.url}/img/background.jpg`);
    assert.equal(jpeg.status, 200);
    assert.equal(jpeg.headers.get('content-type'), 'image/jpeg');
    assert.equal(jpeg.headers.get('cache-control'), 'public, max-age=86400');
  });

  it('answers 416 to a range that starts past the end', async () => {
    const response = await fetch(`${app.url}/js/main.js`, { headers: { range: 'bytes=99999999-' } });
    assert.equal(response.status, 416);
  });
});

describe('parseRange', () => {
  it('reads the three single-range forms', () => {
    assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
    assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  });

  it('clamps an end past the file and a suffix longer than the file', () => {
    assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
    assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 });
  });

  it('marks ranges that cannot be met, and ignores forms it does not handle', () => {
    assert.equal(parseRange('bytes=100-', 100), 'unsatisfiable');
    assert.equal(parseRange('bytes=-0', 100), 'unsatisfiable');
    assert.equal(parseRange(undefined, 100), null);
    assert.equal(parseRange('bytes=0-1,5-6', 100), null);
    assert.equal(parseRange('bytes=9-2', 100), null);
  });
});
