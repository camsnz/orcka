#!/bin/bash

# Health Check Common Utilities
# Shared functions and variables for all health check modules

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "ℹ️  $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_critical() {
    echo -e "${RED}🔥 $1${NC}"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Summary collection
HEALTH_SUMMARIES=()
SECTION_EMOJIS=()

add_summary() {
    HEALTH_SUMMARIES+=("$1")
}

add_section_emojis() {
    local section="$1"
    local emojis="$2"
    SECTION_EMOJIS+=("$(printf "%-13s%s" "$section:" "$emojis")")
}

print_summaries() {
    if [[ ${#SECTION_EMOJIS[@]} -gt 0 ]]; then
        echo ""
        for emoji_line in "${SECTION_EMOJIS[@]}"; do
            echo "$emoji_line"
        done
    fi
}

# Get current time in milliseconds (cross-platform)
get_time_ms() {
    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import time; print(int(time.time() * 1000))'
    elif command -v gdate >/dev/null 2>&1; then
        gdate +%s%3N
    else
        # Fallback: use seconds * 1000
        echo $(($(date +%s) * 1000))
    fi
}

# Timing utilities
start_timer() {
    HEALTH_START_TIME=$(get_time_ms)
}

end_timer() {
    local end_time=$(get_time_ms)
    local duration=$((end_time - HEALTH_START_TIME))
    echo -e "\nAssessment completed in $(format_duration $duration)"
}

# Section timing
start_section_timer() {
    SECTION_START_TIME=$(get_time_ms)
}

get_section_duration() {
    local end_time=$(get_time_ms)
    local duration=$((end_time - SECTION_START_TIME))
    format_duration $duration
}

# Format duration in ms to human readable (3ms, 4s, 1m30s)
format_duration() {
    local duration_ms=$1
    local duration_s=$((duration_ms / 1000))
    local ms=$((duration_ms % 1000))
    
    if [[ $duration_s -ge 60 ]]; then
        local minutes=$((duration_s / 60))
        local seconds=$((duration_s % 60))
        echo "${minutes}m${seconds}s"
    elif [[ $duration_s -gt 0 ]]; then
        echo "${duration_s}s"
    else
        echo "${duration_ms}ms"
    fi
}

# Health status tracking
OVERALL_STATUS="✅"

update_overall_status() {
    local new_status="$1"
    case "$new_status" in
        "🔥") OVERALL_STATUS="🔥" ;;
        "❌") [[ "$OVERALL_STATUS" != "🔥" ]] && OVERALL_STATUS="❌" ;;
        "⚠️") [[ "$OVERALL_STATUS" != "🔥" && "$OVERALL_STATUS" != "❌" ]] && OVERALL_STATUS="⚠️" ;;
    esac
}

print_overall_status() {
    case "$OVERALL_STATUS" in
        "✅") echo -e "${GREEN}✅ Overall Health: EXCELLENT${NC}" ;;
        "⚠️") echo -e "${YELLOW}⚠️  Overall Health: DECENT (warnings present)${NC}" ;;
        "❌") echo -e "${RED}❌ Overall Health: BAD (significant issues detected)${NC}" ;;
        "🔥") echo -e "${RED}🔥 Overall Health: SEVERE (compile/build failures)${NC}" ;;
    esac
}

# Exit code mapping
get_exit_code() {
    case "$OVERALL_STATUS" in
        "✅") echo 0 ;;
        "⚠️") echo 1 ;;
        "❌") echo 2 ;;
        "🔥") echo 3 ;;
    esac
}

# Enhanced formatting functions
print_section_header() {
    local title="$1"
    local timing="${2:-}"
    echo ""
    echo -e "${BLUE}╭─────────────────────────────────────────────────────────────────╮${NC}"
    if [[ -n "$timing" ]]; then
        # Calculate padding to right-align timing
        local title_with_icon="📋 $title"
        local total_width=63
        local title_len=${#title_with_icon}
        local timing_len=${#timing}
        local padding=$((total_width - title_len - timing_len - 1))
        printf "${BLUE}│${NC} %s%*s%s ${BLUE}│${NC}\n" "$title_with_icon" "$padding" "" "$timing"
    else
        printf "${BLUE}│${NC} 📋 %-60s ${BLUE}│${NC}\n" "$title"
    fi
    echo -e "${BLUE}╰─────────────────────────────────────────────────────────────────╯${NC}"
}

print_check_result() {
    local status="$1"
    local message="$2"
    local detail_cmd="${3:-}"
    local timing="${4:-}"
    
    case "$status" in
        "success")
            if [[ -n "$timing" ]]; then
                printf "  ${GREEN}✅${NC} %-43s %10s\n" "$message" "$timing"
            else
                printf "  ${GREEN}✅${NC} %-50s\n" "$message"
            fi
            ;;
        "warning")
            if [[ -n "$timing" ]]; then
                printf "  ${YELLOW}⚠️${NC}  %-42s %10s\n" "$message" "$timing"
            else
                printf "  ${YELLOW}⚠️${NC}  %-50s\n" "$message"
            fi
            [[ -n "$detail_cmd" ]] && printf "     ${CYAN}→ Run: ${detail_cmd}${NC}\n"
            ;;
        "error")
            if [[ -n "$timing" ]]; then
                printf "  ${RED}❌${NC} %-43s %10s\n" "$message" "$timing"
            else
                printf "  ${RED}❌${NC} %-50s\n" "$message"
            fi
            [[ -n "$detail_cmd" ]] && printf "     ${CYAN}→ Run: ${detail_cmd}${NC}\n"
            ;;
        "critical")
            if [[ -n "$timing" ]]; then
                printf "  ${RED}🔥${NC} %-43s %10s\n" "$message" "$timing"
            else
                printf "  ${RED}🔥${NC} %-50s\n" "$message"
            fi
            [[ -n "$detail_cmd" ]] && printf "     ${CYAN}→ Run: ${detail_cmd}${NC}\n"
            ;;
        "info")
            if [[ -n "$timing" ]]; then
                printf "  ${BLUE}ℹ️${NC}  %-42s %10s\n" "$message" "$timing"
            else
                printf "  ${BLUE}ℹ️${NC}  %-50s\n" "$message"
            fi
            [[ -n "$detail_cmd" ]] && printf "     ${CYAN}→ Run: ${detail_cmd}${NC}\n"
            ;;
    esac
    
    # Print command if in detailed mode
    if [[ "${DETAILED_MODE:-false}" == "true" ]] && [[ -n "$detail_cmd" ]]; then
        printf "     ${CYAN}💻 Command: ${detail_cmd}${NC}\n"
    fi
}

