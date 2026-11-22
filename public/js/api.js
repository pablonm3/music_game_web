// Leaderboard requests. Every network error, timeout or unexpected answer becomes
// {unavailable: true}, so the game keeps working without the backend (AC21).

const TIMEOUT_MS = 4000;
const UNAVAILABLE = Object.freeze({ unavailable: true });

export function createApi({ fetch = globalThis.fetch.bind(globalThis), timeout = TIMEOUT_MS } = {}) {
  async function request(url, options = {}) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
      const body = await response.json();
      return { status: response.status, body };
    } catch {
      return null;
    }
  }

  return {
    // {entries} or, with a score, {entries, qualifies}
    async load(score) {
      const url = score === undefined ? 'api/leaderboard' : `api/leaderboard?score=${encodeURIComponent(score)}`;
      const answer = await request(url, { cache: 'no-store' });
      if (answer?.status !== 200 || !Array.isArray(answer.body?.entries)) return UNAVAILABLE;
      const result = { entries: answer.body.entries };
      if (score !== undefined) {
        if (typeof answer.body.qualifies !== 'boolean') return UNAVAILABLE;
        result.qualifies = answer.body.qualifies;
      }
      return result;
    },

    // {entries, rank} when stored; {entries} when the score no longer qualifies (409)
    async submit(name, score) {
      const answer = await request('api/leaderboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, score }),
      });
      if (!answer || !Array.isArray(answer.body?.entries)) return UNAVAILABLE;
      if (answer.status === 201 && Number.isInteger(answer.body.rank)) {
        return { entries: answer.body.entries, rank: answer.body.rank };
      }
      if (answer.status === 409) return { entries: answer.body.entries };
      return UNAVAILABLE;
    },
  };
}
