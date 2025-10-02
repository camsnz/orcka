#!/bin/bash

# Version Utilities
# Handles semantic versioning with leading zeros (000.000.000 format)
# Tag format: yyyy-mm-dd_x.y.z (e.g., 2025-10-02_0.0.1)
# Dry-run tags: dry_yyyy-mm-dd_x.y.z

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parse semantic version string into components
# Usage: parse_version "1.2.3" or "001.002.003"
# Returns: MAJOR MINOR PATCH (space separated, as integers)
parse_version() {
    local version="$1"
    
    # Remove leading zeros for arithmetic
    local major="${version%%.*}"
    local rest="${version#*.}"
    local minor="${rest%%.*}"
    local patch="${rest#*.}"
    
    # Convert to integers (removes leading zeros)
    major=$((10#$major))
    minor=$((10#$minor))
    patch=$((10#$patch))
    
    echo "$major $minor $patch"
}

# Format version with leading zeros
# Usage: format_internal_version 1 2 3
# Returns: "001.002.003"
format_internal_version() {
    local major="${1:-0}"
    local minor="${2:-0}"
    local patch="${3:-0}"
    
    printf "%03d.%03d.%03d" "$major" "$minor" "$patch"
}

# Format version as display version (no leading zeros)
# Usage: format_display_version 1 2 3
# Returns: "1.2.3"
format_display_version() {
    local major="${1:-0}"
    local minor="${2:-0}"
    local patch="${3:-0}"
    
    echo "${major}.${minor}.${patch}"
}

# Get current datetime in compact format
get_current_datetime() {
    date -u +"%Y%m%d%H%M%S"
}

# Format a binary tag
# Usage: format_binary_tag "20251002153045" "1.1.1" [dry_run]
# Returns: "20251002153045_1.1.1_bin" or "dry_20251002153045_1.1.1_bin"
format_binary_tag() {
    local datetime="$1"
    local version="$2"
    local dry_run="${3:-false}"
    
    if [[ "$dry_run" == "true" ]]; then
        echo "dry_${datetime}_${version}_bin"
    else
        echo "${datetime}_${version}_bin"
    fi
}

# Format a source tag
# Usage: format_source_tag "20251002153045" "1.1.1" [dry_run]
# Returns: "20251002153045_1.1.1_src" or "dry_20251002153045_1.1.1_src"
format_source_tag() {
    local datetime="$1"
    local version="$2"
    local dry_run="${3:-false}"
    
    if [[ "$dry_run" == "true" ]]; then
        echo "dry_${datetime}_${version}_src"
    else
        echo "${datetime}_${version}_src"
    fi
}

# Get latest semantic version tag (from binary tags)
# Returns: version string (x.y.z) or empty string
get_latest_version() {
    local dry_run="${1:-false}"
    
    # Get all tags, filter for binary tag format
    local pattern
    if [[ "$dry_run" == "true" ]]; then
        pattern="dry_.*_bin"
    else
        # Match non-dry binary tags: datetime_version_bin
        pattern="^[0-9][0-9][0-9][0-9]-.*_bin$"
    fi
    
    # Get tags, extract version part (between last two underscores), sort semantically, get latest
    local latest_tag
    latest_tag=$(git tag -l 2>/dev/null | grep -E "${pattern}" | \
        sed 's/.*_\([0-9]*\.[0-9]*\.[0-9]*\)_bin$/\1/' | \
        sort -t. -k1,1n -k2,2n -k3,3n | \
        tail -1 || echo "")
    
    echo "$latest_tag"
}

# Calculate next version based on bump type
# Usage: calculate_next_version [bump_type] [dry_run]
# bump_type: major, minor, patch (default: patch)
# Returns: version string (x.y.z)
calculate_next_version() {
    local bump_type="${1:-patch}"
    local dry_run="${2:-false}"
    
    # Get latest version
    local latest_version
    latest_version=$(get_latest_version "$dry_run")
    
    # If no version exists, start with 0.0.1
    if [[ -z "$latest_version" ]]; then
        echo "0.0.1"
        return 0
    fi
    
    # Parse current version
    read -r major minor patch <<< "$(parse_version "$latest_version")"
    
    # Bump version based on type
    case "$bump_type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo "Error: Invalid bump type. Use: major, minor, or patch" >&2
            exit 1
            ;;
    esac
    
    format_display_version "$major" "$minor" "$patch"
}

# Validate semantic version format
# Usage: validate_version "1.2.3"
# Returns: 0 if valid, 1 if invalid
validate_version() {
    local version="$1"
    
    # Check format with or without leading zeros
    if [[ ! "$version" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 1
    fi
    
    return 0
}

# Parse a binary release tag to extract version
# Usage: parse_release_tag "20251002153045_1.2.3_bin"
# Returns: version string (1.2.3)
parse_release_tag() {
    local tag="$1"
    
    # Remove dry_ prefix if present
    tag="${tag#dry_}"
    
    # Remove _bin or _src suffix
    tag="${tag%_bin}"
    tag="${tag%_src}"
    
    # Extract version after last underscore
    echo "${tag##*_}"
}

# CLI handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    command="${1:-}"
    
    case "$command" in
        parse)
            if [[ -z "${2:-}" ]]; then
                echo "Error: Version string required" >&2
                exit 1
            fi
            parse_version "$2"
            ;;
        latest)
            dry_run="${2:-false}"
            version=$(get_latest_version "$dry_run")
            if [[ -n "$version" ]]; then
                echo "$version"
            else
                echo "No versions found" >&2
                exit 1
            fi
            ;;
        next)
            bump_type="${2:-patch}"
            dry_run="${3:-false}"
            calculate_next_version "$bump_type" "$dry_run"
            ;;
        validate)
            if [[ -z "${2:-}" ]]; then
                echo "Error: Version string required" >&2
                exit 1
            fi
            if validate_version "$2"; then
                echo "Valid"
            else
                echo "Invalid" >&2
                exit 1
            fi
            ;;
        format-internal)
            if [[ -z "${2:-}" ]]; then
                echo "Error: Version string required" >&2
                exit 1
            fi
            read -r major minor patch <<< "$(parse_version "$2")"
            format_internal_version "$major" "$minor" "$patch"
            ;;
        format-binary-tag)
            if [[ -z "${2:-}" ]]; then
                echo "Error: Version string required" >&2
                exit 1
            fi
            datetime="${3:-$(get_current_datetime)}"
            dry_run="${4:-false}"
            format_binary_tag "$datetime" "$2" "$dry_run"
            ;;
        format-source-tag)
            if [[ -z "${2:-}" ]]; then
                echo "Error: Version string required" >&2
                exit 1
            fi
            datetime="${3:-$(get_current_datetime)}"
            dry_run="${4:-false}"
            format_source_tag "$datetime" "$2" "$dry_run"
            ;;
        *)
            echo "Version Utilities"
            echo ""
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  parse <version>                     Parse version into components (MAJOR MINOR PATCH)"
            echo "  latest [dry_run]                    Get latest version (default: false)"
            echo "  next [bump] [dry_run]               Calculate next version (bump: major|minor|patch)"
            echo "  validate <version>                  Validate version format"
            echo "  format-internal <version>           Format with leading zeros (001.002.003)"
            echo "  format-binary-tag <version> [datetime] [dry_run]  Format as binary tag"
            echo "  format-source-tag <version> [datetime] [dry_run]  Format as source tag"
            echo ""
            echo "Version Format: x.y.z (semantic versioning)"
            echo "  x = Major version"
            echo "  y = Minor version"
            echo "  z = Patch version"
            echo ""
            echo "Tag Formats:"
            echo "  Binary: <yyyymmddHHMMSS>_<semver>_bin (e.g., 20251002153045_1.1.1_bin)"
            echo "  Source: <yyyymmddHHMMSS>_<semver>_src (e.g., 20251002153045_1.1.1_src)"
            echo "  Dry-run: dry_<yyyymmddHHMMSS>_<semver>_bin/src"
            echo ""
            echo "Examples:"
            echo "  $0 next patch                      # Calculate next patch version"
            echo "  $0 next minor                      # Calculate next minor version"
            echo "  $0 parse 1.2.3                     # Parse into: 1 2 3"
            echo "  $0 format-internal 1.2.3           # Format as: 001.002.003"
            echo "  $0 format-binary-tag 1.1.1         # Format as: 20251002153045_1.1.1_bin"
            echo "  $0 format-source-tag 1.1.1         # Format as: 20251002153045_1.1.1_src"
            echo "  $0 latest                          # Get latest non-dry version"
            exit 1
            ;;
    esac
fi
