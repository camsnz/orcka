#!/bin/bash

# Knip-based Dead Code Analysis Script
# Modern replacement for the legacy analyze-dead-code.sh using Knip

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
OUTPUT_FORMAT="${1:-standard}" # standard, json, github
QUIET_MODE=false

if [[ "${2:-}" == "--quiet" ]] || [[ "${1:-}" == "--quiet" ]]; then
    QUIET_MODE=true
    OUTPUT_FORMAT="standard"
fi

# Function to format output based on chosen standard
format_output() {
    local category="$1"
    local count="$2"
    local items="$3"
    
    case "$OUTPUT_FORMAT" in
        "json")
            echo "\"$category\": { \"count\": $count, \"items\": [$items] }"
            ;;
        "github")
            if [[ $count -gt 0 ]]; then
                echo "::warning::$category: $count items found"
            fi
            ;;
        *)
            if [[ $count -gt 0 ]]; then
                if [[ "$category" == "Unused files" || "$category" == "Unused dependencies" ]]; then
                    echo -e "${RED}❌ $category: $count${NC}"
                elif [[ "$category" == "Unused exports" || "$category" == "Unused types" ]]; then
                    echo -e "${YELLOW}⚠️  $category: $count${NC}"
                else
                    echo -e "${CYAN}ℹ️  $category: $count${NC}"
                fi
            else
                echo -e "${GREEN}✅ $category: clean${NC}"
            fi
            ;;
    esac
}

# Function to run Knip analysis
run_knip_analysis() {
    local mode="$1"
    local temp_file="/tmp/knip_output_$$.txt"
    
    case "$mode" in
        "production")
            # Equivalent to unimported: dependencies and files only
            pnpm knip --production --dependencies --files > "$temp_file" 2>&1 || true
            ;;
        "dependencies")
            # Focus on dependency issues
            pnpm knip --dependencies --devDependencies > "$temp_file" 2>&1 || true
            ;;
        "exports")
            # Focus on unused exports and types
            pnpm knip --include exports,types,nsExports,nsTypes > "$temp_file" 2>&1 || true
            ;;
        "full")
            # Full analysis (default)
            pnpm knip > "$temp_file" 2>&1 || true
            ;;
    esac
    
    echo "$temp_file"
}

