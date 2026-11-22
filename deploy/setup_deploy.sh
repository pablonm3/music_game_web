#!/usr/bin/env bash
# One-time setup of the GitHub Actions deploy (.github/workflows/deploy.yml). Run it
# yourself in a terminal on your own computer; it asks for the server password once and
# never stores it. Needs ssh, the GitHub CLI (`gh`, logged in) and the server's host key
# in your known_hosts (log in to the server once before).
#
#   usage: deploy/setup_deploy.sh <user@host> [<owner/repo>]
#
#   1. creates a deploy key on this computer (~/.ssh/music_game_web_deploy);
#   2. copies autodeploy.sh to ~/music_game_web_data/ on the server and lets that key run
#      only that script (the app itself is a clone in ~/music_game_web, run by pm2);
#   3. checks that the key works;
#   4. stores the key, the server's host key and the login as secrets of the GitHub repo.
#
# Safe to run again: it reuses the key and replaces its line on the server.
set -euo pipefail

TARGET="${1:?usage: deploy/setup_deploy.sh <user@host> [<owner/repo>]}"
HOST="${TARGET#*@}"
REPO="${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
KEY="$HOME/.ssh/music_game_web_deploy"
KEY_COMMENT="github-actions-deploy music_game_web"
HERE="$(cd "$(dirname "$0")" && pwd)"
CTL="$HOME/.ssh/cm-mgw-setup-%C"

echo "1/4 deploy key"
if [ ! -f "$KEY" ]; then
  # no passphrase: GitHub Actions uses the key unattended
  ssh-keygen -q -t ed25519 -N "" -C "$KEY_COMMENT" -f "$KEY"
  echo "    created $KEY"
else
  echo "    reusing $KEY"
fi
PUB="$(cat "$KEY.pub")"

echo "2/4 server (your password is asked once)"
ssh -o ControlMaster=yes -o ControlPath="$CTL" -o ControlPersist=120 -fN "$TARGET"
trap 'ssh -O exit -o ControlPath="$CTL" "$TARGET" 2>/dev/null || true' EXIT
scp -q -o ControlPath="$CTL" "$HERE/autodeploy.sh" "$TARGET:music_game_web_data/autodeploy.sh"
ssh -o ControlPath="$CTL" "$TARGET" bash -s <<EOF
set -e
chmod 700 ~/music_game_web_data/autodeploy.sh
install -d -m 700 ~/.ssh
touch ~/.ssh/authorized_keys
grep -v "$KEY_COMMENT" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.new || true
echo "restrict,command=\"\$HOME/music_game_web_data/autodeploy.sh\" $PUB" >> ~/.ssh/authorized_keys.new
chmod 600 ~/.ssh/authorized_keys.new
mv ~/.ssh/authorized_keys.new ~/.ssh/authorized_keys
echo "    script installed; the deploy key may run only that script"
EOF

echo "3/4 check: log in with the deploy key (the server runs the deploy script)"
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$TARGET" | sed 's/^/    /'

echo "4/4 GitHub secrets of $REPO"
gh secret set DEPLOY_KEY --repo "$REPO" < "$KEY"
ssh-keygen -F "$HOST" | grep -v '^#' | gh secret set DEPLOY_KNOWN_HOSTS --repo "$REPO"
printf '%s' "$TARGET" | gh secret set DEPLOY_TARGET --repo "$REPO"

echo "done: the next push to main of $REPO that has the workflow file deploys by itself"
