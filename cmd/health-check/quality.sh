#!/bin/bash

# Code Quality Health Check Module
# Checks type compilation, build process, linting, file complexity, annotations, and dead code

set -euo pipefail

# Individual quality check functions
check_type_compilation() {
    local cmd="pnpm type-check"
    start_section_timer
    if pnpm type-check >/dev/null 2>&1; then
        local duration=$(get_section_duration)
        print_check_result "success" "TypeScript compilation successful" "$cmd" "$duration"
        return 0
    else
        local duration=$(get_section_duration)
        print_check_result "critical" "TypeScript compilation failed" "$cmd" "$duration"
        return 3  # Critical
    fi
}

check_build_process() {
    local cmd="pnpm build"
    start_section_timer
    if pnpm build >/dev/null 2>&1; then
        local duration=$(get_section_duration)
        print_check_result "success" "Build process successful" "$cmd" "$duration"
        return 0
    else
        local duration=$(get_section_duration)
        print_check_result "critical" "Build process failed" "$cmd" "$duration"
        return 3  # Critical
    fi
}

check_linting() {
    local cmd="pnpm lint:ci"
    start_section_timer
    local lint_output
    if lint_output=$(pnpm lint:ci 2>&1); then
        local duration=$(get_section_duration)
        # Check for warnings even on success  
        local warning_count
        warning_count=$(echo "$lint_output" | grep -c "warning" 2>/dev/null || echo "0")
        warning_count=$(echo "$warning_count" | tr -d '[:space:]')  # Remove any whitespace/newlines
        if [[ ${warning_count:-0} -gt 0 ]]; then
            print_check_result "warning" "$warning_count linting warnings found" "pnpm lint:fix" "$duration"
            return 1  # Warning
        else
            print_check_result "success" "No linting errors" "$cmd" "$duration"
            return 0
        fi
    else
        local duration=$(get_section_duration)
        # Try to count errors/warnings
        lint_output=$(pnpm lint:ci 2>&1 || true)
        local error_count=$(echo "$lint_output" | grep -c "error" 2>/dev/null || echo "0")
        local warning_count=$(echo "$lint_output" | grep -c "warning" 2>/dev/null || echo "0")
        local total=$((error_count + warning_count))
        
        if [[ $total -gt 0 ]]; then
            print_check_result "warning" "$total linting issues ($error_count errors, $warning_count warnings)" "pnpm lint:fix" "$duration"
        else
            print_check_result "warning" "Linting issues detected" "pnpm lint" "$duration"
        fi
        return 1  # Warning
    fi
}

check_file_complexity() {
    local cmd="./cmd/analyze-file-complexity.sh"
    if [[ -f "cmd/analyze-file-complexity.sh" ]]; then
        local complexity_output
        start_section_timer
        if complexity_output=$(./cmd/analyze-file-complexity.sh --summary --no-color 2>/dev/null); then
            local duration=$(get_section_duration)
            local sanitized_output="$complexity_output"

            # Check if any files are outside the GOOD range
            if echo "$sanitized_output" | grep -q "\[SEVERE\]"; then
                print_check_result "error" "Files exceed LLM-friendly limits" "$cmd" "$duration"
                return 2  # Error
            elif echo "$sanitized_output" | grep -q "\[BAD\]"; then
                print_check_result "warning" "Some files significantly exceed size limits" "$cmd" "$duration"
                return 1  # Warning
            elif echo "$sanitized_output" | grep -Eq "\[WARN"; then
                print_check_result "warning" "Some files are approaching size limits" "$cmd" "$duration"
                return 1  # Warning
            else
                print_check_result "success" "All files within optimal size limits" "$cmd" "$duration"
                return 0
            fi
        else
            local duration=$(get_section_duration)
            print_check_result "warning" "File complexity analysis failed" "$cmd" "$duration"
            return 1  # Warning
        fi
    else
        print_check_result "warning" "File complexity analyzer not found" "$cmd"
        return 1  # Warning
    fi
}

check_code_annotations() {
    local cmd="./cmd/filter-ignored-annotations.sh"
    start_section_timer
    local todo_count deprecated_count fixme_count hack_count
    # Use filtered annotation counting to respect ignore directives
    todo_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh TODO src/ 2>/dev/null || echo "0")
    deprecated_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh DEPRECATED src/ 2>/dev/null || echo "0")
    fixme_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh FIXME src/ 2>/dev/null || echo "0")
    hack_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh HACK src/ 2>/dev/null || echo "0")
    
    local duration=$(get_section_duration)
    # Ensure we have valid numbers
    todo_count=${todo_count:-0}
    deprecated_count=${deprecated_count:-0}
    fixme_count=${fixme_count:-0}
    hack_count=${hack_count:-0}
    
    local total_annotations=$((todo_count + deprecated_count + fixme_count + hack_count))
    
    if [[ "$total_annotations" -eq 0 ]]; then
        print_check_result "success" "No code annotations found" "$cmd" "$duration"
        return 0
    elif [[ "$deprecated_count" -gt 0 || "$fixme_count" -gt 0 || "$hack_count" -gt 0 ]]; then
        print_check_result "warning" "$total_annotations annotations (TODO: $todo_count, DEPRECATED: $deprecated_count, FIXME: $fixme_count, HACK: $hack_count)" "$cmd" "$duration"
        return 1  # Warning
    else
        print_check_result "info" "$total_annotations TODO annotations found" "$cmd" "$duration"
        return 0
    fi
}

