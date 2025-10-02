#!/bin/bash

# Session Tracker Wrapper
# Provides easy access to health check session tracking

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TRACKER_SCRIPT="$SCRIPT_DIR/session-tracker.ts"

# Change to project root to ensure pnpm can find node_modules
cd "$PROJECT_ROOT"

# Try to run using available TypeScript runners
if command -v pnpm &> /dev/null; then
    # Use tsx from pnpm (preferred - fastest and most reliable)
    pnpm exec tsx "$TRACKER_SCRIPT" "$@" 2>/dev/null || true
else
    # No pnpm available - skip session tracking gracefully
    :
fi

