#!/usr/bin/env bash
# lint-current-chat.sh - Verify chat knots set current_chat
#
# CQO-18: Chat Knots Set current_chat
#
# Each chat knot (=== xxx_chat ===) must set current_chat to its
# chat ID within the first 2 lines after declaration.
#
# Usage:
#   bash experiences/aricanga/utils/ink/lint-current-chat.sh [directory]
#
# Exit codes:
#   0 - All chat knots set current_chat correctly
#   1 - Missing or incorrect current_chat assignments

set -euo pipefail

# Parse arguments
CUSTOM_DIR=""
for arg in "$@"; do
    case "$arg" in
        --help|-h)
            echo "lint-current-chat.sh - CQO-18: Verify chat knots set current_chat"
            echo ""
            echo "USAGE"
            echo "  bash experiences/aricanga/utils/ink/lint-current-chat.sh [directory]"
            echo ""
            echo "ARGUMENTS"
            echo "  directory  Directory to check (default: experiences/*/ink)"
            exit 0
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

# Collect ink directories
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

if [[ ${#INK_DIRS[@]} -eq 0 ]]; then
    echo "No ink directories found"
    exit 0
fi

ERRORS=0
VALID=0

echo "Checking chat knots set current_chat in ${INK_DIRS[*]}..."

for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue

    # Find all chat knot declarations (=== xxx_chat ===)
    while IFS= read -r match; do
        [[ -z "$match" ]] && continue

        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)
        knot_line=$(echo "$match" | cut -d: -f3-)

        # Extract chat name from knot declaration (e.g., "pat_chat" from "=== pat_chat ===")
        chat_knot=$(echo "$knot_line" | sed -E 's/.*=== *([a-z_]+_chat) *==.*/\1/')

        # Expected chat ID is knot name without "_chat" suffix
        expected_id=$(echo "$chat_knot" | sed 's/_chat$//')

        # Check next 2 lines for current_chat assignment
        next_lines=$(sed -n "$((lineno + 1)),$((lineno + 2))p" "$file" 2>/dev/null || true)

        # Look for: ~ current_chat = "xxx"
        if echo "$next_lines" | grep -qE "~\s*current_chat\s*=\s*\"${expected_id}\""; then
            ((VALID++)) || true
        else
            echo "CQO-18: $file:$lineno - $chat_knot missing '~ current_chat = \"$expected_id\"'"
            ((ERRORS++)) || true
        fi
    done < <(grep -rn '===\s*[a-z_]*_chat\s*===' "$INK_DIR" --include="*.ink" 2>/dev/null || true)
done

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Found $ERRORS CQO-18 violation(s)"
    echo "Each chat knot must set current_chat to its ID on line 2"
    exit 1
else
    echo "✓ CQO-18: All chat knots set current_chat correctly ($VALID checked)"
    exit 0
fi
