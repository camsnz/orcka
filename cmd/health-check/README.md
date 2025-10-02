# Modular Health Check System

This directory contains the modular health check system for comprehensive codebase assessment.

## Architecture

The health check system is built with a modular architecture where each type of check is implemented as a separate, focused module:

```
cmd/
├── health-check.sh              # Main orchestrator script
├── health-check-common.sh       # Shared utilities and functions
└── health-check/
    ├── dependencies.sh          # Package management and security
    ├── testing.sh              # Test execution and coverage
    ├── quality.sh              # Code quality and standards
    └── README.md               # This file
```

## Available Modules

### 1. Dependencies (`dependencies.sh`)
- **Package Installation**: Verifies dependencies are properly installed
- **Security Audit**: Checks for known vulnerabilities using `pnpm audit`
- **Outdated Packages**: Identifies packages that need updates
- **Exit Codes**: 0=clean, 1=warnings, 2=vulnerabilities

### 2. Testing (`testing.sh`)
- **Unit Tests**: Runs test suite and reports failures
- **E2E Tests**: Executes end-to-end tests if available
- **Code Coverage**: Analyzes test coverage metrics
- **Exit Codes**: 0=all passing, 1=warnings, 2=failures

### 3. Quality (`quality.sh`)
- **Type Checking**: TypeScript compilation validation
- **Build Process**: Verifies successful build
- **Linting**: Code style and quality checks
- **File Complexity**: Monitors file sizes for LLM-friendliness
- **Code Annotations**: Scans for TODO, DEPRECATED, FIXME, HACK comments
- **Dead Code Analysis**: Uses Knip for unused code detection
- **Exit Codes**: 0=excellent, 1=warnings, 2=issues, 3=critical

## Usage Examples

### Basic Usage
```bash
# Run all health checks
./cmd/health-check.sh

# Run specific checks only
./cmd/health-check.sh --only quality
./cmd/health-check.sh --only dependencies,testing

# Show help
./cmd/health-check.sh --help
```

### Task Integration
```bash
# Via Taskfile.yml
task health              # All checks
task health:quality      # Quality only
task health:deps         # Dependencies only
task health:test         # Testing only
task health:summary      # Summary output (LLM-friendly)
task health:help         # Show help
```

### Advanced Usage
```bash
# Multiple specific checks
./cmd/health-check.sh dependencies quality

# Summary mode for CI/scripts
./cmd/health-check.sh --summary

# Real-time streaming output (default)
./cmd/health-check.sh --streaming

# Buffered output (wait for all checks to complete)
./cmd/health-check.sh --buffered

# List available checks
./cmd/health-check.sh --list
```

## Output Modes

The health check system supports three output modes:

### 1. Streaming Mode (Default)
- **Real-time output**: Results appear as each individual check completes
- **Interactive feedback**: See progress as checks run
- **Best for**: Development and interactive use
- **Usage**: `./cmd/health-check.sh` or `./cmd/health-check.sh --streaming`

### 2. Buffered Mode
- **Batch output**: Results appear only after entire module completes
- **Traditional behavior**: Similar to original implementation
- **Best for**: Scripts that need complete module results
- **Usage**: `./cmd/health-check.sh --buffered`

### 3. Summary Mode
- **Concise output**: Only final summaries, no detailed logs
- **LLM-friendly**: Structured format for AI parsing
- **Best for**: CI/CD, automated analysis, LLM consumption
- **Usage**: `./cmd/health-check.sh --summary`

## Exit Codes

The system uses a hierarchical exit code system:

- **0**: Excellent health (all checks passed)
- **1**: Needs attention (warnings detected)
- **2**: Issues detected (errors found)
- **3**: Critical issues (build/compile failures)

## Adding New Modules

To add a new health check module:

1. **Create Module File**: `cmd/health-check/newcheck.sh`
2. **Follow Template**:
   ```bash
   #!/bin/bash
   set -euo pipefail
   
   # Source common utilities
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/../health-check-common.sh"
   
   check_newcheck() {
       log_section "New Check Health"
       
       # Your check logic here
       local status="✅"
       local result="✅ check passed"
       
       # Update overall status if needed
       update_overall_status "$status"
       
       # Return summary
       echo "NewCheck: $status $result"
   }
   
   # Run check if called directly
   if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
       check_newcheck
   fi
   ```

3. **Update Main Script**: Add to `AVAILABLE_CHECKS` array in `health-check.sh`
4. **Update Documentation**: Add to help text and this README

## Common Utilities

The `health-check-common.sh` file provides shared functionality:

### Logging Functions
- `log_info()` - Information messages
- `log_success()` - Success messages (green)
- `log_warning()` - Warning messages (yellow)
- `log_error()` - Error messages (red)
- `log_critical()` - Critical messages (red with fire emoji)
- `log_section()` - Section headers (blue)

### Status Management
- `update_overall_status()` - Updates global health status
- `get_exit_code()` - Returns appropriate exit code
- `print_overall_status()` - Shows final health assessment

### Summary Collection
- `add_summary()` - Adds a summary line
- `print_summaries()` - Displays all collected summaries

### Timing
- `start_timer()` - Begins timing assessment
- `end_timer()` - Shows elapsed time

## Integration with Development Workflow

The modular health check system integrates with the AGENTS.md development guidelines:

1. **Build Validation**: Run `task health` before completing work blocks
2. **Issue Resolution Priority**: Follows the established priority order
3. **LLM-Friendly**: Summary mode provides concise output for AI assistants
4. **Modular Design**: Each check has single responsibility
5. **Test Coverage**: Each module can be tested independently

## Benefits

### For Developers
- **Fast Feedback**: Run only the checks you need
- **Clear Output**: Structured, color-coded results
- **Flexible Usage**: Command-line options for different workflows
- **Comprehensive Coverage**: All aspects of code health

### For CI/CD
- **Appropriate Exit Codes**: Proper failure signaling
- **Summary Mode**: Concise output for logs
- **Modular Execution**: Run subsets based on change types
- **Performance**: Skip unnecessary checks

### For LLMs/AI
- **Structured Output**: Consistent format for parsing
- **Summary Mode**: Condensed information
- **Clear Status Indicators**: Easy to interpret results
- **Actionable Information**: Specific issue counts and types

This modular architecture provides a robust foundation for maintaining code quality while remaining flexible and maintainable.