check_dead_code() {
    local cmd="pnpm knip"
    if command -v pnpm >/dev/null 2>&1; then
        local pnpm_knip_cmd="pnpm knip --include exports,types,nsExports,nsTypes"
        local knip_output
        start_section_timer
        if knip_output=$(${pnpm_knip_cmd} --no-exit-code 2>&1); then
            local duration=$(get_section_duration)
            # Count different types of issues
            local unused_files unused_exports unused_types
            unused_files=$(echo "$knip_output" | grep -c "Unused files" 2>/dev/null || echo "0")
            unused_exports=$(echo "$knip_output" | grep -c "Unused exports" 2>/dev/null || echo "0")
            unused_types=$(echo "$knip_output" | grep -c "Unused exported types" 2>/dev/null || echo "0")
            
            # Count actual issues by parsing the text output more accurately
            local total_issues=0
            
            # Extract numbers from section headers like "Unused exported types (8)"
            local exports_num=$(echo "$knip_output" | grep "^Unused exports (" | sed 's/.*(\([0-9]*\)).*/\1/' 2>/dev/null)
            if [[ "$exports_num" =~ ^[0-9]+$ ]]; then
                total_issues=$((total_issues + exports_num))
            fi
            
            local types_num=$(echo "$knip_output" | grep "^Unused exported types (" | sed 's/.*(\([0-9]*\)).*/\1/' 2>/dev/null)
            if [[ "$types_num" =~ ^[0-9]+$ ]]; then
                total_issues=$((total_issues + types_num))
            fi
            
            local hints_num=$(echo "$knip_output" | grep "^Configuration hints (" | sed 's/.*(\([0-9]*\)).*/\1/' 2>/dev/null)
            if [[ "$hints_num" =~ ^[0-9]+$ ]]; then
                total_issues=$((total_issues + hints_num))
            fi
            
            if [[ "$total_issues" -gt 20 ]]; then
                print_check_result "error" "${total_issues} dead code issues detected" "$cmd" "$duration"
                return 2  # Error
            elif [[ "$total_issues" -gt 5 ]]; then
                print_check_result "warning" "${total_issues} dead code issues detected" "$cmd" "$duration"
                return 1  # Warning
            elif [[ "$total_issues" -gt 0 ]]; then
                print_check_result "info" "${total_issues} minor dead code issues" "$cmd" "$duration"
                return 0
            else
                print_check_result "success" "No significant dead code detected" "$cmd" "$duration"
                return 0
            fi
        else
            local duration=$(get_section_duration)
            return 1  # Warning
        fi
    else
        print_check_result "warning" "pnpm not found - cannot run dead code analysis" "npm install -g pnpm"
        return 1  # Warning
    fi
}

