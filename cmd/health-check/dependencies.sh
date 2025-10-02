#!/bin/bash

# Dependencies Health Check Module
# Checks package installation, security audit, and outdated packages

set -euo pipefail

# Individual dependency check functions
check_dependency_installation() {
    local cmd="pnpm install --frozen-lockfile"
    start_section_timer
    if pnpm install --frozen-lockfile >/dev/null 2>&1; then
        local duration=$(get_section_duration)
        print_check_result "success" "Dependencies installed successfully" "$cmd" "$duration"
        return 0
    else
        local duration=$(get_section_duration)
        print_check_result "critical" "Dependency installation failed" "pnpm install" "$duration"
        return 3  # Critical
    fi
}

check_security_audit() {
    local audit_output
    local cmd="pnpm audit"
    start_section_timer
    if audit_output=$(pnpm audit --audit-level moderate 2>&1); then
        local duration=$(get_section_duration)
        print_check_result "success" "No security vulnerabilities detected" "$cmd" "$duration"
        return 0
    else
        local duration=$(get_section_duration)
        if echo "$audit_output" | grep -q "found 0 vulnerabilities"; then
            print_check_result "success" "No security vulnerabilities detected" "$cmd" "$duration"
            return 0
        else
            local vuln_count
            vuln_count=$(echo "$audit_output" | grep -o "[0-9]* vulnerabilities" | head -1 | cut -d' ' -f1 || echo "unknown")
            print_check_result "critical" "$vuln_count security vulnerabilities found" "pnpm audit --fix" "$duration"
            return 3  # Critical
        fi
    fi
}

check_outdated_packages() {
    local outdated_count
    local cmd="pnpm outdated"
    start_section_timer
    if outdated_count=$(pnpm outdated --json 2>/dev/null | jq '. | length' 2>/dev/null); then
        local duration=$(get_section_duration)
        if [[ "$outdated_count" -gt 0 ]]; then
            print_check_result "warning" "$outdated_count packages are outdated" "pnpm update" "$duration"
            return 1  # Warning
        else
            print_check_result "success" "All packages are up-to-date" "$cmd" "$duration"
            return 0
        fi
    else
        local duration=$(get_section_duration)
        print_check_result "warning" "Outdated package check failed" "$cmd" "$duration"
        return 1  # Warning
    fi
}

check_dependencies() {
    print_section_header "Dependencies Health"
    
    local deps_status="success"
    local summary_parts=()
    local guidance=""
    
    # Run individual checks
    check_dependency_installation
    local install_exit=$?
    
    check_security_audit
    local audit_exit=$?
    
    check_outdated_packages
    local outdated_exit=$?
    
    # Build summary and determine status
    if [[ $install_exit -eq 3 ]]; then
        summary_parts+=("🔥 Dependency installation failed")
        deps_status="critical"
        guidance="CRITICAL: Fix dependency installation issues immediately. Check package.json and lockfile integrity. "
    elif [[ $install_exit -eq 0 ]]; then
        summary_parts+=("✅ Dependencies installed")
    fi
    
    if [[ $audit_exit -eq 3 ]]; then
        summary_parts+=("🔥 Security vulnerabilities found")
        deps_status="critical"
        guidance+="CRITICAL: Address security vulnerabilities immediately using 'pnpm audit --fix'. "
    elif [[ $audit_exit -eq 0 ]]; then
        summary_parts+=("✅ No security vulnerabilities")
    fi
    
    if [[ $outdated_exit -eq 0 ]]; then
        summary_parts+=("✅ All packages up-to-date")
    else
        summary_parts+=("⚠️ Some packages outdated")
        [[ "$deps_status" == "success" ]] && deps_status="warning"
        guidance+="Consider updating outdated packages to get latest features and security fixes. "
    fi
    
    # Update overall status
    case "$deps_status" in
        "critical") update_overall_status "🔥" ;;
        "warning") update_overall_status "⚠️" ;;
    esac
    
    # Print section summary
    print_section_summary "Dependencies" "$deps_status" "" "$guidance"
    
    # Collect emojis for overall summary
    local emoji_summary=""
    if [[ $install_exit -eq 3 ]]; then
        emoji_summary+="🔥"
    elif [[ $install_exit -eq 0 ]]; then
        emoji_summary+="✅"
    fi
    
    if [[ $audit_exit -eq 3 ]]; then
        emoji_summary+=" 🔥"
    elif [[ $audit_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    fi
    
    if [[ $outdated_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    else
        emoji_summary+=" ⚠️"
    fi
    
    add_section_emojis "Dependencies" "$emoji_summary"
}

# Run check if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Source common utilities
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "$SCRIPT_DIR/common.sh"
    
    check_dependencies
fi
