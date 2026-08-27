#!/usr/bin/env bash
set -euo pipefail

branch="${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
remote="origin"
max_attempts=5

git config user.name 'GitHub Actions'
git config user.email 'actions@github.com'

git add datos docs/public/openapi.json

if git diff --staged --quiet; then
  echo "No data changes to commit"
  exit 0
fi

git commit -m "Latest data: $(TZ=America/Argentina/Buenos_Aires date +'%Y-%m-%d %H:%M ART')"

# El cron/build puede dejar tracked files dirty fuera de datos/openapi.
# Eso bloquea `git pull --rebase` ("cannot pull with rebase: You have unstaged changes").
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "Working tree dirty after commit (will stash before rebase):"
  git status --porcelain || true
  git stash push --include-untracked --message "gha-dirty-before-rebase" || true
fi

for attempt in $(seq 1 "$max_attempts"); do
  echo "Push attempt ${attempt}/${max_attempts}"

  if ! git fetch --no-tags --depth=50 "${remote}" "${branch}"; then
    echo "Fetch failed on attempt ${attempt}"
    sleep $((attempt * 15))
    continue
  fi

  if ! git rebase "${remote}/${branch}"; then
    echo "Rebase failed on attempt ${attempt}"
    git rebase --abort || true
    sleep $((attempt * 15))
    continue
  fi

  if git push "${remote}" "HEAD:${branch}"; then
    echo "Push succeeded"
    exit 0
  fi

  echo "Push rejected on attempt ${attempt}"
  sleep $((attempt * 15))
done

echo "Failed to push after ${max_attempts} attempts"
exit 1
