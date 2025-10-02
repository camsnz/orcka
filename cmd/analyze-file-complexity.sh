#!/bin/bash

# Enhanced File Size Analysis Script
# Analyzes both line count and estimated token count with four severity categories
# Helps maintain code modularity and ensures files remain manageable for AI-assisted development

set -euo pipefail

# Function to display help
show_help() {
    cat << EOF
🔍 Enhanced File Size Analysis Script

USAGE:
    $0 [OPTIONS]

DESCRIPTION:
    Analyzes TypeScript files in the src/ directory to identify files that exceed
    LLM-friendly size thresholds. Helps maintain code modularity and ensures files
    remain manageable for AI-assisted development.

OPTIONS:
    --summary     Show only summary statistics and top 10 worst files
    --no-color    Disable ANSI color output (useful for programmatic parsing)
    --help        Display this help message and exit

ANALYSIS CATEGORIES:
    ✅ GOOD      Files within baseline (≤350 LoC, ≤2800 tokens)
    ⚠️  WARNING   Files 1-40% over baseline (351-490 LoC, 2801-3920 tokens)
    ❌ BAD       Files 41-100% over baseline (491-700 LoC, 3921-5600 tokens)
    🚨 SEVERE    Files >100% over baseline (>700 LoC, >5600 tokens)

BASELINES:
    • Lines of Code (LoC): 350 lines
    • Estimated Tokens: 2800 tokens (~350 LoC * 8 chars/line average)

EXIT CODES:
    0    Success (no severe files found)
    1    Failure (severe files found, >100% over baseline)

EXAMPLES:
    $0                 # Full analysis with all files listed
    $0 --summary       # Summary with top 10 worst files only
    $0 --help          # Show this help message

EOF
}

# Parse command line arguments
SUMMARY_MODE=false
USE_COLOR=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --summary)
            SUMMARY_MODE=true
            shift
            ;;
        --no-color|--plain)
            USE_COLOR=false
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "❌ Error: Unknown option '$1'"
            echo "Use '$0 --help' for usage information."
            exit 1
            ;;
    esac
done

# Configuration
SRC_DIR="src"

# Line count thresholds (percentage over 350 baseline)
LoC_BASELINE=350
LoC_GOOD_MAX=0          # Good: <= 350 LoC (0% over baseline)
LoC_WARNING_MAX=40      # Warning: 351-490 LoC (1-40% over baseline)  
LoC_BAD_MAX=100         # Bad: 491-700 LoC (41-100% over baseline)
# Severe: > 700 LoC (>100% over baseline)

# Estimated token count thresholds (rough approximation: 1 token ≈ 4 characters)
TOKEN_BASELINE=2800     # ~350 LoC * 8 chars/line average = 2800 tokens
TOKEN_GOOD_MAX=0        # Good: <= 2800 tokens
TOKEN_WARNING_MAX=40    # Warning: 2801-3920 tokens (1-40% over baseline)
TOKEN_BAD_MAX=100       # Bad: 3921-5600 tokens (41-100% over baseline)
# Severe: > 5600 tokens (>100% over baseline)

TEMP_FILE=$(mktemp)

# Cleanup function
cleanup() {
    rm -f "$TEMP_FILE"
}
trap cleanup EXIT

# Check if src directory exists
if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Error: $SRC_DIR directory not found"
    exit 1
fi

# Function to count lines of code (excluding comments and empty lines)
count_loc() {
    local file="$1"
    grep -v '^\s*$' "$file" | \
    grep -v '^\s*//' | \
    grep -v '^\s*/\*' | \
    grep -v '^\s*\*' | \
    wc -l | \
    tr -d ' '
}

# Function to estimate token count (words + symbols, rough approximation)
estimate_tokens() {
    local file="$1"
    # Count words and symbols as rough token estimate
    # Remove comments first, then count words and significant symbols
    local content
    content=$(grep -v '^\s*$' "$file" | \
              grep -v '^\s*//' | \
              grep -v '^\s*/\*' | \
              grep -v '^\s*\*')
    
    # Count words
    local word_count
    word_count=$(echo "$content" | wc -w | tr -d ' ')
    
    # Count significant symbols (operators, punctuation, etc.)
    local symbol_count
    symbol_count=$(echo "$content" | grep -o '[{}()[\];,.:=<>!&|+\-*/]' | wc -l | tr -d ' ')
    
    # Rough token estimate: words + symbols * 0.7 (some symbols are part of words)
    echo $((word_count + symbol_count * 7 / 10))
}

