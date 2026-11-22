#!/usr/bin/env bash
# Deploy of the music game (https://pablomarino.com/music-game/).
# Run over SSH by the repo's GitHub Actions workflow after a push to main (the deploy key
# is restricted to this script): when origin/main has a new commit that contains the app,
# check it out, restart the pm2 app and check that it answers; on failure go back to the
# commit that was running and exit 1. Every line it prints is also appended to
# ~/music_game_web_data/autodeploy.log
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/music_game_web}"
DATA_DIR="${DATA_DIR:-$HOME/music_game_web_data}"
ECOSYSTEM="$DATA_DIR/ecosystem.config.js"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8130/}"
BRANCH="main"
LOG="$DATA_DIR/autodeploy.log"
FAILED="$DATA_DIR/autodeploy.failed"   # the commit whose deploy failed; not tried again

# a non-interactive SSH session starts with a short PATH; pm2 is in /usr/local/bin
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin"

exec 9>"$DATA_DIR/autodeploy.lock"
flock -w 120 9 || { echo "another deploy is still running"; exit 1; }

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" | tee -a "$LOG"; }

restart() {
  if [ -f package-lock.json ]; then npm ci --omit=dev --silent; fi
  pm2 startOrReload "$ECOSYSTEM" --update-env >/dev/null
}

healthy() {
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL"; then return 0; fi
    sleep 1
  done
  return 1
}

cd "$APP_DIR"

# the clone may track one branch only, so name the ref to fetch
if ! git fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"; then
  log "fetch of origin/$BRANCH failed"
  exit 1
fi

target=$(git rev-parse "origin/$BRANCH")
current=$(git rev-parse HEAD)

if [ "$target" = "$current" ]; then
  echo "already on origin/$BRANCH ${target:0:7}; nothing to deploy"
  exit 0
fi
# main before the app is merged into it (README only) is never deployed
if ! git cat-file -e "$target:server/main.js" 2>/dev/null; then
  echo "origin/$BRANCH ${target:0:7} does not contain the app yet; nothing deployed"
  exit 0
fi
if [ -f "$FAILED" ] && [ "$(cat "$FAILED")" = "$target" ]; then
  echo "${target:0:7} failed to deploy before and is not tried again; still on ${current:0:7}"
  exit 1
fi

log "deploying origin/$BRANCH: ${current:0:7} -> ${target:0:7}"

# detached at the fetched commit: nothing local to diverge, and git refuses the
# checkout instead of overwriting a tracked file that was edited on the server
if ! git checkout --quiet --detach "$target" 2> >(tee -a "$LOG" >&2); then
  log "checkout of ${target:0:7} refused; still on ${current:0:7}"
  echo "$target" >"$FAILED"
  exit 1
fi

if restart 2> >(tee -a "$LOG" >&2) && healthy; then
  rm -f "$FAILED"
  log "deployed ${target:0:7}"
  exit 0
fi

log "${target:0:7} does not answer at $HEALTH_URL; going back to ${current:0:7}"
echo "$target" >"$FAILED"
git checkout --quiet --detach "$current"
if restart 2> >(tee -a "$LOG" >&2) && healthy; then
  log "back on ${current:0:7}"
else
  log "ROLLBACK FAILED: ${current:0:7} does not answer either"
fi
exit 1
