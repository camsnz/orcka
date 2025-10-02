#!/bin/bash

# TODO Ignore Management Script
# Adds time-bounded ignore comments for TODO/FIXME/etc annotations
# Usage: ./cmd/ignore-todo.sh <file> <line_number> <comment_type> [days]

set -euo pipefail

# Default values
DEFAULT_DAYS=7
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help function
show_help() {
    cat << EOF
TODO Ignore Management Script

USAGE:
    $0 <file> <line_number> <comment_type> [days]

ARGUMENTS:
    file           Path to the file containing the TODO/FIXME comment
    line_number    Line number of the TODO/FIXME comment (1-based)
    comment_type   Type of comment (TODO, FIXME, HACK, NOTE, etc.)
    days           Number of days to ignore (default: $DEFAULT_DAYS, max: 90)

EXAMPLES:
    $0 src/utils/file-utils.ts 42 TODO 7
    $0 src/core/validator.ts 123 FIXME 14
    $0 src/lib/parser.ts 89 HACK

The script will add a comment like:
    // health-checks: ignore TODO until 2025-09-29

NOTES:
    - Maximum ignore period is 90 days (3 months)
    - Ignore comments are added on the line immediately before the target comment
    - The script validates that the target line contains the specified comment type
    - Dates are in ISO format (YYYY-MM-DD)

EOF
}