check_quality() {
    print_section_header "Code Quality Health"
    
    local quality_status="success"
    local summary_parts=()
    local guidance=""
    
    # Run individual checks
    check_type_compilation
    local compile_exit=$?
    
    check_build_process
    local build_exit=$?
    
    check_linting
    local lint_exit=$?
    
    check_file_complexity
    local complexity_exit=$?
    
    check_code_annotations
    local annotations_exit=$?
    
    check_dead_code
    local dead_code_exit=$?
    
    # Build summary and determine status
    if [[ $compile_exit -eq 3 ]]; then
        summary_parts+=("🔥 TypeScript compilation failed")
        quality_status="critical"
        guidance="CRITICAL: Fix TypeScript compilation errors immediately - nothing else works without a successful build. "
    elif [[ $compile_exit -eq 0 ]]; then
        summary_parts+=("✅ TypeScript compilation passed")
    fi
    
    if [[ $build_exit -eq 3 ]]; then
        summary_parts+=("🔥 Build failed")
        quality_status="critical"
        guidance+="CRITICAL: Fix build failures immediately - deployment is blocked. "
    elif [[ $build_exit -eq 0 ]]; then
        summary_parts+=("✅ Build successful")
    fi
    
    if [[ $lint_exit -eq 0 ]]; then
        summary_parts+=("✅ No linting errors")
    else
        summary_parts+=("⚠️ Linting issues")
        [[ "$quality_status" == "success" ]] && quality_status="warning"
        guidance+="Address linting issues to maintain code quality standards. "
    fi
    
    if [[ $complexity_exit -eq 2 ]]; then
        summary_parts+=("❌ Files exceed LLM limits")
        [[ "$quality_status" != "critical" ]] && quality_status="error"
        guidance+="Refactor large files (>350 lines) to improve LLM compatibility and maintainability. "
    elif [[ $complexity_exit -eq 1 ]]; then
        summary_parts+=("⚠️ Files approaching size limits")
        [[ "$quality_status" == "success" ]] && quality_status="warning"
        guidance+="Monitor file sizes and consider refactoring before they exceed limits. "
    elif [[ $complexity_exit -eq 0 ]]; then
        summary_parts+=("✅ All files optimal size")
    fi
    
    # Handle annotations
    if [[ $annotations_exit -eq 0 ]]; then
        local filtered_todo_count
        filtered_todo_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh TODO src/ 2>/dev/null || echo "0")
        if [[ "$filtered_todo_count" -gt 0 ]]; then
            summary_parts+=("ℹ️ ${filtered_todo_count} TODO annotations")
            guidance+="$(get_todo_guidance "$filtered_todo_count") "
        else
            summary_parts+=("✅ No annotations")
        fi
    else
        summary_parts+=("⚠️ Code annotations need attention")
        [[ "$quality_status" == "success" ]] && quality_status="warning"
        guidance+="Review and address FIXME, HACK, and DEPRECATED annotations. "
    fi
    
    # Handle dead code
    if [[ $dead_code_exit -eq 2 ]]; then
        summary_parts+=("❌ Significant dead code")
        [[ "$quality_status" != "critical" ]] && quality_status="error"
        local issues=$(pnpm knip --reporter json 2>/dev/null | jq -r '.issues | length' 2>/dev/null | head -1 | tr -d '\n\r' || echo "0")
        if ! [[ "$issues" =~ ^[0-9]+$ ]]; then
            issues="0"
        fi
        guidance+="$(get_dead_code_guidance "${issues:-0}") "
    elif [[ $dead_code_exit -eq 1 ]]; then
        summary_parts+=("⚠️ Some dead code detected")
        [[ "$quality_status" == "success" ]] && quality_status="warning"
        local issues=$(pnpm knip --reporter json 2>/dev/null | jq -r '.issues | length' 2>/dev/null | head -1 | tr -d '\n\r' || echo "0")
        if ! [[ "$issues" =~ ^[0-9]+$ ]]; then
            issues="0"
        fi
        guidance+="$(get_dead_code_guidance "${issues:-0}") "
    elif [[ $dead_code_exit -eq 0 ]]; then
        summary_parts+=("✅ Clean codebase")
    fi
    
    # Update overall status
    case "$quality_status" in
        "critical") update_overall_status "🔥" ;;
        "error") update_overall_status "❌" ;;
        "warning") update_overall_status "⚠️" ;;
    esac
    
    # Print section summary
    print_section_summary "Code Quality" "$quality_status" "" "$guidance"
    
    # Collect emojis for overall summary
    local emoji_summary=""
    if [[ $compile_exit -eq 3 ]]; then
        emoji_summary+="🔥"
    elif [[ $compile_exit -eq 0 ]]; then
        emoji_summary+="✅"
    fi
    
    if [[ $build_exit -eq 3 ]]; then
        emoji_summary+=" 🔥"
    elif [[ $build_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    fi
    
    if [[ $lint_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    else
        emoji_summary+=" ⚠️"
    fi
    
    if [[ $complexity_exit -eq 2 ]]; then
        emoji_summary+=" ❌"
    elif [[ $complexity_exit -eq 1 ]]; then
        emoji_summary+=" ⚠️"
    elif [[ $complexity_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    else
        emoji_summary+=" ⚠️"
    fi
    
    if [[ $annotations_exit -eq 0 ]]; then
        local filtered_todo_count
        filtered_todo_count=$(FILTER_COUNT_ONLY=1 ./cmd/filter-ignored-annotations.sh TODO src/ 2>/dev/null || echo "0")
        if [[ "$filtered_todo_count" -gt 0 ]]; then
            emoji_summary+=" ℹ️"
        else
            emoji_summary+=" ✅"
        fi
    else
        emoji_summary+=" ⚠️"
    fi
    
    if [[ $dead_code_exit -eq 2 ]]; then
        emoji_summary+=" ❌"
    elif [[ $dead_code_exit -eq 1 ]]; then
        emoji_summary+=" ⚠️"
    elif [[ $dead_code_exit -eq 0 ]]; then
        emoji_summary+=" ✅"
    else
        emoji_summary+=" ⚠️"
    fi
    
    add_section_emojis "Quality" "$emoji_summary"
}

# Run check if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Source common utilities
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "$SCRIPT_DIR/common.sh"
    
    check_quality
fi