print_section_summary() {
    local section="$1"
    local status="$2"
    local summary="$3"
    local guidance="$4"
    
    # Only show guidance if there are issues
    if [[ -n "$guidance" ]]; then
        case "$status" in
            "warning")
                echo -e "   ${YELLOW}💡 Guidance:${NC}"
                # Split guidance on ". " and create bullet points
                echo "$guidance" | sed 's/\. /.\n/g' | while IFS= read -r line; do
                    [[ -n "$line" ]] && echo -e "     ${YELLOW}•${NC} $line"
                done
                ;;
            "error")
                echo -e "   ${RED}🚨 Action Required:${NC}"
                # Split guidance on ". " and create bullet points  
                echo "$guidance" | sed 's/\. /.\n/g' | while IFS= read -r line; do
                    [[ -n "$line" ]] && echo -e "     ${RED}•${NC} $line"
                done
                ;;
            "critical")
                echo -e "   ${RED}🔥 Critical Issues:${NC}"
                # Split guidance on ". " and create bullet points
                echo "$guidance" | sed 's/\. /.\n/g' | while IFS= read -r line; do
                    [[ -n "$line" ]] && echo -e "     ${RED}•${NC} $line"
                done
                ;;
        esac
    fi
}

# Coverage signal interpretation
get_coverage_signal() {
    local coverage="$1"
    local coverage_int=${coverage%.*}  # Remove decimal part
    
    if [[ $coverage_int -ge 90 ]]; then
        echo "HIGH (Excellent coverage with minor gaps)"
    elif [[ $coverage_int -ge 80 ]]; then
        echo "GOOD (Strong coverage, investigate gaps)"
    elif [[ $coverage_int -ge 70 ]]; then
        echo "SOLID (Adequate coverage, room for improvement)"
    elif [[ $coverage_int -ge 60 ]]; then
        echo "OK (Moderate coverage, needs attention)"
    elif [[ $coverage_int -ge 50 ]]; then
        echo "LOW (Poor coverage, significant gaps)"
    elif [[ $coverage_int -ge 40 ]]; then
        echo "POOR (Critical coverage issues)"
    else
        echo "AWFUL (Unacceptable coverage levels)"
    fi
}

# Guidance messages based on AGENTS.md
get_coverage_guidance() {
    local coverage="$1"
    local coverage_int=${coverage%.*}
    
    if [[ $coverage_int -ge 80 ]]; then
        echo "Coverage is good. Focus on testing edge cases and complex logic paths."
    elif [[ $coverage_int -ge 60 ]]; then
        echo "Add tests for uncovered functions and branches. Use coverage reports to identify gaps."
    else
        echo "Critical: Add comprehensive test coverage. Tests serve as living documentation."
    fi
}

get_dead_code_guidance() {
    local issues="$1"
    
    if [[ $issues -gt 10 ]]; then
        echo "Critical: Review and remove unused code following AGENTS.md dead code removal guidelines."
    elif [[ $issues -gt 5 ]]; then
        echo "Consider cleaning up unused exports and files to improve maintainability."
    else
        echo "Minor issues detected. Review unused exports - they may be intentional public API."
    fi
}

get_todo_guidance() {
    local count="$1"
    
    if [[ $count -gt 10 ]]; then
        echo "High TODO count may indicate incomplete features. Prioritize and address systematically."
    elif [[ $count -gt 5 ]]; then
        echo "Review TODOs and convert to proper issues or implement improvements."
    else
        echo "Manageable TODO count. Consider addressing during next development cycle."
    fi
}
