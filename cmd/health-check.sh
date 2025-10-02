#!/bin/bash

# Modular Health Check System
# Comprehensive codebase health assessment with modular architecture

set -uo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/health-check/common.sh"

# Available health check modules
AVAILABLE_CHECKS=("dependencies" "testing" "quality")

# Default checks to run (all)
DEFAULT_CHECKS=("${AVAILABLE_CHECKS[@]}")

# Usage information
show_usage() {
    cat << EOF
Health Check System - Comprehensive Codebase Assessment

USAGE:
    $0 [OPTIONS] [CHECKS...]

OPTIONS:
    --only CHECKS       Run only specified checks (comma-separated or space-separated)
    --help, -h          Show this help message
    --list              List available health checks
    --summary           Show only summary output (LLM-friendly)
    --detailed          Show commands run and test counts for each check
    --quick             Skip slow checks (contract tests) for faster feedback
    --force-all-tests   Force all tests to run (override session optimization)
    --buffered          Use buffered output mode (wait for all checks to complete)
    --streaming         Use streaming output mode (show results as they complete) [DEFAULT]

AVAILABLE CHECKS:
    dependencies        Package installation, security audit, outdated packages
    testing            Unit tests, E2E tests, code coverage analysis
    quality            Type checking, build, linting, file complexity, dead code

EXAMPLES:
    $0                                    # Run all health checks with streaming output
    $0 --only dependencies,testing        # Run only dependencies and testing checks
    $0 --only quality                     # Run only quality checks
    $0 dependencies quality               # Run dependencies and quality checks
    $0 --summary                          # Show summary output only
    $0 --buffered                         # Use original buffered output mode
    $0 --list                            # List available checks

OUTPUT MODES:
    --streaming (default)   Results appear as each individual check completes
    --buffered             Results appear only after entire module completes
    --summary              Show only final summaries (LLM-friendly)

EXIT CODES:
    0    EXCELLENT health (all checks passed)
    1    DECENT health (warnings detected - TODOs, minor issues)
    2    BAD health (test failures, lint errors, significant issues)
    3    SEVERE health (compile failures, build failures, critical issues)

MODULAR ARCHITECTURE:
    Each check is implemented as a separate module in cmd/health-check/
    - cmd/health-check/dependencies.sh
    - cmd/health-check/testing.sh
    - cmd/health-check/quality.sh
EOF
}

# List available checks
list_checks() {
    echo "Available Health Checks:"
    echo "  dependencies  - Package management and security"
    echo "  testing       - Test execution and coverage"
    echo "  quality       - Code quality and standards"
}

# Parse command line arguments
parse_arguments() {
    local checks_to_run=()
    local summary_mode=false
    local detailed_mode=false
    local quick_mode=false
    local force_all_tests=false
    local streaming_mode=true  # Default to streaming mode
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --list)
                list_checks
                exit 0
                ;;
            --summary)
                summary_mode=true
                shift
                ;;
            --detailed)
                detailed_mode=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --force-all-tests)
                force_all_tests=true
                shift
                ;;
            --buffered)
                streaming_mode=false
                shift
                ;;
            --streaming)
                streaming_mode=true
                shift
                ;;
            --only)
                if [[ $# -lt 2 ]]; then
                    echo "Error: --only requires a list of checks" >&2
                    exit 1
                fi
                shift
                # Parse comma-separated or space-separated checks
                IFS=',' read -ra ADDR <<< "$1"
                for check in "${ADDR[@]}"; do
                    check=$(echo "$check" | tr -d ' ')  # Remove spaces
                    if [[ " ${AVAILABLE_CHECKS[*]} " =~ " ${check} " ]]; then
                        checks_to_run+=("$check")
                    else
                        echo "Error: Unknown check '$check'" >&2
                        echo "Available checks: ${AVAILABLE_CHECKS[*]}" >&2
                        exit 1
                    fi
                done
                shift
                ;;
            --*)
                echo "Error: Unknown option $1" >&2
                show_usage
                exit 1
                ;;
            *)
                # Treat as check name
                if [[ " ${AVAILABLE_CHECKS[*]} " =~ " ${1} " ]]; then
                    checks_to_run+=("$1")
                else
                    echo "Error: Unknown check '$1'" >&2
                    echo "Available checks: ${AVAILABLE_CHECKS[*]}" >&2
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Use default checks if none specified
    if [[ ${#checks_to_run[@]} -eq 0 ]]; then
        checks_to_run=("${DEFAULT_CHECKS[@]}")
    fi
    
    # Export for use by main function
    export CHECKS_TO_RUN="${checks_to_run[*]}"
    export SUMMARY_MODE="$summary_mode"
    export DETAILED_MODE="$detailed_mode"
    export QUICK_MODE="$quick_mode"
    export FORCE_ALL_TESTS="$force_all_tests"
    export STREAMING_MODE="$streaming_mode"
}

# Run a specific health check module with real-time output
run_health_check() {
    local check_name="$1"
    local streaming_mode="${2:-false}"
    local check_script="$SCRIPT_DIR/health-check/${check_name}.sh"
    
    if [[ ! -f "$check_script" ]]; then
        log_error "Health check module not found: $check_script"
        return 1
    fi
    
    # Make sure the script is executable
    chmod +x "$check_script"
    
    if [[ "$streaming_mode" == "true" ]]; then
        # Run with real-time streaming output
        run_health_check_streaming "$check_name" "$check_script"
    else
        # Original buffered mode
        run_health_check_buffered "$check_name" "$check_script"
    fi
}

# Run health check with real-time streaming output
run_health_check_streaming() {
    local check_name="$1"
    local check_script="$2"
    
    # Source the script to get access to individual functions
    source "$check_script"
    
    # Run individual check functions - they handle their own output and status updates
    case "$check_name" in
        "dependencies")
            check_dependencies
            ;;
        "testing")
            check_testing
            ;;
        "quality")
            check_quality
            ;;
        *)
            log_error "Unknown check function for: $check_name"
            return 1
            ;;
    esac
}

