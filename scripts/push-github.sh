#!/usr/bin/env bash
# Push to GitHub without SSH: set a Personal Access Token (classic) with `repo` scope.
# Usage: export GITHUB_TOKEN=ghp_xxxxxxxx && ./scripts/push-github.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE_HTTPS="https://github.com/Sheheryargit/floatreplacement.git"
REMOTE_AUTH="https://${GITHUB_TOKEN:-}@github.com/Sheheryargit/floatreplacement.git"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Missing GITHUB_TOKEN."
  echo "Create a token: GitHub → Settings → Developer settings → Personal access tokens → repo scope."
  echo "Then: export GITHUB_TOKEN=ghp_... && ./scripts/push-github.sh"
  exit 1
fi

git remote set-url origin "$REMOTE_AUTH"
git push -u origin main
git remote set-url origin "$REMOTE_HTTPS"
echo "Done. Remote is back to: $REMOTE_HTTPS"