# Function to determine category based on percentage over baseline
get_category() {
    local percent_over="$1"
    
    if [ "$percent_over" -le "$LoC_GOOD_MAX" ]; then
        echo "GOOD"
    elif [ "$percent_over" -le "$LoC_WARNING_MAX" ]; then
        echo "WARNING"
    elif [ "$percent_over" -le "$LoC_BAD_MAX" ]; then
        echo "BAD"
    else
        echo "SEVERE"
    fi
}

# Function to get category color
get_category_color() {
    local category="$1"
    if [ "$USE_COLOR" != true ]; then
        echo ''
        return
    fi
    case "$category" in
        "GOOD") echo '\033[0;32m' ;;      # Green
        "WARNING") echo '\033[1;33m' ;;   # Yellow
        "BAD") echo '\033[0;31m' ;;       # Red
        "SEVERE") echo '\033[0;35m' ;;    # Magenta
        *) echo '\033[0m' ;;              # No color
    esac
}

if [ "$USE_COLOR" = true ]; then
    # Colors for output
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    NC='\033[0m' # No Color
else
    RED=''
    YELLOW=''
    GREEN=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    NC=''
fi

echo "🔍 Enhanced File Size Analysis"
printf "📏 LoC Baseline: ${LoC_BASELINE} lines | Token Baseline: ${TOKEN_BASELINE} tokens\n"
printf "📊 Categories: ${GREEN}Good${NC} (≤0%%) | ${YELLOW}Warning${NC} (1-40%%) | ${RED}Bad${NC} (41-100%%) | ${MAGENTA}Severe${NC} (>100%%)\n"
echo ""

# Find all TypeScript files and analyze them
total_files=0
total_loc=0
total_tokens=0

# Category counters
good_files=0
warning_files=0
bad_files=0
severe_files=0

find "$SRC_DIR" -name "*.ts" -type f | while read -r file; do
    loc=$(count_loc "$file")
    tokens=$(estimate_tokens "$file")
    
    # Calculate percentages over baseline
    loc_percent_over=$(( (loc - LoC_BASELINE) * 100 / LoC_BASELINE ))
    token_percent_over=$(( (tokens - TOKEN_BASELINE) * 100 / TOKEN_BASELINE ))
    
    # Determine worst category (LoC or tokens)
    loc_category=$(get_category "$loc_percent_over")
    token_category=$(get_category "$token_percent_over")
    
    # Use the worse of the two categories
    if [ "$loc_category" = "SEVERE" ] || [ "$token_category" = "SEVERE" ]; then
        worst_category="SEVERE"
    elif [ "$loc_category" = "BAD" ] || [ "$token_category" = "BAD" ]; then
        worst_category="BAD"
    elif [ "$loc_category" = "WARNING" ] || [ "$token_category" = "WARNING" ]; then
        worst_category="WARNING"
    else
        worst_category="GOOD"
    fi
    
    echo "${worst_category}:${loc}:${tokens}:${loc_percent_over}:${token_percent_over}:${file}" >> "$TEMP_FILE"
done

# Process results and count categories
while IFS=':' read -r category loc tokens loc_percent token_percent file; do
    total_files=$((total_files + 1))
    total_loc=$((total_loc + loc))
    total_tokens=$((total_tokens + tokens))
    
    case "$category" in
        "GOOD") good_files=$((good_files + 1)) ;;
        "WARNING") warning_files=$((warning_files + 1)) ;;
        "BAD") bad_files=$((bad_files + 1)) ;;
        "SEVERE") severe_files=$((severe_files + 1)) ;;
    esac
done < "$TEMP_FILE"

# Calculate averages
if [ "$total_files" -gt 0 ]; then
    avg_loc=$((total_loc / total_files))
    avg_tokens=$((total_tokens / total_files))
else
    avg_loc=0
    avg_tokens=0
fi

# Display summary
echo "📊 Total files: $total_files | Average LoC: $avg_loc | Average tokens: $avg_tokens"
echo ""
echo "📈 Category Distribution:"
printf "   ${GREEN}Good${NC}:    %2d files (≤%d LoC, ≤%d tokens)\n" "$good_files" "$LoC_BASELINE" "$TOKEN_BASELINE"
printf "   ${YELLOW}Warning${NC}: %2d files (1-40%% over baseline)\n" "$warning_files"
printf "   ${RED}Bad${NC}:     %2d files (41-100%% over baseline)\n" "$bad_files"
printf "   ${MAGENTA}Severe${NC}:  %2d files (>100%% over baseline)\n" "$severe_files"
echo ""

