#!/bin/bash

# Testing Health Check Module
# Checks unit tests, contract tests, and code coverage

set -euo pipefail

# Individual testing check functions
check_unit_tests() {
    local test_output
    local cmd="pnpm test:ci"
    start_section_timer
    if test_output=$(eval $cmd 2>&1); then
        local duration=$(get_section_duration)
        local message="All unit tests passing"
        print_check_result "success" "$message" "$cmd" "$duration"
        
        # Show details in detailed mode
        if [[ "${DETAILED_MODE:-false}" == "true" ]]; then
            local test_count=$(echo "$test_output" | grep -E "Tests\s+[0-9]+" | head -1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo "0")
            local file_count=$(echo "$test_output" | grep -E "Test Files\s+[0-9]+" | head -1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo "0")
            if [[ $test_count -gt 0 ]]; then
                printf "     ${CYAN}ℹ️  Details: $test_count tests in $file_count files${NC}\n"
            fi
        fi
        return 0
    else
        # Check if it's a "no tests found" scenario
        if echo "$test_output" | grep -q "No test files found"; then
            print_check_result "warning" "No test files found" "pnpm test --watch"
            return 1  # Warning
        elif echo "$test_output" | grep -q "::error"; then
            # Count GitHub Actions error annotations
            local error_count
            error_count=$(echo "$test_output" | grep -c "::error" || echo "0")
            print_check_result "error" "$error_count test failures detected" "pnpm test"
            return 2  # Error
        else
            print_check_result "error" "Test run failed" "pnpm test"
            return 2  # Error
        fi
    fi
}

check_contract_tests() {
    # Skip in quick mode
    if [[ "${QUICK_MODE:-false}" == "true" ]]; then
        print_check_result "info" "Contract tests skipped (quick mode)" ""
        return 0
    fi
    
    # Check if we should run expensive tests (every 5th successful session)
    local should_run_expensive="true"
    
    # If force-all-tests flag is set, always run
    if [[ "${FORCE_ALL_TESTS:-false}" == "true" ]]; then
        should_run_expensive="true"
    elif "$SCRIPT_DIR/session-tracker.sh" should-run-expensive 2>/dev/null; then
        should_run_expensive="true"
    else
        should_run_expensive="false"
    fi
    
    # Skip expensive tests if not needed
    if [[ "$should_run_expensive" == "false" ]]; then
        print_check_result "info" "Contract tests skipped (session optimization)" ""
        return 0
    fi
    
    if find src/contract -name "*.spec.*" -type f 2>/dev/null | grep -q .; then
        # Run contract tests using dedicated config (no coverage)
        local test_output
        local cmd="pnpm test:contract"
        start_section_timer
        if test_output=$(eval $cmd 2>&1); then
            local duration=$(get_section_duration)
            local message="All contract tests passing"
            print_check_result "success" "$message" "$cmd" "$duration"
            
            # Show details in detailed mode
            if [[ "${DETAILED_MODE:-false}" == "true" ]]; then
                local test_count=$(echo "$test_output" | grep -E "Tests\s+[0-9]+" | head -1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo "0")
                local file_count=$(echo "$test_output" | grep -E "Test Files\s+[0-9]+" | head -1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo "0")
                if [[ $test_count -gt 0 ]]; then
                    printf "     ${CYAN}ℹ️  Details: $test_count tests in $file_count files${NC}\n"
                fi
            fi
            return 0
        else
            local duration=$(get_section_duration)
            print_check_result "error" "Contract tests failing" "$cmd" "$duration"
            return 2  # Error
        fi
    else
        print_check_result "info" "No contract tests found" ""
        return 0  # No tests is not an error
    fi
}

