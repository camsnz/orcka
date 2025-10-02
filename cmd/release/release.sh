#!/bin/bash

# Main Release Script
# Orchestrates the complete release workflow
# Called by make-release.sh after environment setup

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment from bootstrap
if [[ -f "$SCRIPT_DIR/release.env" ]]; then
    source "$SCRIPT_DIR/release.env"
else
    echo "Error: release.env not found. Must run via make-release.sh" >&2
    exit 1
fi

# Track timing
START_TIME=$(date +%s)
BUILD_START_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Setup logging - capture all output to release.log
RELEASE_LOG="$SCRIPT_DIR/release.log"
exec > >(tee "$RELEASE_LOG") 2>&1

echo "╭─────────────────────────────────────────╮"
echo "│  Orcka Release Workflow                 │"
echo "╰─────────────────────────────────────────╯"
echo ""
echo "Version:      $RELEASE_VERSION"
echo "Binary Tag:   $RELEASE_BINARY_TAG"
echo "Source Tag:   $RELEASE_SOURCE_TAG"
echo "Target:       $RELEASE_TARGET"
echo "Started:      $BUILD_START_ISO"
echo ""

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        echo "❌ Release failed with exit code: $exit_code"
        echo ""
        echo "Bootstrap directory preserved for debugging:"
        echo "   $RELEASE_BOOTSTRAP_DIR"
    fi
    
    exit $exit_code
}

trap cleanup EXIT

# Step 1: Checkout target
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Checkout Target"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Capture output while still displaying it
scm_output=$("$SCRIPT_DIR/scm.sh" checkout "$RELEASE_TARGET" 2>&1)
echo "$scm_output"
SOURCE_SHA=$(echo "$scm_output" | tail -1)

echo ""
echo "✅ Checked out: $SOURCE_SHA"

# Step 2: Build binary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Build Binary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

"$SCRIPT_DIR/build.sh"

BINARY_PATH="$PROJECT_ROOT/bin/orcka.cjs"

# Step 3: Commit binary and release.log to ci/binaries branch
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Commit Binary and Release Log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# First commit: binary and release.log (without versions.txt)
scm_output=$("$SCRIPT_DIR/scm.sh" commit "$SOURCE_SHA" "$BINARY_PATH" "" "$RELEASE_LOG" 2>&1)
echo "$scm_output"
BINARY_SHA=$(echo "$scm_output" | tail -1)

# Step 4: Add versions.txt and amend commit
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Update Versions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TAG_DATE_ISO="$RELEASE_DATETIME"
VERSIONS_FILE="$SCRIPT_DIR/versions.txt"

echo "📊 Creating versions.txt entry..."
# Note: binary_sha here refers to the commit containing the binary
# (before versions.txt is added via amend)
echo "$SOURCE_SHA,$BUILD_START_ISO,$BINARY_SHA,$RELEASE_BINARY_TAG,$TAG_DATE_ISO" >> "$VERSIONS_FILE"

# Amend the commit to include versions.txt
echo "📝 Amending commit to include versions.txt..."
cd "$PROJECT_ROOT"
git checkout ci/binaries
cp "$VERSIONS_FILE" versions.txt
git add versions.txt
git commit --amend --no-edit

# Get the final commit SHA (after amend - this is what we'll tag)
BINARY_SHA_FINAL=$(git rev-parse HEAD)
echo "   Final commit SHA: $BINARY_SHA_FINAL"
echo ""
echo "ℹ️  Note: versions.txt records the pre-amend binary commit SHA"
echo "   but the tag will point to the final commit containing all files"

# Step 5: Tag binary commit
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Tag Binary Release"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

"$SCRIPT_DIR/scm.sh" tag "$BINARY_SHA_FINAL" "$RELEASE_BINARY_TAG"

# Step 6: Tag source commit
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Tag Source Release"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

"$SCRIPT_DIR/scm.sh" tag-source "$SOURCE_SHA" "$RELEASE_SOURCE_TAG"

# Step 6b: Tag binary with semver
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6b: Tag Semver for npm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

scm_output=$("$SCRIPT_DIR/scm.sh" tag-semver "$BINARY_SHA_FINAL" "$RELEASE_VERSION" "$DRY_RUN" 2>&1)
echo "$scm_output"
SEMVER_TAG=$(echo "$scm_output" | tail -1)

# Step 7: Push to remote
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Push to Remote"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Dry-run mode check
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    echo ""
    echo "🔍 DRY RUN MODE - Skipping remote push"
    echo ""
    echo "✅ All local changes completed:"
    echo "   • Binary committed to local ci/binaries branch"
    echo "   • versions.txt committed to ci/binaries branch"
    echo "   • release.log committed to ci/binaries branch"
    echo "   • Binary tag '$RELEASE_BINARY_TAG' created locally"
    echo "   • Source tag '$RELEASE_SOURCE_TAG' created locally"
    echo "   • Semver tag '$SEMVER_TAG' created locally"
    echo ""
    echo "❌ Not pushed to remote:"
    echo "   • Branch: ci/binaries"
    echo "   • Binary Tag: $RELEASE_BINARY_TAG"
    echo "   • Source Tag: $RELEASE_SOURCE_TAG"
    echo "   • Semver Tag: $SEMVER_TAG"
    echo ""
    echo "To push manually:"
    echo "   cd $PROJECT_ROOT"
    echo "   git push origin ci/binaries"
    echo "   git push origin $RELEASE_BINARY_TAG"
    echo "   git push origin $RELEASE_SOURCE_TAG"
    echo "   git push origin $SEMVER_TAG"
else
    "$SCRIPT_DIR/scm.sh" push "$RELEASE_BINARY_TAG" "$RELEASE_SOURCE_TAG" "$SEMVER_TAG"
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Success summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Release Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Version:        $RELEASE_VERSION"
echo "Binary Tag:     $RELEASE_BINARY_TAG"
echo "Source Tag:     $RELEASE_SOURCE_TAG"
echo "Semver Tag:     $SEMVER_TAG"
echo "Source SHA:     $SOURCE_SHA"
echo "Binary SHA:     $BINARY_SHA_FINAL"
echo "Duration:       ${MINUTES}m ${SECONDS}s"
echo ""
echo "📦 Install with:"
echo "   npm install git+https://github.com/camsnz/orcka.git#$SEMVER_TAG"
echo ""
echo "📄 Release artifacts on ci/binaries branch:"
echo "   • bin/orcka.cjs - Binary executable"
echo "   • versions.txt - Version history"
echo "   • release.log - Build log for this release"
echo ""

# Cleanup bootstrap directory on success
if [[ "${KEEP_BOOTSTRAP:-false}" != "true" ]]; then
    echo "🧹 Cleaning up bootstrap directory..."
    rm -rf "$RELEASE_BOOTSTRAP_DIR"
fi

echo "✨ Done!"