# Run health check with original buffered mode
run_health_check_buffered() {
    local check_name="$1"
    local check_script="$2"
    
    # Source and run the check
    source "$check_script"
    
    # Call the check function - they handle their own output and status updates
    case "$check_name" in
        "dependencies") 
            check_dependencies
            ;;
        "testing")
            check_testing
            ;;
        "quality")
            check_quality
            ;;
        *)
            log_error "Unknown check function for: $check_name"
            return 1
            ;;
    esac
}

# Main execution
main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    # Convert exported variables back to arrays
    IFS=' ' read -ra checks_to_run <<< "$CHECKS_TO_RUN"
    local summary_mode="$SUMMARY_MODE"
    local detailed_mode="$DETAILED_MODE"
    local quick_mode="$QUICK_MODE"
    local force_all_tests="$FORCE_ALL_TESTS"
    local streaming_mode="$STREAMING_MODE"
    
    # Initialize session tracking
    local session_id
    if session_id=$("$SCRIPT_DIR/health-check/session-tracker.sh" start 2>/dev/null); then
        export HEALTH_CHECK_SESSION_ID="$session_id"
    fi
    
    # Initialize
    start_timer
    
    if [[ "$summary_mode" != "true" ]]; then
        echo -e "${BLUE}🏥 Code Health Assessment${NC}"
        echo -e "${CYAN}Comprehensive codebase quality analysis${NC}"
        if [[ "$streaming_mode" == "true" ]]; then
            echo -e "${CYAN}Real-time streaming mode enabled${NC}\n"
        else
            echo -e "${CYAN}Buffered output mode${NC}\n"
        fi
    fi
    
    # Run selected health checks
    for check in "${checks_to_run[@]}"; do
        # Track segment start
        "$SCRIPT_DIR/health-check/session-tracker.sh" start-segment "$check" 2>/dev/null || true
        
        if [[ "$summary_mode" != "true" ]]; then
            run_health_check "$check" "$streaming_mode" || true
        else
            # In summary mode, capture output and only show summaries
            run_health_check "$check" "false" 2>/dev/null || true
        fi
        
        # Track segment end
        "$SCRIPT_DIR/health-check/session-tracker.sh" end-segment "$check" 2>/dev/null || true
    done
    
    # Show results
    if [[ "$summary_mode" != "true" ]]; then
        # In non-summary mode, always show the summary section
        echo -e "\n${BLUE}=== Health Summary ===${NC}\n"
        print_summaries
        end_timer
        print_overall_status
    else
        # Summary mode - just print the summaries without headers
        print_summaries
    fi
    
    # End session tracking with exit code
    local exit_code=$(get_exit_code)
    "$SCRIPT_DIR/health-check/session-tracker.sh" end "$exit_code" 2>/dev/null || true
    
    # Exit with appropriate code
    exit $exit_code
}

# Run main function with all arguments
main "$@"
