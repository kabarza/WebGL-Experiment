#!/bin/sh
set -e
DIST="node_modules/dialkit/dist"
PATCHES="scripts/dialkit-patches"

# Replace the React bundle with our patched version (includes original patches + UB components)
cp "$PATCHES/index.js.patched" "$DIST/index.js"

# Replace the type declarations too (seedPresets etc. — the stock 1.2.0
# types don't know about the patched runtime's additions)
cp "$PATCHES/index.d.ts.patched" "$DIST/index.d.ts"

# Append UB CSS
cat "$PATCHES/ub.css" >> "$DIST/styles.css"

echo "✓ DialKit patched (React bundle + UB CSS)"