# Helper function to format and display a single file entry
format_file_entry() {
    local category="$1"
    local loc="$2"
    local tokens="$3"
    local loc_percent="$4"
    local token_percent="$5"
    local file="$6"
    local color
    color=$(get_category_color "$category")
    
    # Format percentages with proper padding (max 4 chars: -10% or 100%)
    local loc_display
    local token_display
    if [ "$loc_percent" -lt 0 ]; then
        loc_display=$(printf "(%4s)" "${loc_percent}%")
    else
        loc_display=$(printf "(%4s)" "+${loc_percent}%")
    fi
    
    if [ "$token_percent" -lt 0 ]; then
        token_display=$(printf "(%4s)" "${token_percent}%")
    else
        token_display=$(printf "(%4s)" "+${token_percent}%")
    fi
    
    # Shorten WARNING to WARN for better alignment
    local display_category="$category"
    if [ "$category" = "WARNING" ]; then
        display_category="WARN"
    fi
    
    printf "   ${color}•${NC} %-60s [${color}%s${NC}]\n" "$file" "$display_category"
    printf "     📏 %5d LoC %s | 🔤 %5d tokens %s\n" "$loc" "$loc_display" "$tokens" "$token_display"
}

# Function to display files by category
display_category() {
    local category="$1"
    local title="$2"
    local color
    color=$(get_category_color "$category")
    
    echo -e "${color}${title}${NC}"
    
    if [ -s "$TEMP_FILE" ]; then
        grep "^${category}:" "$TEMP_FILE" | sort -t':' -k2,2nr | while IFS=':' read -r cat loc tokens loc_percent token_percent file; do
            format_file_entry "$category" "$loc" "$tokens" "$loc_percent" "$token_percent" "$file"
        done
    fi
    echo ""
}

# Function to display top 10 worst files (for summary mode)
display_top_worst_files() {
    echo "🔥 Top 10 Worst Files:"
    echo ""
    
    if [ -s "$TEMP_FILE" ]; then
        # Sort all files by LoC descending and take top 10
        sort -t':' -k2,2nr "$TEMP_FILE" | head -10 | while IFS=':' read -r category loc tokens loc_percent token_percent file; do
            format_file_entry "$category" "$loc" "$tokens" "$loc_percent" "$token_percent" "$file"
        done
    else
        echo "   No files found to analyze."
    fi
    echo ""
}

# Display files based on mode
if [ "$SUMMARY_MODE" = true ]; then
    # Summary mode: show only top 10 worst files
    display_top_worst_files
else
    # Full mode: display files by category (worst first)
    if [ "$severe_files" -gt 0 ]; then
        display_category "SEVERE" "🚨 SEVERE Files (>100% over baseline):"
    fi

    if [ "$bad_files" -gt 0 ]; then
        display_category "BAD" "❌ BAD Files (41-100% over baseline):"
    fi

    if [ "$warning_files" -gt 0 ]; then
        display_category "WARNING" "⚠️  WARNING Files (1-40% over baseline):"
    fi

    if [ "$good_files" -gt 0 ]; then
        display_category "GOOD" "✅ GOOD Files (within baseline):"
    fi
fi

# Recommendations
problem_files=$((severe_files + bad_files))
if [ "$problem_files" -gt 0 ]; then
    echo "💡 Recommendations:"
    echo "   • Refactor SEVERE and BAD files into smaller, focused modules"
    echo "   • Extract helper functions and utilities into separate files"
    echo "   • Follow the single responsibility principle"
    echo "   • Use absolute imports (@/core, @/utils) to reduce relative path complexity"
    echo "   • Consider breaking large files into domain-specific modules"
    echo ""
fi

# Exit with error code based on worst category found (for CI integration)
if [ "$severe_files" -gt 0 ]; then
    echo "❌ Build failed: $severe_files SEVERE file(s) found (>100% over baseline)"
    exit 1
elif [ "$bad_files" -gt 0 ]; then
    echo "⚠️  Build warning: $bad_files BAD file(s) found (41-100% over baseline)"
    # Don't exit with error for BAD files, just warn
    exit 0
else
    echo "✅ All files are within acceptable size limits"
    exit 0
fi
