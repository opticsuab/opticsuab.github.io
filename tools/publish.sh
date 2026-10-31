#!/usr/bin/env bash
# Builds the copy of the site that GitHub Pages publishes (run by .github/workflows/publish.yml).
# Generated translations and keywords are kept in the "generated" branch so later runs reuse them;
# main is never modified by this script.
set -euo pipefail
SITE="$RUNNER_TEMP/site" CACHE="$RUNNER_TEMP/generated" PREV="$RUNNER_TEMP/generated-prev"
mkdir -p "$SITE" "$CACHE" "$PREV"
rsync -a --exclude .git --exclude .github --exclude tools --exclude README.md --exclude .pages.yml --exclude .DS_Store ./ "$SITE/"

if git fetch -q --depth=1 origin generated 2>/dev/null; then
  git archive FETCH_HEAD | tar -x -C "$CACHE"
  cp -a "$CACHE/." "$PREV/"
fi

node tools/build-content.mjs --site "$SITE" --cache "$CACHE"

changed=no
if ! diff -rq "$PREV" "$CACHE" >/dev/null; then
  changed=yes
  (
    cd "$CACHE"
    git init -q -b generated
    git add -A
    git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
      commit -q -m "Generated translations and publication keywords"
    git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" generated:generated
  ) || echo "::warning::Could not save the generated content; it will be generated again on the next run."
fi

# scheduled runs only republish when they produced something new
if [ "${GITHUB_EVENT_NAME:-}" != "schedule" ] || [ "$changed" = yes ]; then
  echo "publish=true" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
