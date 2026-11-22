// Sound: the short clips through the Web Audio API, the music through one looping
// <audio> element (a decoded 8-minute track would take about 170 MB of memory).

import { CLIPS, MUSIC, clipFiles, pick } from './clips.js';

const RECENT_SOUNDS = 5;

export function createAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = AudioContextClass ? new AudioContextClass() : null;
  const buffers = new Map(clipFiles().map((file) => [file, loadClip(context, file)]));
  const music = new Audio();
  music.loop = true;
  music.preload = 'none';
  let track = null;
  let unlocked = false;
  const recent = [];

  return {
    // Browsers keep sound off until the page is used; call this from every key or tap.
    unlock() {
      if (!context) return;
      if (context.state !== 'running') context.resume().catch(() => {});
      if (!unlocked) {
        unlocked = true;
        // Older iOS only unlocks once something has played inside the user's gesture.
        const silence = context.createBufferSource();
        silence.buffer = context.createBuffer(1, 1, 22050);
        silence.connect(context.destination);
        silence.start();
      }
    },

    // Plays a clip by its name in clips.js; a clip still loading plays when it is ready,
    // a clip that failed to load is skipped.
    play(name) {
      const entry = CLIPS[name];
      if (!entry) return;
      recent.push(name);
      if (recent.length > RECENT_SOUNDS) recent.shift();
      const file = Array.isArray(entry) ? pick(entry) : entry;
      buffers.get(file).then((buffer) => {
        if (!buffer) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
      });
    },

    // A track that cannot be fetched or that the browser refuses to play leaves the game
    // without music; the rejected play() is ignored on purpose.
    startMusic() {
      track = pick(MUSIC);
      music.src = track;
      music.play().catch(() => {});
    },

    stopMusic() {
      music.pause();
    },

    status() {
      return {
        track: track ? track.split('/').pop().replace(/\.mp3$/, '') : 'none',
        playing: track !== null && !music.paused,
        sounds: recent.slice(),
      };
    },
  };
}

async function loadClip(context, file) {
  if (!context) return null;
  try {
    const response = await fetch(file);
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    return await new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject));
  } catch {
    return null;
  }
}
