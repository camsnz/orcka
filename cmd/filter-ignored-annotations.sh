#!/bin/bash

# Filter Ignored Annotations Utility
# Filters out TODO/FIXME/etc comments that have valid ignore directives
# Usage: ./cmd/filter-ignored-annotations.sh <annotation_type> [directory]

set -euo pipefail

# Default values
DEFAULT_DIR="src/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Help function
show_help() {
    cat << EOF
Filter Ignored Annotations Utility

USAGE:
    $0 <annotation_type> [directory]

ARGUMENTS:
    annotation_type    Type of annotation to search for (TODO, FIXME, HACK, etc.)
    directory         Directory to search in (default: src/)

EXAMPLES:
    $0 TODO
    $0 FIXME src/
    $0 HACK lib/

The script will:
1. Find all lines containing the specified annotation type
2. Check if the line above has a valid ignore directive
3. Filter out ignored annotations that haven't expired
4. Return only non-ignored annotations

Ignore directive format:
    // health-checks: ignore TODO until 2025-09-29

EOF
}

# Date comparison function (works on both macOS and Linux)
is_date_future() {
    local target_date="$1"
    local current_date
    
    # Get current date in YYYY-MM-DD format
    current_date=$(date '+%Y-%m-%d')
    
    # Simple string comparison works for YYYY-MM-DD format
    [[ "$target_date" > "$current_date" ]]
}

# Check if a line has a valid ignore directive
has_valid_ignore() {
    local file="$1"
    local line_number="$2"
    local annotation_type="$3"
    
    # Check if there's a previous line
    if [[ "$line_number" -le 1 ]]; then
        return 1
    fi
    
    local prev_line_number=$((line_number - 1))
    local prev_line
    
    # Get the previous line
    prev_line=$(sed -n "${prev_line_number}p" "$file" 2>/dev/null || echo "")
    
    # Check if it matches the ignore pattern
    if [[ "$prev_line" =~ health-checks:\ ignore\ $annotation_type\ until\ ([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
        local ignore_date="${BASH_REMATCH[1]}"
        
        # Check if the ignore date is still in the future
        if is_date_future "$ignore_date"; then
            return 0  # Valid ignore found
        fi
    fi
    
    return 1  # No valid ignore found
}

# Main filtering function
filter_annotations() {
    local annotation_type="$1"
    local search_dir="${2:-$DEFAULT_DIR}"
    
    # Find all files with the annotation type
    local temp_results
    temp_results=$(mktemp)
    
    # Search for annotations with line numbers and file names, excluding ignore comments and backup files
    grep -rn "$annotation_type:" "$search_dir" 2>/dev/null | grep -v "health-checks: ignore" | grep -v "\.bak:" > "$temp_results" || true
    
    # Process each result
    while IFS=':' read -r file line_number content; do
        # Skip empty lines
        [[ -n "$file" && -n "$line_number" && -n "$content" ]] || continue
        
        # Check if this annotation has a valid ignore directive
        if ! has_valid_ignore "$file" "$line_number" "$annotation_type"; then
            # No valid ignore found, include this annotation
            echo "$file:$line_number:$content"
        fi
    done < "$temp_results"
    
    # Clean up
    rm -f "$temp_results"
}

# Count filtered annotations
count_filtered_annotations() {
    local annotation_type="$1"
    local search_dir="${2:-$DEFAULT_DIR}"
    
    filter_annotations "$annotation_type" "$search_dir" | wc -l | tr -d ' '
}

# Main function
main() {
    # Parse arguments
    if [[ $# -lt 1 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    local annotation_type="$1"
    local search_dir="${2:-$DEFAULT_DIR}"
    
    # Validate annotation type
    if [[ ! "$annotation_type" =~ ^[A-Z]+$ ]]; then
        echo "Error: Annotation type must be uppercase letters only" >&2
        exit 1
    fi
    
    # Validate directory
    if [[ ! -d "$search_dir" ]]; then
        echo "Error: Directory '$search_dir' does not exist" >&2
        exit 1
    fi
    
    # Check if we're being called for counting
    if [[ "${FILTER_COUNT_ONLY:-}" == "1" ]]; then
        count_filtered_annotations "$annotation_type" "$search_dir"
    else
        filter_annotations "$annotation_type" "$search_dir"
    fi
}

# Run main function
main "$@"