check_code_coverage() {
    local cmd=""
    if [[ -f "etc/reports/coverage/coverage-summary.json" ]]; then
        local coverage_pct
        if command -v jq >/dev/null 2>&1; then
            coverage_pct=$(jq -r '.total.lines.pct' etc/reports/coverage/coverage-summary.json 2>/dev/null || echo "0")
            if [[ "$coverage_pct" != "null" && "$coverage_pct" != "0" ]]; then
                local signal=$(get_coverage_signal "$coverage_pct")
                cmd="pnpm test:coverage"
                if [[ ${coverage_pct%.*} -ge 80 ]]; then
                    print_check_result "success" "${coverage_pct}% coverage ($signal)" "$cmd"
                    return 0
                elif [[ ${coverage_pct%.*} -ge 60 ]]; then
                    print_check_result "warning" "${coverage_pct}% coverage ($signal)" "$cmd"
                    return 1
                else
                    print_check_result "warning" "${coverage_pct}% coverage ($signal)" "$cmd"
                    return 1
                fi
            else
                print_check_result "warning" "No coverage data available" "pnpm test:coverage:ci"
                return 1  # Warning
            fi
        else
            print_check_result "warning" "jq command not found - cannot parse coverage" "brew install jq"
            return 1  # Warning
        fi
    else
        print_check_result "warning" "No coverage data available" "pnpm test:coverage:ci"
        return 1  # Warning
    fi
}

check_testing() {
    print_section_header "Testing Health"
    
    local test_status="success"
    local summary_parts=()
    local guidance=""
    
    # Run individual checks
    check_unit_tests
    local unit_exit=$?
    
    check_contract_tests
    local contract_exit=$?
    
    check_code_coverage
    local coverage_exit=$?
    
    # Build summary and determine status
    if [[ $unit_exit -eq 0 ]]; then
        summary_parts+=("✅ Unit tests passing")
    elif [[ $unit_exit -eq 1 ]]; then
        summary_parts+=("⚠️ Unit test warnings")
        test_status="warning"
    else
        summary_parts+=("❌ Unit tests failing")
        test_status="error"
        guidance="Fix failing tests immediately - they indicate broken functionality. "
    fi
    
    if [[ $contract_exit -eq 0 ]]; then
        summary_parts+=("✅ Contract tests passing")
    elif [[ $contract_exit -eq 1 ]]; then
        summary_parts+=("⚠️ Contract test warnings")
        [[ "$test_status" == "success" ]] && test_status="warning"
    else
        summary_parts+=("❌ Contract tests failing")
        test_status="error"
        guidance+="Fix contract test failures - they indicate broken CLI behavior. "
    fi
    
    # Handle coverage with specific guidance
    if [[ $coverage_exit -eq 0 ]]; then
        summary_parts+=("✅ Good coverage")
    else
        summary_parts+=("⚠️ Coverage needs attention")
        [[ "$test_status" == "success" ]] && test_status="warning"
        local coverage_pct=$(jq -r '.total.lines.pct' etc/reports/coverage/coverage-summary.json 2>/dev/null || echo "0")
        guidance+="$(get_coverage_guidance "$coverage_pct")"
    fi
    
    # Update overall status
    case "$test_status" in
        "error") update_overall_status "❌" ;;
        "warning") update_overall_status "⚠️" ;;
    esac
    
    # Print section summary
    print_section_summary "Testing" "$test_status" "" "$guidance"
    
    # Collect emojis for overall summary
    local emoji_summary=""
    if [[ $unit_exit -eq 0 ]]; then
        emoji_summary+="✅"
    elif [[ $unit_exit -eq 1 ]]; then
        emoji_summary+="⚠️"
    else
        emoji_summary+="❌"
    fi
    
    if [[ $contract_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    elif [[ $contract_exit -eq 1 ]]; then
        emoji_summary+=" ⚠️"
    else
        emoji_summary+=" ❌"
    fi
    
    if [[ $coverage_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    elif [[ $coverage_exit -eq 1 ]]; then
        emoji_summary+=" ⚠️"
    else
        emoji_summary+=" ❌"
    fi
    
    add_section_emojis "Testing" "$emoji_summary"
}

# Run check if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Source common utilities
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "$SCRIPT_DIR/common.sh"
    
    check_testing
fi