# Function to parse Knip output and extract counts
parse_knip_output() {
    local output_file="$1"
    
    if [[ ! -f "$output_file" ]]; then
        echo "0,0,0,0,0,0,0"
        return
    fi
    
    local unused_files=0
    local unused_deps=0
    local unused_devdeps=0
    local unlisted_deps=0
    local unlisted_bins=0
    local unused_exports=0
    local unused_types=0
    
    # Extract counts from the parentheses in the headers
    if grep -q "Unused files" "$output_file"; then
        unused_files=$(grep "Unused files" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unused dependencies" "$output_file"; then
        unused_deps=$(grep "Unused dependencies" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unused devDependencies" "$output_file"; then
        unused_devdeps=$(grep "Unused devDependencies" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unlisted dependencies" "$output_file"; then
        unlisted_deps=$(grep "Unlisted dependencies" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unlisted binaries" "$output_file"; then
        unlisted_bins=$(grep "Unlisted binaries" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unused exports" "$output_file"; then
        unused_exports=$(grep "Unused exports" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    if grep -q "Unused exported types" "$output_file"; then
        unused_types=$(grep "Unused exported types" "$output_file" | sed 's/.*(\([0-9]*\)).*/\1/' || echo "0")
    fi
    
    echo "$unused_files,$unused_deps,$unused_devdeps,$unlisted_deps,$unlisted_bins,$unused_exports,$unused_types"
}

# Function to calculate dead code ratio
calculate_dead_code_ratio() {
    local unused_files="$1"
    local unused_exports="$2"
    local unused_types="$3"
    
    # Get total files and exports for ratio calculation
    local total_files
    total_files=$(find src -name "*.ts" -not -name "*.spec.ts" -not -name "*.test.ts" | wc -l | tr -d ' ')
    
    # Estimate total exports (rough calculation)
    local total_exports
    total_exports=$(grep -r "^export " src/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
    
    local total_items=$((total_files + total_exports))
    local dead_items=$((unused_files + unused_exports + unused_types))
    
    if [[ $total_items -gt 0 ]]; then
        local ratio=$((dead_items * 100 / total_items))
        echo "$ratio"
    else
        echo "0"
    fi
}

# Main execution
main() {
    if [[ "$QUIET_MODE" == "false" ]]; then
        echo -e "${BLUE}🔬 Knip-based Dead Code Analysis${NC}"
        echo -e "${CYAN}Modern replacement for legacy dead code analysis${NC}\n"
    fi
    
    local start_time
    start_time=$(date +%s)
    
    # Run full Knip analysis
    local output_file
    output_file=$(run_knip_analysis "full")
    
    # Parse results
    IFS=',' read -r unused_files unused_deps unused_devdeps unlisted_deps unlisted_bins unused_exports unused_types <<< "$(parse_knip_output "$output_file")"
    
    # Calculate totals
    local total_dependency_issues=$((unused_deps + unused_devdeps + unlisted_deps + unlisted_bins))
    local total_code_issues=$((unused_files + unused_exports + unused_types))
    local total_issues=$((total_dependency_issues + total_code_issues))
    
    # Calculate dead code ratio
    local dead_code_ratio
    dead_code_ratio=$(calculate_dead_code_ratio "$unused_files" "$unused_exports" "$unused_types")
    
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        echo "{"
        format_output "unused_files" "$unused_files" ""
        echo ","
        format_output "unused_dependencies" "$unused_deps" ""
        echo ","
        format_output "unused_devDependencies" "$unused_devdeps" ""
        echo ","
        format_output "unlisted_dependencies" "$unlisted_deps" ""
        echo ","
        format_output "unlisted_binaries" "$unlisted_bins" ""
        echo ","
        format_output "unused_exports" "$unused_exports" ""
        echo ","
        format_output "unused_types" "$unused_types" ""
        echo ","
        echo "\"summary\": { \"total_issues\": $total_issues, \"dead_code_ratio\": $dead_code_ratio }"
        echo "}"
    else
        # Standard output format
        if [[ "$QUIET_MODE" == "false" ]]; then
            echo -e "${YELLOW}📊 Analysis Results:${NC}"
            format_output "Unused files" "$unused_files" ""
            format_output "Unused dependencies" "$unused_deps" ""
            format_output "Unused devDependencies" "$unused_devdeps" ""
            format_output "Unlisted dependencies" "$unlisted_deps" ""
            format_output "Unlisted binaries" "$unlisted_bins" ""
            format_output "Unused exports" "$unused_exports" ""
            format_output "Unused types" "$unused_types" ""
            
            echo -e "\n${BLUE}📈 Summary:${NC}"
            echo "📦 Dependency issues: $total_dependency_issues"
            echo "💻 Code issues: $total_code_issues"
            echo "📊 Total issues: $total_issues"
            echo "🧹 Dead code ratio: ${dead_code_ratio}%"
            
            if [[ "$total_issues" -gt 0 ]] && [[ "$QUIET_MODE" == "false" ]]; then
                echo -e "\n${CYAN}📋 Detailed Report:${NC}"
                head -50 "$output_file"
                if [[ $(wc -l < "$output_file") -gt 50 ]]; then
                    echo "... (truncated, see full output with 'pnpm knip')"
                fi
            fi
            
            local end_time duration
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            echo -e "\n${CYAN}Analysis completed in ${duration}s${NC}"
            
            echo -e "\n${BLUE}💡 Recommendations:${NC}"
            if [[ $unused_files -gt 0 ]]; then
                echo "1. 🗑️  Remove unused files (highest impact)"
            fi
            if [[ $unused_deps -gt 0 || $unused_devdeps -gt 0 ]]; then
                echo "2. 📦 Clean up unused dependencies"
            fi
            if [[ $unlisted_deps -gt 0 || $unlisted_bins -gt 0 ]]; then
                echo "3. 📝 Add missing dependencies to package.json"
            fi
            if [[ $unused_exports -gt 0 || $unused_types -gt 0 ]]; then
                echo "4. 🧹 Remove unused exports and types"
            fi
            
            echo -e "\n${YELLOW}⚠️  Commands to run:${NC}"
            echo "• Full analysis: ${CYAN}pnpm knip${NC}"
            echo "• Dependencies only: ${CYAN}pnpm knip --production --dependencies --files${NC}"
            echo "• Exports only: ${CYAN}pnpm knip --include exports,types${NC}"
            echo "• Fix automatically: ${CYAN}pnpm knip --fix${NC} (use with caution)"
        fi
        
        # Always output the summary line for health check integration
        echo "Dead code ratio: ${dead_code_ratio}%"
    fi
    
    # Cleanup
    rm -f "$output_file"
    
    # Exit with appropriate code based on severity
    if [[ $dead_code_ratio -gt 30 ]] || [[ $unused_files -gt 5 ]]; then
        exit 1  # Critical issues
    elif [[ $dead_code_ratio -gt 15 ]] || [[ $total_issues -gt 10 ]]; then
        exit 2  # Warning level
    else
        exit 0  # All good
    fi
}

# Handle command line arguments
case "${1:-full}" in
    "production"|"prod")
        output_file=$(run_knip_analysis "production")
        echo "Production mode analysis (dependencies and files only):"
        cat "$output_file"
        rm -f "$output_file"
        ;;
    "dependencies"|"deps")
        output_file=$(run_knip_analysis "dependencies")
        echo "Dependencies analysis:"
        cat "$output_file"
        rm -f "$output_file"
        ;;
    "exports")
        output_file=$(run_knip_analysis "exports")
        echo "Exports analysis:"
        cat "$output_file"
        rm -f "$output_file"
        ;;
    "json")
        OUTPUT_FORMAT="json"
        main
        ;;
    "github")
        OUTPUT_FORMAT="github"
        main
        ;;
    "--quiet")
        QUIET_MODE=true
        main
        ;;
    "full"|*)
        main
        ;;
esac
