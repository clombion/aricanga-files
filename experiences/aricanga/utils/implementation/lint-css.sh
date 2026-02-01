#!/usr/bin/env bash
# lint-css.sh - Check for hardcoded colors in component CSS
#
# CQO-9: CSS Variables for Theming
#
# Checks for hardcoded color values (#hex, rgb(), rgba()) in JavaScript
# component files. Colors should use CSS variables (var(--ink-*)) for
# consistent theming.
#
# Usage:
#   bash scripts/lint-css.sh [options] [directory]
#
# Options:
#   --help, -h     Show this help message
#   --verbose, -v  Show skipped files and reasons
#
# Arguments:
#   directory      Directory to check (default: component directories)
#
# Skipped files:
#   - theme.css         Source of truth for CSS variables
#   - generated/        Generated config with theme colors
#   - debug-panel.js    Intentional matrix-style terminal UI
#   - const UPPER_CASE  JS color constants (SVG/canvas, not in CSS context)
#   - Lines with        lint-ignore or WCAG comments
#
# Exit codes:
#   0 - No issues found
#   1 - Hardcoded colors detected

set -euo pipefail

# Parse arguments
VERBOSE=false
SHOW_HELP=false
# 4-layer architecture: check components in systems and all implementations
# Dynamically discover all implementation component directories
JS_DIRS=("packages/framework/src/systems/conversation/components")
for impl_dir in experiences/*/; do
    comp_dir="${impl_dir}src/components"
    if [[ -d "$comp_dir" ]]; then
        JS_DIRS+=("$comp_dir")
    fi
done

for arg in "$@"; do
    case "$arg" in
        --help|-h)
            SHOW_HELP=true
            ;;
        --verbose|-v)
            VERBOSE=true
            ;;
        -*)
            echo "Unknown option: $arg"
            exit 1
            ;;
        *)
            JS_DIRS=("$arg")
            ;;
    esac
done

# Show help
if [[ "$SHOW_HELP" == true ]]; then
    cat << 'EOF'
lint-css.sh - Check for hardcoded colors in component CSS

USAGE
  bash scripts/lint-css.sh [options] [directory]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show skipped files and reasons

ARGUMENTS
  directory      Directory to check (default: packages/framework/src/systems/conversation/components + experiences/*/src/components)

CHECKS
  • Hardcoded hex colors (#fff, #ffffff, #ffffffff)
  • Hardcoded rgb() and rgba() values

SKIPPED (not errors)
  • theme.css         - Source of truth for CSS variables
  • generated/*       - Generated config contains theme colors
  • debug-panel.js    - Intentional matrix-style terminal UI
  • const UPPER_CASE  - JS color constants (SVG/canvas, not CSS-themeable)
  • lint-ignore       - Lines with this comment are skipped
  • WCAG              - Lines mentioning WCAG compliance are skipped

EXIT CODES
  0  No issues found
  1  Hardcoded colors detected

EXAMPLES
  bash utils/linting/lint-css.sh              # Lint component directories
  bash utils/linting/lint-css.sh -v           # Verbose mode
  bash utils/linting/lint-css.sh src/systems  # Specific dir
EOF
    exit 0
fi

ERRORS=0
SKIPPED=0

echo "Checking for hardcoded colors in ${JS_DIRS[*]}..."
[[ "$VERBOSE" == true ]] && echo ""

# Look for color values in template literals (CSS in JS)
for JS_DIR in "${JS_DIRS[@]}"; do
    [[ ! -d "$JS_DIR" ]] && continue

    while IFS= read -r match; do
        [[ -z "$match" ]] && continue

        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)
        content=$(echo "$match" | cut -d: -f3-)

        # Skip CSS variable definitions (--something:)
        if echo "$content" | grep -qE '^\s*--[a-zA-Z]'; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - CSS variable definition"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip var() fallbacks
        if echo "$content" | grep -qE 'var\s*\('; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - var() usage"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip theme.css (allowed to define variables)
        if [[ "$file" == *"theme.css"* ]]; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - theme.css (source of truth)"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip generated/ directory (source of truth for theme colors)
        if [[ "$file" == *"generated/"* ]]; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - generated/ (theme source)"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip debug-panel.js (intentional matrix-style terminal UI)
        if [[ "$file" == *"debug-panel.js"* ]]; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - debug-panel.js (intentional styling)"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip JS const color declarations (SVG/canvas constants not in CSS context)
        if echo "$content" | grep -qE '^\s*const\s+[A-Z_]+\s*='; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - JS const color (SVG/canvas)"
            ((SKIPPED++)) || true
            continue
        fi

        # Skip lines with lint-ignore comment
        if echo "$content" | grep -qE 'lint-ignore|WCAG'; then
            [[ "$VERBOSE" == true ]] && echo "  [skip] $file:$lineno - lint-ignore comment"
            ((SKIPPED++)) || true
            continue
        fi

        echo "ERROR: $file:$lineno - Possible hardcoded color"
        echo "       $content"
        ((ERRORS++)) || true

    done < <(grep -rn -E '#[0-9a-fA-F]{3,8}\b|rgba?\s*\(' "$JS_DIR" --include="*.js" 2>/dev/null || true)
done

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Found $ERRORS hardcoded color(s)"
    echo "Consider using CSS variables: var(--ink-*)"
    [[ "$VERBOSE" == true ]] && echo "Skipped $SKIPPED occurrence(s)"
    exit 1
else
    echo "✓ No hardcoded colors detected in components"
    [[ "$VERBOSE" == true ]] && echo "  Skipped $SKIPPED occurrence(s) (use -v to see details)"
    exit 0
fi
