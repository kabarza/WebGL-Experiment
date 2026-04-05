#!/bin/sh
set -e
DIST="node_modules/dialkit/dist"
PATCHES="scripts/dialkit-patches"

# Replace the React bundle with our patched version (includes original patches + UB components)
cp "$PATCHES/index.js.patched" "$DIST/index.js"

# Append UB CSS
cat "$PATCHES/ub.css" >> "$DIST/styles.css"

echo "✓ DialKit patched (React bundle + UB CSS)"
