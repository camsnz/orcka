#!/bin/bash

# Bootstrap Script
# Copies release scripts to isolated tmp directory and executes main release workflow
# This ensures the release process is immutable and can be audited

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Determine release directory based on script location
# First try local directory (for development)
if [[ -d "$SCRIPT_DIR/release" ]]; then
    RELEASE_DIR="$SCRIPT_DIR/release"
elif [[ -d "$PROJECT_ROOT/cmd/release" ]]; then
    RELEASE_DIR="$PROJECT_ROOT/cmd/release"
else
    echo "Error: Cannot find release directory" >&2
    exit 1
fi

# Check if we should use ci/release branch instead
USE_CI_RELEASE="${USE_CI_RELEASE:-true}"
RELEASE_BRANCH="${RELEASE_BRANCH:-ci/release}"

if [[ "$USE_CI_RELEASE" == "true" ]]; then
    echo "📡 Fetching release scripts from $RELEASE_BRANCH branch..."
    
    # Create temp directory for ci/release branch scripts
    CI_RELEASE_DIR="$PROJECT_ROOT/tmp/ci-release-$$"
    mkdir -p "$CI_RELEASE_DIR"
    
    cd "$PROJECT_ROOT"
    
    # Fetch the ci/release branch
    if git ls-remote --heads origin "$RELEASE_BRANCH" | grep -q "$RELEASE_BRANCH"; then
        # Export the release directory from ci/release branch
        git archive "origin/$RELEASE_BRANCH" cmd/release | tar -x -C "$CI_RELEASE_DIR"
        
        if [[ -d "$CI_RELEASE_DIR/cmd/release" ]]; then
            RELEASE_DIR="$CI_RELEASE_DIR/cmd/release"
            echo "✅ Using release scripts from $RELEASE_BRANCH branch"
        else
            echo "⚠️  Warning: ci/release branch exists but no cmd/release directory found"
            echo "   Falling back to local release scripts"
        fi
    else
        echo "⚠️  Warning: $RELEASE_BRANCH branch not found"
        echo "   Falling back to local release scripts"
    fi
    echo ""
fi

# Source version utilities (save PROJECT_ROOT first as it may be overwritten)
SAVED_PROJECT_ROOT="$PROJECT_ROOT"
source "$RELEASE_DIR/version-utils.sh"
PROJECT_ROOT="$SAVED_PROJECT_ROOT"

# Parse command line arguments
DRY_RUN=false
COMMIT=false
BUMP_TYPE="patch"

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    cat <<EOF
Orcka Release System

Usage: $0 <mode> [options]

Modes (required, mutually exclusive):
  --dry-run         Test release locally (creates dry_ tags, no remote push)
  --commit          Perform actual release (creates production tags, pushes to remote)

Options:
  --major           Bump major version (X.0.0)
  --minor           Bump minor version (x.Y.0)
  --patch           Bump patch version (x.y.Z) [default]

Environment Variables:
  RELEASE_TARGET    Git ref to build from (default: origin/main)
  RELEASE_BRANCH    Branch containing release scripts (default: ci/release)
  USE_CI_RELEASE    Use release scripts from RELEASE_BRANCH (default: true)
  KEEP_BOOTSTRAP    Keep tmp directory after completion (default: false)

Examples:
  $0 --dry-run                    # Test patch release locally
  $0 --commit                     # Release patch version
  $0 --commit --minor             # Release minor version
  $0 --dry-run --major            # Test major version bump
  RELEASE_TARGET=main $0 --commit # Release from main branch

For more information, see:
  cmd/release/QUICKSTART.md
  doc/RELEASE_SYSTEM.md
EOF
    exit 0
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --commit)
            COMMIT=true
            shift
            ;;
        --major)
            BUMP_TYPE="major"
            shift
            ;;
        --minor)
            BUMP_TYPE="minor"
            shift
            ;;
        --patch)
            BUMP_TYPE="patch"
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 <--dry-run|--commit> [--major|--minor|--patch]" >&2
            echo "Run '$0' without arguments for full usage information." >&2
            exit 1
            ;;
    esac
done

# Validate mode
if [[ "$DRY_RUN" == "true" && "$COMMIT" == "true" ]]; then
    echo "Error: --dry-run and --commit are mutually exclusive" >&2
    exit 1
fi

