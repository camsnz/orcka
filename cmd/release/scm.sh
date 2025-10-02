#!/bin/bash

# SCM Script
# Handles git operations: checkout target, commit binary, tag, push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment from bootstrap
if [[ -f "$SCRIPT_DIR/release.env" ]]; then
    source "$SCRIPT_DIR/release.env"
else
    echo "Error: release.env not found. Must run via make-release.sh" >&2
    exit 1
fi

# Validate required environment variables
required_vars=(
    "RELEASE_VERSION"
    "RELEASE_BINARY_TAG"
    "RELEASE_SOURCE_TAG"
    "RELEASE_DATETIME"
    "RELEASE_TARGET"
    "PROJECT_ROOT"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "Error: Required environment variable $var not set" >&2
        exit 1
    fi
done

# 1. Checkout target reference
checkout_target() {
    local target="$1"
    echo "📥 Checking out target: $target"
    
    cd "$PROJECT_ROOT"
    
    # Fetch latest
    git fetch origin --tags
    
    # Resolve target to SHA
    local target_sha
    target_sha=$(git rev-parse "$target")
    
    echo "   Target SHA: $target_sha"
    
    # Checkout target (detached HEAD is fine for builds)
    git -c advice.detachedHead=false checkout "$target_sha"
    
    echo "$target_sha"
}

# 2. Commit binary to ci/binaries branch
commit_binary() {
    local source_sha="$1"
    local binary_path="$2"
    local versions_file="${3:-}"
    local release_log="${4:-}"
    
    echo ""
    echo "📝 Committing binary to ci/binaries branch..."
    
    cd "$PROJECT_ROOT"
    
    # Copy binary to temp location first (in case it gets deleted on branch switch)
    local temp_binary="/tmp/orcka-release-$$.cjs"
    echo "   Saving binary to temp: $temp_binary"
    cp "$binary_path" "$temp_binary"
    
    # Copy versions.txt if provided
    local temp_versions=""
    if [[ -n "$versions_file" && -f "$versions_file" ]]; then
        temp_versions="/tmp/orcka-versions-$$.txt"
        echo "   Saving versions.txt to temp: $temp_versions"
        cp "$versions_file" "$temp_versions"
    fi
    
    # Copy release.log if provided
    local temp_log=""
    if [[ -n "$release_log" && -f "$release_log" ]]; then
        temp_log="/tmp/orcka-release-log-$$.txt"
        echo "   Saving release.log to temp: $temp_log"
        cp "$release_log" "$temp_log"
    fi
    
    # Check for uncommitted changes that might block branch switch
    echo "   Checking repository state..."
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "   ⚠️  Warning: Uncommitted changes detected, stashing..."
        git stash push -m "Release automation: temporary stash before ci/binaries switch"
    fi
    
    # Ensure ci/binaries branch exists
    # Check if branch exists locally
    if git show-ref --verify --quiet refs/heads/ci/binaries; then
        echo "   Switching to existing local ci/binaries branch..."
        if ! git checkout ci/binaries; then
            echo "Error: Failed to checkout local ci/binaries branch" >&2
            git status
            exit 1
        fi
        # Try to pull, but don't fail if remote doesn't exist
        git pull origin ci/binaries 2>/dev/null || echo "   (no remote branch to pull)"
    # Check if branch exists remotely
    elif git ls-remote --heads origin ci/binaries | grep -q "ci/binaries"; then
        echo "   Fetching ci/binaries branch from remote..."
        git fetch origin ci/binaries
        if ! git checkout -b ci/binaries origin/ci/binaries; then
            echo "Error: Failed to checkout ci/binaries after fetch" >&2
            git status
            exit 1
        fi
    else
        echo "   Creating new ci/binaries branch..."
        # Create orphan branch (no history)
        if ! git checkout --orphan ci/binaries; then
            echo "Error: Failed to create orphan ci/binaries branch" >&2
            exit 1
        fi
        git rm -rf . 2>/dev/null || true
        
        # Create initial structure
        mkdir -p bin
        echo "# Orcka Binaries" > README.md
        echo "" >> README.md
        echo "This branch contains compiled binaries for npm git installation." >> README.md
        echo "Do not modify manually. Managed by release automation." >> README.md
        
        git add README.md
        if ! git commit -m "Initialize ci/binaries branch"; then
            echo "Error: Failed to commit initial ci/binaries structure" >&2
            exit 1
        fi
    fi
    
    # Copy binary from temp location
    echo "   Copying binary to bin/orcka.cjs"
    mkdir -p bin
    cp "$temp_binary" bin/orcka.cjs
    rm -f "$temp_binary"
    
    # Ensure it's executable
    chmod +x bin/orcka.cjs
    
    # Copy versions.txt if provided
    if [[ -n "$temp_versions" ]]; then
        echo "   Copying versions.txt"
        cp "$temp_versions" versions.txt
        rm -f "$temp_versions"
    fi
    
    # Copy release.log if provided
    if [[ -n "$temp_log" ]]; then
        echo "   Copying release.log"
        cp "$temp_log" release.log
        rm -f "$temp_log"
    fi
    
    # Create package.json for npm (use standard semver)
    cat > package.json <<EOF
{
  "name": "orcka",
  "version": "${RELEASE_VERSION}",
  "description": "Docker Compose workflow manager with hash-based image tagging",
  "bin": {
    "orcka": "./bin/orcka.cjs"
  },
  "files": [
    "bin/"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/camsnz/orcka.git"
  },
  "license": "MIT"
}
EOF
    
    # Add and commit (force add since bin/ is in .gitignore)
    git add --force bin/orcka.cjs
    git add package.json
    
    # Add versions.txt and release.log if they exist
    [[ -f versions.txt ]] && git add versions.txt
    [[ -f release.log ]] && git add release.log
    
    git commit -m "Release $RELEASE_BINARY_TAG

Built from: $source_sha
Binary size: $(du -h bin/orcka.cjs | cut -f1)
Build time: $RELEASE_DATETIME
"
    
    # Get binary commit SHA
    local binary_sha
    binary_sha=$(git rev-parse HEAD)
    
    echo "   Binary SHA: $binary_sha"
    echo "$binary_sha"
}

# 3. Tag the binary commit
tag_binary() {
    local binary_sha="$1"
    local binary_tag="$2"
    
    echo ""
    echo "🏷️  Tagging binary commit: $binary_tag"
    
    cd "$PROJECT_ROOT"
    git checkout ci/binaries
    
    # Create annotated tag
    git tag -a "$binary_tag" -m "Release $binary_tag

Binary built from source.
Install via: npm install git+https://github.com/camsnz/orcka.git#$binary_tag
"
    
    echo "   Tagged: $binary_tag → $binary_sha"
}

# 4. Tag the source commit
tag_source() {
    local source_sha="$1"
    local source_tag="$2"
    
    echo ""
    echo "🏷️  Tagging source commit: $source_tag"
    
    cd "$PROJECT_ROOT"
    
    # Create annotated tag on source SHA
    git tag -a "$source_tag" "$source_sha" -m "Source release $source_tag

Source code for binary release.
Binary available via: npm install git+https://github.com/camsnz/orcka.git#${source_tag/_src/_bin}
"
    
    echo "   Tagged: $source_tag → $source_sha"
}

# 4b. Tag binary with semver for npm
tag_semver() {
    local binary_sha="$1"
    local version="$2"
    local dry_run="${3:-false}"
    
    # Format semver tag
    local semver_tag
    if [[ "$dry_run" == "true" ]]; then
        semver_tag="dry_v${version}"
    else
        semver_tag="v${version}"
    fi
    
    echo ""
    echo "🏷️  Tagging with semver: $semver_tag"
    
    cd "$PROJECT_ROOT"
    git checkout ci/binaries
    
    # Delete tag if it already exists (for dry runs)
    if git rev-parse "$semver_tag" >/dev/null 2>&1; then
        echo "   Deleting existing tag: $semver_tag"
        git tag -d "$semver_tag"
    fi
    
    # Create annotated tag
    git tag -a "$semver_tag" "$binary_sha" -m "Release $semver_tag

Install with:
  npm install git+https://github.com/camsnz/orcka.git#$semver_tag
"
    
    echo "   Tagged: $semver_tag → $binary_sha"
    echo "$semver_tag"
}

# 5. Push ci/binaries branch and all tags
push_releases() {
    local binary_tag="$1"
    local source_tag="$2"
    local semver_tag="${3:-}"
    
    echo ""
    echo "🚀 Pushing ci/binaries branch and tags..."
    
    cd "$PROJECT_ROOT"
    
    # Push branch
    git push origin ci/binaries
    
    # Push binary tag
    git push origin "$binary_tag"
    
    # Push source tag
    git push origin "$source_tag"
    
    # Push semver tag if provided
    if [[ -n "$semver_tag" ]]; then
        git push origin "$semver_tag"
    fi
    
    echo "   ✅ Pushed branch and tags"
}

# CLI handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Print header only in CLI mode
    echo "╭─────────────────────────────────────────╮"
    echo "│  SCM Operations                         │"
    echo "╰─────────────────────────────────────────╯"
    echo ""
    
    command="${1:-}"
    
    case "$command" in
        checkout)
            target="${2:-$RELEASE_TARGET}"
            checkout_target "$target"
            ;;
        commit)
            source_sha="${2:-}"
            binary_path="${3:-}"
            versions_file="${4:-}"
            release_log="${5:-}"
            if [[ -z "$source_sha" ]] || [[ -z "$binary_path" ]]; then
                echo "Error: source_sha and binary_path required" >&2
                exit 1
            fi
            commit_binary "$source_sha" "$binary_path" "$versions_file" "$release_log"
            ;;
        tag)
            binary_sha="${2:-}"
            binary_tag="${3:-$RELEASE_BINARY_TAG}"
            if [[ -z "$binary_sha" ]]; then
                echo "Error: binary_sha required" >&2
                exit 1
            fi
            tag_binary "$binary_sha" "$binary_tag"
            ;;
        tag-source)
            source_sha="${2:-}"
            source_tag="${3:-$RELEASE_SOURCE_TAG}"
            if [[ -z "$source_sha" ]]; then
                echo "Error: source_sha required" >&2
                exit 1
            fi
            tag_source "$source_sha" "$source_tag"
            ;;
        tag-semver)
            binary_sha="${2:-}"
            version="${3:-$RELEASE_VERSION}"
            dry_run="${4:-${DRY_RUN:-false}}"
            if [[ -z "$binary_sha" ]]; then
                echo "Error: binary_sha required" >&2
                exit 1
            fi
            tag_semver "$binary_sha" "$version" "$dry_run"
            ;;
        push)
            binary_tag="${2:-$RELEASE_BINARY_TAG}"
            source_tag="${3:-$RELEASE_SOURCE_TAG}"
            semver_tag="${4:-}"
            push_releases "$binary_tag" "$source_tag" "$semver_tag"
            ;;
        *)
            echo "SCM Operations"
            echo ""
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  checkout [ref]                     Checkout target reference"
            echo "  commit <source_sha> <binary_path> [versions_file] [release_log]  Commit binary to ci/binaries branch"
            echo "  tag <binary_sha> [binary_tag]      Tag binary commit with timestamp"
            echo "  tag-source <source_sha> [source_tag]  Tag source commit"
            echo "  tag-semver <binary_sha> [version] [dry_run]  Tag binary with semver (v1.2.3)"
            echo "  push [binary_tag] [source_tag] [semver_tag]  Push ci/binaries branch and all tags"
            exit 1
            ;;
    esac
fi

