#!/usr/bin/env bash
# Validate that dist/ contains all runtime-loaded assets.
# Run after build:prod to catch missing files before deploy.
#
# Usage: IMPL=aricanga ./utils/build/validate-dist.sh

set -euo pipefail

if [ -z "${IMPL:-}" ]; then
  echo "Error: IMPL env var required" >&2
  exit 1
fi

dist="experiences/$IMPL/dist"
src="experiences/$IMPL"
errors=0

check() {
  if [ ! -e "$1" ]; then
    echo "  MISSING: $1"
    errors=$((errors + 1))
  fi
}

echo "Validating dist for $IMPL..."

# 1. Vite bundle entry
echo "  Checking Vite output..."
check "$dist/index.html"
ls "$dist/assets/"*.js >/dev/null 2>&1 || { echo "  MISSING: $dist/assets/*.js (no JS bundles)"; errors=$((errors + 1)); }
ls "$dist/assets/"*.css >/dev/null 2>&1 || { echo "  MISSING: $dist/assets/*.css (no CSS)"; errors=$((errors + 1)); }

# 2. ink.js runtime (non-module script)
echo "  Checking ink runtime..."
check "$dist/src/vendor/ink.js"

# 3. Story JSON per locale
echo "  Checking story files..."
for locale_dir in "$src/src/dist"/*/; do
  locale=$(basename "$locale_dir")
  [ "$locale" = "locales" ] && continue
  check "$dist/src/dist/$locale/story.json"
done

# 4. i18n locale files
echo "  Checking locale files..."
for json in "$src/src/dist/locales/"*.json; do
  base=$(basename "$json")
  check "$dist/src/dist/locales/$base"
done

# 5. Data files (fetched at runtime)
echo "  Checking data files..."
check "$dist/data/data-queries.toml"

# 6. Profile images referenced in config
echo "  Checking profile images..."
for img in "$src/assets/profile_images/optimized/"*; do
  [ -f "$img" ] || continue
  base=$(basename "$img")
  check "$dist/assets/profile_images/optimized/$base"
done

# 7. Avatar images
echo "  Checking avatars..."
for svg in "$src/assets/avatars/"*; do
  [ -f "$svg" ] || continue
  base=$(basename "$svg")
  check "$dist/assets/avatars/$base"
done

# 8. Images and audio referenced in ink tags
echo "  Checking ink image/audio assets..."
while read -r path; do
  path="${path#/}"
  check "$dist/$path"
done < <(grep -rh '# image:\|# audio:' "$src/ink/" 2>/dev/null | sed 's/.*# image://;s/.*# audio://' | tr -d ' ' | sort -u)

# 9. No circular import back to entry chunk (TLA deadlock guard)
echo "  Checking for circular imports..."
entry=$(grep -o 'src="./assets/index-[^"]*\.js"' "$dist/index.html" | head -1 | sed 's/src="\.\/\(.*\)"/\1/')
if [ -n "$entry" ]; then
  # Find chunks that the entry dynamically imports
  for chunk in "$dist/assets/"*.js; do
    [ "$(basename "$chunk")" = "$(basename "$entry")" ] && continue
    # Check if this chunk imports from the entry
    if head -1 "$chunk" | grep -q "from\"\.\/$(basename "$entry")\""; then
      echo "  WARNING: $(basename "$chunk") imports from entry chunk $(basename "$entry") — potential TLA deadlock"
      errors=$((errors + 1))
    fi
  done
fi

echo ""
if [ $errors -gt 0 ]; then
  echo "✗ Validation failed: $errors issue(s) found"
  exit 1
else
  echo "✓ All runtime assets present in dist/"
fi
