#!/bin/bash

# Build Script
# Builds the orcka binary from checked out source

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment from bootstrap
if [[ -f "$SCRIPT_DIR/release.env" ]]; then
    source "$SCRIPT_DIR/release.env"
else
    echo "Error: release.env not found. Must run via make-release.sh" >&2
    exit 1
fi

echo "╭─────────────────────────────────────────╮"
echo "│  Build Binary                           │"
echo "╰─────────────────────────────────────────╯"
echo ""

cd "$PROJECT_ROOT"

# 1. Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    if ! command -v pnpm &> /dev/null; then
        echo "Error: pnpm not found. Please install pnpm." >&2
        exit 1
    fi
    
    pnpm install --frozen-lockfile
    
    echo "   ✅ Dependencies installed"
}

# 2. Run build
build_binary() {
    echo ""
    echo "🔨 Building binary..."
    
    # Clean previous builds
    rm -rf bin/
    
    # Run build
    pnpm run build
    
    # Verify binary was created
    if [[ ! -f "bin/orcka.cjs" ]]; then
        echo "Error: Binary not found at bin/orcka.cjs" >&2
        exit 1
    fi
    
    # Check if executable
    if [[ ! -x "bin/orcka.cjs" ]]; then
        echo "Error: Binary is not executable" >&2
        exit 1
    fi
    
    local size=$(du -h bin/orcka.cjs | cut -f1)
    echo "   ✅ Binary built: bin/orcka.cjs ($size)"
}

# 3. Verify binary works
verify_binary() {
    echo ""
    echo "🧪 Verifying binary..."
    
    # Test that it runs
    if ! ./bin/orcka.cjs --version &> /dev/null; then
        echo "Error: Binary failed to execute" >&2
        exit 1
    fi
    
    echo "   ✅ Binary verified"
}

# Main build workflow
main() {
    local start_time=$(date +%s)
    
    install_dependencies
    build_binary
    verify_binary
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "✅ Build complete in ${duration}s"
    echo "   Binary: $PROJECT_ROOT/bin/orcka.cjs"
}

# CLI handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

