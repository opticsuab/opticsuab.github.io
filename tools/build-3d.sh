#!/usr/bin/env bash
# Rebuilds js/building3d.js (the 3D model of Edifici C on the "How to reach us" page) from tools/src/building3d.js.
# Needs Node.js and npm. The result is committed; the publish process does not run this.
set -euo pipefail
cd "$(dirname "$0")"
npm install --no-audit --no-fund --silent
npx esbuild src/building3d.js --bundle --format=esm --minify --target=es2020 --legal-comments=eof \
  --banner:js="/* Built from tools/src/building3d.js with three.js (MIT) — do not edit by hand; run tools/build-3d.sh. */" \
  --outfile=../js/building3d.js
ls -l ../js/building3d.js
