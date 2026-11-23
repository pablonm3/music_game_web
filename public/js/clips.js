// Every sound the game plays, by name, as paths under public/. A name with a list picks
// one file at random each time it plays. Removing a track is an edit here and a file.

export const CLIPS = {
  'voice-red': 'audio/voice/red.mp3',
  'voice-blue': 'audio/voice/blue.mp3',
  'voice-cyan': 'audio/voice/cyan-v2.mp3',
  error: 'audio/nextGoal/error.mp3',
  enemy: 'audio/enemy-v2.mp3',
  bomb: 'audio/bomb.mp3',
  record: 'audio/record.mp3',
  'life-lost': 'audio/life-lost.mp3',
  explosion: 'audio/explosion.mp3',
  goal: ['audio/goal/g1.mp3', 'audio/goal/g2.mp3', 'audio/goal/g3.mp3', 'audio/goal/g4.mp3'],
};

export const MUSIC = [
  'audio/background/b1.mp3',
  'audio/background/b2.mp3',
  'audio/background/b3.mp3',
  'audio/background/b4.mp3',
  'audio/background/b5.mp3',
  'audio/background/b6.mp3',
];

// The short clips as one list of files, each loaded and decoded once.
export function clipFiles() {
  return Object.values(CLIPS).flat();
}

export function pick(list, random = Math.random) {
  return list[Math.floor(random() * list.length)];
}
