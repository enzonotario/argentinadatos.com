#!/usr/bin/env bash
set -euo pipefail

branch="${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
remote="origin"
max_attempts=5

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

git add datos docs/public/openapi.json

if git diff --staged --quiet; then
  echo "No data changes to commit"
  exit 0
fi

git commit -m "Latest data: $(TZ=America/Argentina/Buenos_Aires date +'%Y-%m-%d %H:%M ART')"

for attempt in $(seq 1 "$max_attempts"); do
  echo "Push attempt ${attempt}/${max_attempts}"

  if ! git pull --rebase "${remote}" "${branch}"; then
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
