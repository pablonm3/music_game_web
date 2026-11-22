import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { CLIPS, clipFiles, MUSIC } from '../public/js/clips.js';
import { publicDir } from './helpers/server.js';

const MAX_BYTES = 50 * 1024 * 1024;

describe('audio files', () => {
  it('has a sound for every game event', () => {
    const names = ['voice-red', 'voice-blue', 'voice-cyan', 'goal', 'error', 'enemy', 'record', 'life-lost', 'explosion'];
    for (const name of names) {
      assert.ok(CLIPS[name], name);
    }
    assert.equal(CLIPS.goal.length, 4);
    assert.equal(MUSIC.length, 6);
  });

  it('plays a life-lost clip that differs from the game-over clip', () => {
    assert.notEqual(CLIPS['life-lost'], CLIPS.error);
  });

  it('finds every named file under public/, 18 in all, none over 50 MB', () => {
    const files = [...clipFiles(), ...MUSIC];
    assert.equal(new Set(files).size, 18);
    for (const file of files) {
      const stat = fs.statSync(path.join(publicDir, file));
      assert.ok(stat.isFile(), file);
      assert.ok(stat.size > 0 && stat.size < MAX_BYTES, `${file}: ${stat.size} bytes`);
    }
  });
});