if [[ "$DRY_RUN" == "false" && "$COMMIT" == "false" ]]; then
    echo "Error: Must specify either --dry-run or --commit" >&2
    echo "Run '$0' without arguments for usage information." >&2
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes in your working directory."
    echo ""
    git status --short
    echo ""
    echo "The release process will checkout '$TARGET_REF', which may conflict with these changes."
    echo ""
    echo "Options:"
    echo "  1. Commit your changes:  git add -A && git commit -m 'your message'"
    echo "  2. Stash your changes:   git stash"
    echo "  3. Continue anyway (may fail)"
    echo ""
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Configuration
TARGET_REF="${RELEASE_TARGET:-origin/main}"
UNIX_TIME=$(date +%s)
RELEASE_DATETIME=$(get_current_datetime)

# Calculate next version
NEXT_VERSION=$(calculate_next_version "$BUMP_TYPE" "$DRY_RUN")
INTERNAL_VERSION=$(format_internal_version $(parse_version "$NEXT_VERSION"))
BINARY_TAG=$(format_binary_tag "$RELEASE_DATETIME" "$NEXT_VERSION" "$DRY_RUN")
SOURCE_TAG=$(format_source_tag "$RELEASE_DATETIME" "$NEXT_VERSION" "$DRY_RUN")

# Bootstrap directory structure
BOOTSTRAP_DIR="$PROJECT_ROOT/tmp/release/${BINARY_TAG}/${UNIX_TIME}"

echo "╭─────────────────────────────────────────╮"
echo "│  Orcka Release Bootstrap                │"
echo "╰─────────────────────────────────────────╯"
echo ""
echo "Version:      $NEXT_VERSION (internal: $INTERNAL_VERSION)"
echo "Binary Tag:   $BINARY_TAG"
echo "Source Tag:   $SOURCE_TAG"
echo "Target:       $TARGET_REF"
echo "Bootstrap:    $BOOTSTRAP_DIR"
if [[ "$DRY_RUN" == "true" ]]; then
    echo "Mode:         🔍 DRY RUN (local only)"
else
    echo "Mode:         🚀 COMMIT (will push to remote)"
fi
echo ""

# Create bootstrap directory
echo "📁 Creating bootstrap directory..."
mkdir -p "$BOOTSTRAP_DIR"

# Copy release scripts
echo "📋 Copying release scripts..."
cp -r "$RELEASE_DIR/"* "$BOOTSTRAP_DIR/"

# Copy or create versions.txt
VERSIONS_FILE="$PROJECT_ROOT/versions.txt"
BOOTSTRAP_VERSIONS="$BOOTSTRAP_DIR/versions.txt"

if [[ -f "$VERSIONS_FILE" ]]; then
    echo "📄 Copying existing versions.txt..."
    cp "$VERSIONS_FILE" "$BOOTSTRAP_VERSIONS"
else
    echo "📄 Creating new versions.txt..."
    # Create CSV header
    cat > "$BOOTSTRAP_VERSIONS" <<EOF
source_sha,build_start_iso,binary_sha,tag,tag_date_iso
EOF
fi

# Create environment file for release scripts
cat > "$BOOTSTRAP_DIR/release.env" <<EOF
RELEASE_VERSION=$NEXT_VERSION
RELEASE_INTERNAL_VERSION=$INTERNAL_VERSION
RELEASE_BINARY_TAG=$BINARY_TAG
RELEASE_SOURCE_TAG=$SOURCE_TAG
RELEASE_DATETIME=$RELEASE_DATETIME
RELEASE_TARGET=$TARGET_REF
RELEASE_BOOTSTRAP_TIME=$UNIX_TIME
RELEASE_BOOTSTRAP_DIR=$BOOTSTRAP_DIR
PROJECT_ROOT=$PROJECT_ROOT
DRY_RUN=$DRY_RUN
EOF

echo "✅ Bootstrap complete"
echo ""
echo "🚀 Executing release workflow..."
echo ""

# Cleanup function for ci/release temp directory
cleanup_ci_release() {
    if [[ -n "${CI_RELEASE_DIR:-}" && -d "$CI_RELEASE_DIR" ]]; then
        rm -rf "$CI_RELEASE_DIR"
    fi
}

trap cleanup_ci_release EXIT

# Execute the main release script from bootstrap directory
cd "$BOOTSTRAP_DIR"
exec ./release.sh

