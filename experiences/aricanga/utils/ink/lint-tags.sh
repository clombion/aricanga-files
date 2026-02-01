#!/usr/bin/env bash
# lint-tags.sh - Validate ink tags against approved schema
#
# CQO-2: Tag Schema Compliance
#
# Checks that all # tags in ink files are from the approved list.
# Unknown tags indicate typos or unsupported features.
#
# Usage:
#   bash scripts/lint-tags.sh [options] [directory]
#
# Options:
#   --help, -h     Show this help message
#   --verbose, -v  Show all tags found (not just errors)
#
# Arguments:
#   directory      Directory to check (default: src/ink)
#
# Exit codes:
#   0 - All tags valid
#   1 - Unknown tags found

set -euo pipefail

# Approved tags for chat games (pipe-separated for grep)
# See docs for more info on each tag
APPROVED_TAGS="speaker|type|time|date|day|delay|attachment|image|audio|duration|sfx|class|view|clear|status|presence|connection|story_start|targetChat|notificationPreview|immediate|label|quoteRef|quote|quoteFrom|quoteImage|quoteAudio|linkUrl|linkDomain|linkTitle|linkDesc|linkImage|linkLayout|linkVideo|typing"

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
lint-tags.sh - Validate ink tags against approved schema

USAGE
  bash scripts/lint-tags.sh [options] [directory]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all tags found (not just errors)

ARGUMENTS
  directory      Directory to check (default: experiences/*/ink)

APPROVED TAGS
  speaker      Message sender (e.g., # speaker:Pat)
  type         Message type: sent, received, system, attachment
  time         Timestamp (e.g., # time:9:23 AM)
  date         Date separator (e.g., # date:-1 for yesterday)
  delay        Pre-display pause in ms (e.g., # delay:1500)
  attachment   File reference (e.g., # attachment:doc.pdf)
  image        Inline image path (e.g., # image:photo.jpg)
  audio        Voice message file (e.g., # audio:memo.m4a)
  duration     Audio duration (e.g., # duration:0:08)
  sfx          Sound effect (e.g., # sfx:notification)
  class        CSS class (e.g., # class:emphasis)
  view         UI view switch (e.g., # view:hub)
  clear        Clear history flag
  status       Status bar (e.g., # status:battery:75, # status:signal:3)
               Sub-keys: battery (0-100), signal (0-4), internet
               Internet enum: wifi0-2, mobile0-5, airplane, none
               wifi0/mobile0 trigger "No internet" banner overlay
  presence     Contact presence: online, offline, lastseen:TIME
  connection   Connection quality: stable, unstable
  story_start  Marks boundary between seeds and active narrative

EXIT CODES
  0  All tags valid
  1  Unknown tags found

EXAMPLES
  bash utils/linting/ink/lint-tags.sh                               # Lint default impl ink
  bash utils/linting/ink/lint-tags.sh -v                            # Show all tags found
  bash utils/linting/ink/lint-tags.sh experiences/aricanga/ink/en  # Specific locale
EOF
    exit 0
fi

ERRORS=0
VALID=0

if [[ ${#INK_DIRS[@]} -eq 0 ]]; then
    echo "No ink directories found in experiences/"
    exit 0
fi

echo "Checking ink tags in ${INK_DIRS[*]}..."
[[ "$VERBOSE" == true ]] && echo ""

# Find all tags in ink files (lines starting with #)
for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        content=$(echo "$line" | cut -d: -f3-)

        # Extract tag name (word after #, before : or end)
        tag=$(echo "$content" | sed -n 's/.*#\s*\([a-zA-Z_]*\).*/\1/p' | head -1)

        # Skip empty tags or ink comments
        [[ -z "$tag" ]] && continue

        # Check if tag is in approved list
        if echo "$tag" | grep -qE "^($APPROVED_TAGS)$"; then
            [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - #$tag"
            ((VALID++)) || true
        else
            echo "ERROR: $file:$lineno - Unknown tag '#$tag'"
            echo "       Approved: ${APPROVED_TAGS//|/, }"
            ((ERRORS++)) || true
        fi
    done < <(grep -rn '^\s*#\s*[a-zA-Z]' "$INK_DIR" --include="*.ink" 2>/dev/null || true)
done

# Check for airplane + other internet tags on same line
AIRPLANE_WARNINGS=0
for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        echo "WARNING: $file:$lineno - status:internet:airplane should not co-occur with other status:internet: tags"
        ((AIRPLANE_WARNINGS++)) || true
    done < <(grep -rn 'status:internet:airplane' "$INK_DIR" --include="*.ink" 2>/dev/null | while IFS= read -r match; do
        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)
        content=$(echo "$match" | cut -d: -f3-)
        # Count how many status:internet: tags appear on this line
        count=$(echo "$content" | grep -o 'status:internet:' | wc -l)
        if [[ $count -gt 1 ]]; then
            echo "$file:$lineno"
        fi
    done)
done

if [[ $AIRPLANE_WARNINGS -gt 0 ]]; then
    echo ""
    echo "Found $AIRPLANE_WARNINGS airplane co-occurrence warning(s)"
fi

# Summary
echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "Found $ERRORS unknown tag(s)"
    [[ "$VERBOSE" == true ]] && echo "Valid tags: $VALID"
    exit 1
else
    echo "✓ All tags comply with schema"
    [[ "$VERBOSE" == true ]] && echo "  Checked $VALID tag(s)"
    exit 0
fi
