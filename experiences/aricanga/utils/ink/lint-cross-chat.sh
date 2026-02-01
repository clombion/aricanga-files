#!/usr/bin/env bash
# lint-cross-chat.sh - Flag deprecated cross-chat message pattern
#
# CQO-20: Use # targetChat tag for cross-chat messages
#
# DEPRECATED pattern (will error):
#   ~ temp saved_chat = current_chat
#   ~ current_chat = "xxx"
#   Message text
#   ~ current_chat = saved_chat
#
# CORRECT pattern:
#   # targetChat:xxx
#   Message text
#
# WHY: Ink's Continue() executes entire conditional block atomically,
# including variable reset. The old pattern resets current_chat BEFORE
# getTargetChat() reads it, causing messages to route to wrong chat.
#
# Usage:
#   bash experiences/aricanga/utils/ink/lint-cross-chat.sh [directory]
#
# Exit codes:
#   0 - No deprecated patterns found
#   1 - Deprecated patterns found

set -euo pipefail

# Parse arguments
CUSTOM_DIR=""
for arg in "$@"; do
    case "$arg" in
        --help|-h)
            echo "lint-cross-chat.sh - CQO-20: Flag deprecated cross-chat patterns"
            echo ""
            echo "USAGE"
            echo "  bash experiences/aricanga/utils/ink/lint-cross-chat.sh [directory]"
            echo ""
            echo "ARGUMENTS"
            echo "  directory  Directory to check (default: experiences/*/ink)"
            echo ""
            echo "DEPRECATED PATTERN"
            echo "  ~ temp saved_chat = current_chat"
            echo "  ~ current_chat = \"xxx\""
            echo "  Message text"
            echo "  ~ current_chat = saved_chat"
            echo ""
            echo "CORRECT PATTERN"
            echo "  # targetChat:xxx"
            echo "  Message text"
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

echo "Checking for deprecated cross-chat patterns in ${INK_DIRS[*]}..."

for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue

    # Pattern 1: ~ temp saved_chat = current_chat
    while IFS= read -r match; do
        [[ -z "$match" ]] && continue

        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)

        echo "CQO-20: $file:$lineno - Deprecated pattern: 'temp saved_chat = current_chat'"
        echo "        Use '# targetChat:xxx' tag instead"
        ((ERRORS++)) || true
    done < <(grep -rn 'temp saved_chat = current_chat' "$INK_DIR" --include="*.ink" 2>/dev/null || true)

    # Pattern 2: ~ current_chat = saved_chat (the restore)
    while IFS= read -r match; do
        [[ -z "$match" ]] && continue

        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)

        echo "CQO-20: $file:$lineno - Deprecated pattern: 'current_chat = saved_chat'"
        echo "        Use '# targetChat:xxx' tag instead"
        ((ERRORS++)) || true
    done < <(grep -rn 'current_chat = saved_chat' "$INK_DIR" --include="*.ink" 2>/dev/null || true)

    # Count valid # targetChat usages
    count=$(grep -rc '# targetChat:' "$INK_DIR" --include="*.ink" 2>/dev/null | awk -F: '{s+=$2} END {print s}' || echo "0")
    VALID=$((VALID + count))
done

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Found $ERRORS CQO-20 violation(s)"
    echo ""
    echo "Fix by replacing the deprecated pattern:"
    echo "  ~ temp saved_chat = current_chat"
    echo "  ~ current_chat = \"xxx\""
    echo "  Message text"
    echo "  ~ current_chat = saved_chat"
    echo ""
    echo "With the # targetChat tag:"
    echo "  # targetChat:xxx"
    echo "  Message text"
    exit 1
else
    echo "✓ CQO-20: No deprecated cross-chat patterns ($VALID targetChat tags found)"
    exit 0
fi