# Validation functions
validate_file() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}Error: File '$file' does not exist${NC}" >&2
        return 1
    fi
    
    # Convert to absolute path if relative
    if [[ ! "$file" = /* ]]; then
        file="$PROJECT_ROOT/$file"
    fi
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}Error: File '$file' does not exist${NC}" >&2
        return 1
    fi
    
    echo "$file"
}

validate_line_number() {
    local file="$1"
    local line_number="$2"
    
    if ! [[ "$line_number" =~ ^[0-9]+$ ]] || [[ "$line_number" -lt 1 ]]; then
        echo -e "${RED}Error: Line number must be a positive integer${NC}" >&2
        return 1
    fi
    
    local total_lines
    total_lines=$(wc -l < "$file")
    
    if [[ "$line_number" -gt "$total_lines" ]]; then
        echo -e "${RED}Error: Line number $line_number exceeds file length ($total_lines lines)${NC}" >&2
        return 1
    fi
    
    return 0
}

validate_comment_type() {
    local comment_type="$1"
    
    # Allow common comment types
    local valid_types=("TODO" "FIXME" "HACK" "NOTE" "BUG" "OPTIMIZE" "REFACTOR")
    
    for valid_type in "${valid_types[@]}"; do
        if [[ "$comment_type" == "$valid_type" ]]; then
            return 0
        fi
    done
    
    echo -e "${YELLOW}Warning: '$comment_type' is not a standard comment type${NC}" >&2
    echo -e "${YELLOW}Standard types: ${valid_types[*]}${NC}" >&2
    
    # Allow it anyway but warn
    return 0
}

validate_days() {
    local days="$1"
    
    if ! [[ "$days" =~ ^[0-9]+$ ]] || [[ "$days" -lt 1 ]]; then
        echo -e "${RED}Error: Days must be a positive integer${NC}" >&2
        return 1
    fi
    
    if [[ "$days" -gt 90 ]]; then
        echo -e "${RED}Error: Maximum ignore period is 90 days (3 months)${NC}" >&2
        return 1
    fi
    
    return 0
}

calculate_ignore_date() {
    local days="$1"
    
    # Calculate future date (works on both macOS and Linux)
    if command -v gdate >/dev/null 2>&1; then
        # macOS with GNU coreutils
        gdate -d "+${days} days" '+%Y-%m-%d'
    elif date --version >/dev/null 2>&1; then
        # GNU date (Linux)
        date -d "+${days} days" '+%Y-%m-%d'
    else
        # BSD date (macOS default)
        date -v "+${days}d" '+%Y-%m-%d'
    fi
}

check_target_line() {
    local file="$1"
    local line_number="$2"
    local comment_type="$3"
    
    local target_line
    target_line=$(sed -n "${line_number}p" "$file")
    
    if [[ ! "$target_line" =~ $comment_type ]]; then
        echo -e "${RED}Error: Line $line_number does not contain '$comment_type'${NC}" >&2
        echo -e "${YELLOW}Line content: $target_line${NC}" >&2
        return 1
    fi
    
    return 0
}

check_existing_ignore() {
    local file="$1"
    local line_number="$2"
    local comment_type="$3"
    
    if [[ "$line_number" -gt 1 ]]; then
        local prev_line_number=$((line_number - 1))
        local prev_line
        prev_line=$(sed -n "${prev_line_number}p" "$file")
        
        if [[ "$prev_line" =~ health-checks:\ ignore\ $comment_type\ until ]]; then
            echo -e "${YELLOW}Warning: Line $prev_line_number already has an ignore comment${NC}" >&2
            echo -e "${YELLOW}Existing: $prev_line${NC}" >&2
            
            # Extract the date and check if it's still valid
            local existing_date
            existing_date=$(echo "$prev_line" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}')
            
            if [[ -n "$existing_date" ]]; then
                local current_date
                current_date=$(date '+%Y-%m-%d')
                
                if [[ "$existing_date" > "$current_date" ]]; then
                    echo -e "${YELLOW}Existing ignore is still valid until $existing_date${NC}" >&2
                    read -p "Do you want to update it? (y/N): " -n 1 -r
                    echo
                    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                        echo -e "${BLUE}Keeping existing ignore comment${NC}"
                        return 1
                    fi
                else
                    echo -e "${GREEN}Existing ignore has expired, will update${NC}" >&2
                fi
            fi
            
            return 2  # Indicates existing ignore found
        fi
    fi
    
    return 0
}

add_ignore_comment() {
    local file="$1"
    local line_number="$2"
    local comment_type="$3"
    local ignore_date="$4"
    local existing_ignore="$5"
    
    local ignore_comment="// health-checks: ignore $comment_type until $ignore_date"
    
    if [[ "$existing_ignore" == "2" ]]; then
        # Update existing ignore comment
        local prev_line_number=$((line_number - 1))
        
        # Create a backup
        cp "$file" "$file.bak"
        
        # Replace the existing ignore line
        sed -i.tmp "${prev_line_number}s|.*|$ignore_comment|" "$file"
        rm -f "$file.tmp"
        
        echo -e "${GREEN}Updated existing ignore comment at line $prev_line_number${NC}"
    else
        # Add new ignore comment
        # Create a backup
        cp "$file" "$file.bak"
        
        # Insert the ignore comment before the target line
        sed -i.tmp "${line_number}i\\
$ignore_comment" "$file"
        rm -f "$file.tmp"
        
        echo -e "${GREEN}Added ignore comment at line $line_number${NC}"
    fi
    
    echo -e "${BLUE}Ignore comment: $ignore_comment${NC}"
    echo -e "${YELLOW}Backup created: $file.bak${NC}"
}

# Main function
main() {
    # Parse arguments
    if [[ $# -lt 3 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    local file="$1"
    local line_number="$2"
    local comment_type="$3"
    local days="${4:-$DEFAULT_DAYS}"
    
    echo -e "${BLUE}TODO Ignore Management${NC}"
    echo -e "${BLUE}=====================${NC}"
    
    # Validate inputs
    echo -e "${YELLOW}Validating inputs...${NC}"
    
    file=$(validate_file "$file") || exit 1
    validate_line_number "$file" "$line_number" || exit 1
    validate_comment_type "$comment_type" || exit 1
    validate_days "$days" || exit 1
    
    echo -e "${GREEN}✓ All inputs valid${NC}"
    
    # Check target line contains the comment type
    echo -e "${YELLOW}Checking target line...${NC}"
    check_target_line "$file" "$line_number" "$comment_type" || exit 1
    echo -e "${GREEN}✓ Target line contains '$comment_type'${NC}"
    
    # Check for existing ignore comments
    echo -e "${YELLOW}Checking for existing ignore comments...${NC}"
    check_existing_ignore "$file" "$line_number" "$comment_type"
    local existing_ignore=$?
    
    if [[ "$existing_ignore" == "1" ]]; then
        echo -e "${BLUE}No changes made${NC}"
        exit 0
    fi
    
    # Calculate ignore date
    local ignore_date
    ignore_date=$(calculate_ignore_date "$days")
    
    echo -e "${YELLOW}Will ignore '$comment_type' until: $ignore_date${NC}"
    
    # Add ignore comment
    echo -e "${YELLOW}Adding ignore comment...${NC}"
    add_ignore_comment "$file" "$line_number" "$comment_type" "$ignore_date" "$existing_ignore"
    
    echo -e "${GREEN}✓ Successfully added ignore comment${NC}"
    echo -e "${BLUE}File: $file${NC}"
    echo -e "${BLUE}Line: $line_number${NC}"
    echo -e "${BLUE}Type: $comment_type${NC}"
    echo -e "${BLUE}Until: $ignore_date${NC}"
}

# Run main function
main "$@"
