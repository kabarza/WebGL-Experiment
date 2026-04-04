#!/bin/sh
# Patch DialKit's inline height calculation:
# The hardcoded +24 assumes 12px bottom padding. We use 0px, so +12.
sed -i '' 's/contentHeight + 24/contentHeight + 12/g' node_modules/dialkit/dist/index.js 2>/dev/null || \
sed -i 's/contentHeight + 24/contentHeight + 12/g' node_modules/dialkit/dist/index.js
