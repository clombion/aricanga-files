#!/usr/bin/env bash
# lint-asset-paths.sh - Validate asset tag paths resolve correctly
#
# CQO-7: Shadow DOM / CSS Variables (related - prevents path resolution bugs)
#
# Checks that all asset tags in ink files (# image:, # audio:, # attachment:):
#   1. Use absolute paths (starting with /) or full URLs (http/https)
#   2. For absolute paths, the referenced file actually exists
#   3. Attachments are logged for documentation (no existence check)
#
# Paths are relative to implementation root (e.g., /assets/foo.svg resolves to
# experiences/{name}/assets/foo.svg). Vite serves from impl root with base: './'.
#
# Usage:
#   bash utils/linting/ink/lint-image-paths.sh [options] [directory]
#
# Options:
#   --help, -h     Show this help message
#   --verbose, -v  Show all asset tags found (not just errors)
#
# Arguments:
#   directory      Directory to check (default: experiences/*/ink)
#
# Exit codes:
#   0 - All asset paths valid
#   1 - Invalid paths found

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
lint-asset-paths.sh - Validate asset tag paths are absolute

USAGE
  bash utils/linting/ink/lint-image-paths.sh [options] [directory]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show all asset tags found (not just errors)

ARGUMENTS
  directory      Directory to check (default: experiences/*/ink)

ASSET TYPES CHECKED
  # image:/path/to/file.svg          Images - must exist
  # audio:/path/to/file.mp3          Audio - must exist
  # attachment:document.pdf          Attachments - logged only (decorative)

VALID PATHS
  /assets/photo.jpg                  Absolute from impl root
  https://example.com/image.png      Full URL

INVALID PATHS
  assets/photo.jpg                   Relative path (missing leading /)
  /experiences/foo/assets/x.jpg  Old format (impl not served from repo root)

WHY THIS MATTERS
  Vite serves each implementation from its own root (experiences/{name}/)
  with base: './'. An absolute path like /assets/foo.jpg resolves correctly
  from that root. Relative paths break depending on current route.

EXIT CODES
  0  All asset paths valid
  1  Invalid paths found

EXAMPLES
  bash utils/linting/ink/lint-image-paths.sh                    # Lint all implementations
  bash utils/linting/ink/lint-image-paths.sh -v                 # Show all tags found
  bash utils/linting/ink/lint-image-paths.sh experiences/aricanga/ink  # Specific impl
EOF
    exit 0
fi

ERRORS=0
VALID=0
MISSING=0
ATTACHMENTS=0

if [[ ${#INK_DIRS[@]} -eq 0 ]]; then
    echo "No ink directories found in experiences/"
    exit 0
fi

echo "Checking asset paths in ${INK_DIRS[*]}..."
[[ "$VERBOSE" == true ]] && echo ""

# Function to check asset path validity and existence
# Args: $1=file, $2=lineno, $3=path, $4=asset_type, $5=impl_root, $6=check_exists
check_asset_path() {
    local file="$1" lineno="$2" path="$3" asset_type="$4" impl_root="$5" check_exists="$6"

    # Skip empty paths
    [[ -z "$path" ]] && return

    # Check if path is absolute (starts with /) or URL (starts with http)
    if [[ "$path" == http* ]]; then
        # URLs are valid but can't check existence
        [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - $asset_type: $path (URL)"
        ((VALID++)) || true
    elif [[ "$path" == /* ]]; then
        # Absolute path
        if [[ "$check_exists" == "true" ]]; then
            # Check file exists relative to impl root
            local full_path="${impl_root}${path}"
            if [[ -f "$full_path" ]]; then
                [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - $asset_type: $path"
                ((VALID++)) || true
            else
                echo "ERROR: $file:$lineno - $asset_type not found: $path"
                echo "       Expected at: $full_path"
                ((MISSING++)) || true
            fi
        else
            # Don't check existence (for attachments)
            [[ "$VERBOSE" == true ]] && echo "  [ok] $file:$lineno - $asset_type: $path (no existence check)"
            ((ATTACHMENTS++)) || true
        fi
    else
        echo "ERROR: $file:$lineno - Relative $asset_type path: $path"
        echo "       $asset_type paths must start with / (from impl root) or http"
        echo "       Fix: # $asset_type:/$path"
        ((ERRORS++)) || true
    fi
}

# Process all ink directories
for INK_DIR in "${INK_DIRS[@]}"; do
    [[ ! -d "$INK_DIR" ]] && continue

    # Derive implementation root from ink directory (experiences/{name}/ink -> experiences/{name})
    IMPL_ROOT=$(dirname "$INK_DIR")

    # Find all # image: tags in ink files
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        path=$(echo "$line" | sed -n 's/.*# *image: *\(.*\)/\1/p' | xargs)
        check_asset_path "$file" "$lineno" "$path" "image" "$IMPL_ROOT" "true"
    done < <(/usr/bin/grep -rn '#.*image:' "$INK_DIR" --include="*.ink" 2>/dev/null || true)

    # Find all # audio: tags in ink files
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        path=$(echo "$line" | sed -n 's/.*# *audio: *\(.*\)/\1/p' | xargs)
        check_asset_path "$file" "$lineno" "$path" "audio" "$IMPL_ROOT" "true"
    done < <(/usr/bin/grep -rn '#.*audio:' "$INK_DIR" --include="*.ink" 2>/dev/null || true)

    # Find all # attachment: tags in ink files (log only, no existence check)
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        path=$(echo "$line" | sed -n 's/.*# *attachment: *\(.*\)/\1/p' | xargs)
        check_asset_path "$file" "$lineno" "$path" "attachment" "$IMPL_ROOT" "false"
    done < <(/usr/bin/grep -rn '#.*attachment:' "$INK_DIR" --include="*.ink" 2>/dev/null || true)
done

# Summary
echo ""
TOTAL_ERRORS=$((ERRORS + MISSING))
if [[ $TOTAL_ERRORS -gt 0 ]]; then
    [[ $ERRORS -gt 0 ]] && echo "Found $ERRORS relative path(s)"
    [[ $MISSING -gt 0 ]] && echo "Found $MISSING missing file(s)"
    [[ "$VERBOSE" == true ]] && echo "Valid paths: $VALID"
    [[ "$VERBOSE" == true ]] && [[ $ATTACHMENTS -gt 0 ]] && echo "Attachments: $ATTACHMENTS (logged only)"
    exit 1
else
    echo "All asset paths valid ($VALID checked)"
    [[ $ATTACHMENTS -gt 0 ]] && echo "Attachments logged: $ATTACHMENTS (decorative, no existence check)"
    exit 0
fi
