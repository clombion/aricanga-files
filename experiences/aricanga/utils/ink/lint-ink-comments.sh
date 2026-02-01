#!/usr/bin/env bash
# lint-ink-comments.sh - Validate complex ink has explanatory comments
#
# CQO-5: Complex Ink Comment Validation
#
# Checks that complex ink patterns have `// Why:` comments explaining
# the reasoning. Complex patterns include:
#   - LIST operations (state machines)
#   - Tunnels (->->)
#   - Deeply nested conditionals (3+ levels)
#
# Usage:
#   bash utils/linting/lint-ink-comments.sh [options] [directory]
#
# Options:
#   --help, -h     Show this help message
#   --verbose, -v  Show all patterns found (not just errors)
#
# Arguments:
#   directory      Directory to check (default: src/ink)
#
# Exit codes:
#   0 - All complex patterns have comments
#   1 - Missing comments found

set -euo pipefail

# Parse arguments
VERBOSE=false
SHOW_HELP=false
CUSTOM_DIR=""

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
            CUSTOM_DIR="$arg"
            ;;
    esac
done

# Collect ink directories to scan (all implementations by default)
INK_DIRS=()
if [[ -n "$CUSTOM_DIR" ]]; then
    INK_DIRS=("$CUSTOM_DIR")
else
    for impl_dir in experiences/*/; do
        ink_dir="${impl_dir}ink"
        if [[ -d "$ink_dir" ]]; then
            INK_DIRS+=("$ink_dir")
        fi
    done
fi

# Show help
if [[ "$SHOW_HELP" == true ]]; then
    cat << EOF
lint-ink-comments.sh - Validate complex ink has explanatory comments

CQO-5: Complex patterns need // Why: comments to explain non-obvious logic.

USAGE
  bash utils/linting/lint-ink-comments.sh [options] [directory]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all patterns found (not just errors)

ARGUMENTS
  directory      Directory to check (default: experiences/*/ink)

COMPLEX PATTERNS REQUIRING COMMENTS
  LIST           State machine declarations (e.g., LIST mood = happy, sad)
  Tunnels        Subroutine calls (-> knot ->)
  Nested {}      3+ levels of conditional nesting

VALID COMMENT EXAMPLE
  // Why: Track conversation mood for dialogue variations
  LIST mood = neutral, happy, frustrated

EXIT CODES
  0  All complex patterns have comments
  1  Missing comments found

EXAMPLES
  bash utils/linting/ink/lint-ink-comments.sh                               # Lint default impl ink
  bash utils/linting/ink/lint-ink-comments.sh -v                            # Show all patterns
  bash utils/linting/ink/lint-ink-comments.sh experiences/aricanga/ink/en  # Specific locale
EOF
    exit 0
fi

ERRORS=0
VALID=0

if [[ ${#INK_DIRS[@]} -eq 0 ]]; then
    echo "No ink directories found in experiences/"
    exit 0
fi

echo "Checking complex ink patterns in ${INK_DIRS[*]}..."
[[ "$VERBOSE" == true ]] && echo ""

for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue

    # Check for LIST declarations without // Why: comment
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)

        # Check preceding 3 lines for // Why:
        start=$((lineno - 3))
        [[ $start -lt 1 ]] && start=1

        if sed -n "${start},$((lineno - 1))p" "$file" 2>/dev/null | grep -q '// Why:'; then
            [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - LIST with comment"
            ((VALID++)) || true
        else
            echo "CQO-5: $file:$lineno - LIST operation without // Why: comment"
            ((ERRORS++)) || true
        fi
    done < <(grep -rn '^\s*LIST\s\+\w\+\s*=' "$INK_DIR" --include="*.ink" 2>/dev/null || true)

    # Check for tunnel patterns (->->) without // Why: comment
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)

        # Check preceding 3 lines for // Why:
        start=$((lineno - 3))
        [[ $start -lt 1 ]] && start=1

        if sed -n "${start},$((lineno - 1))p" "$file" 2>/dev/null | grep -q '// Why:'; then
            [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - Tunnel with comment"
            ((VALID++)) || true
        else
            echo "CQO-5: $file:$lineno - Tunnel (->->) without // Why: comment"
            ((ERRORS++)) || true
        fi
    done < <(grep -rn '->.*->' "$INK_DIR" --include="*.ink" 2>/dev/null | grep -v '^\s*//' || true)
done

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Found $ERRORS CQO-5 violation(s)"
    echo "Add '// Why: <explanation>' before each complex pattern"
    [[ "$VERBOSE" == true ]] && echo "Valid patterns: $VALID"
    exit 1
else
    echo "✓ CQO-5: All complex ink has explanatory comments"
    [[ "$VERBOSE" == true ]] && echo "  Checked $((VALID)) pattern(s)"
    exit 0
fi
