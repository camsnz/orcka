# Orcka Release System

## Overview

Automated binary release system for distributing Orcka via npm git URLs. Implements a clean 3-branch strategy separating source code, release automation, and compiled binaries.

## Quick Start

```bash
# Show usage
./cmd/release/make-release.sh

# Test with dry-run (creates dry_ prefixed tags, no push)
./cmd/release/make-release.sh --dry-run

# Actual patch release (requires --commit flag)
./cmd/release/make-release.sh --commit

# Minor version bump
./cmd/release/make-release.sh --commit --minor

# Major version bump
./cmd/release/make-release.sh --commit --major

# See QUICKSTART.md for more examples
cat cmd/release/QUICKSTART.md
```

## Architecture

### Branch Strategy

| Branch | Purpose | Contents |
|--------|---------|----------|
| `main` / `dev/*` | Source code | TypeScript, tests, docs |
| `release` | Automation | Release scripts only |
| `binaries` | Distribution | Compiled `bin/orcka.cjs` + `package.json` |

**Rationale:**
- Keeps source repo clean (no binaries in history)
- Enables `npm install git+...#tag` installations
- Provides immutable, auditable releases
- Separates concerns (code vs. distribution)

### Version System

**Semantic Versioning:** `x.y.z`

Standard semantic versioning with:
- `x` = Major version (breaking changes)
- `y` = Minor version (new features, backward compatible)
- `z` = Patch version (bug fixes)

**Internal Format:** `000.000.000` (3-digit zero padding for npm sorting)

**Tag Format:** `yyyy-mm-dd_x.y.z`

```
2025-10-02_0.0.1
│          │ │ └─ Patch version
│          │ └─── Minor version
│          └───── Major version
└────────────── Release date (ISO 8601)
```

**Dry-run Tags:** `dry_yyyy-mm-dd_x.y.z`
- All dry-run releases are prefixed with `dry_`
- Allows testing without interfering with production tags
- Can be pushed or kept local

**Version Bumping:**
- `--patch`: Increment z (default)
- `--minor`: Increment y, reset z to 0
- `--major`: Increment x, reset y and z to 0

**Benefits:**
- Standard semantic versioning (industry standard)
- Release date in tag for audit trail
- Proper npm version sorting with zero-padded internal format
- Dry-run isolation with prefix
- Starting version: `0.0.1`

### Workflow

```
┌──────────────┐
│  Bootstrap   │  1. Calculate next version
│  (isolated)  │  2. Copy scripts to tmp/release/v{VERSION}/{UNIXTIME}/
└──────┬───────┘  3. Copy versions.txt
       │          4. Create release.env
       ↓
┌──────────────┐
│   Checkout   │  5. Resolve target ref to SHA
│              │  6. Checkout detached HEAD
└──────┬───────┘
       │
       ↓
┌──────────────┐
│    Build     │  7. pnpm install --frozen-lockfile
│              │  8. pnpm run build
└──────┬───────┘  9. Verify bin/orcka.cjs
       │
       ↓
┌──────────────┐
│    Commit    │ 10. Save binary to /tmp
│              │ 11. Checkout/fetch binaries branch
└──────┬───────┘ 12. Copy binary + generate package.json
       │         13. Commit with metadata
       ↓
┌──────────────┐
│     Tag      │ 14. Create annotated tag
│              │ 15. Update versions.txt CSV
└──────┬───────┘
       │
       ↓
┌──────────────┐
│     Push     │ 16. Push binaries branch
│              │ 17. Push tag
└──────────────┘ 18. Cleanup (unless error/KEEP_BOOTSTRAP)
```

## Scripts

### `make-release.sh` - Entry Point

**Purpose:** Create isolated execution environment

**Responsibilities:**
- Calculate next version from git tags
- Create `tmp/release/v{VERSION}/{UNIXTIME}/`
- Copy all scripts to bootstrap directory
- Initialize or copy `versions.txt`
- Generate `release.env` configuration
- Execute `release.sh` from isolated directory

**Why Isolated?**
- Scripts can't be modified mid-execution
- Audit trail preserved if debugging needed
- Clean separation from source tree

### `version-utils.sh` - Version Management

**Commands:**
```bash
./version-utils.sh next patch              # Calculate next patch version
./version-utils.sh next minor              # Calculate next minor version
./version-utils.sh next major              # Calculate next major version
./version-utils.sh parse 1.2.3             # → 1 2 3
./version-utils.sh latest                  # Get latest version
./version-utils.sh latest true             # Get latest dry-run version
./version-utils.sh validate 1.2.3          # Check format
./version-utils.sh format-internal 1.2.3   # → 001.002.003
./version-utils.sh format-tag 0.0.1        # → 2025-10-02_0.0.1
```

**Algorithm:**
```python
def calculate_next_version(bump_type, is_dry_run):
    latest = get_latest_version(is_dry_run)
    
    if not latest:
        return "0.0.1"  # Starting version
    
    major, minor, patch = parse(latest)
    
    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    else:  # patch
        return f"{major}.{minor}.{patch + 1}"

def format_release_tag(date, version, is_dry_run):
    prefix = "dry_" if is_dry_run else ""
    return f"{prefix}{date}_{version}"
```

### `scm.sh` - Git Operations

**Commands:**
- `checkout <ref>` - Resolve and checkout target
- `commit <source_sha> <binary_path>` - Commit to binaries branch
- `tag <binary_sha> <tag>` - Create annotated tag
- `push <tag>` - Push branch and tag to remote
- `update-versions <args...>` - Append to versions.txt

**Key Features:**
- Handles first-time binaries branch creation (orphan branch)
- Fetches remote binaries branch if exists
- Copies binary via /tmp to avoid path conflicts
- Generates npm-compatible `package.json`
- Creates annotated tags with install instructions

### `build.sh` - Binary Compilation

**Steps:**
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Build binary (`pnpm run build`)
3. Verify `bin/orcka.cjs` exists and is executable
4. Test binary runs (`./bin/orcka.cjs --version`)

**Timeouts:** ~2-5 seconds (dependencies already cached)

### `release.sh` - Main Orchestrator

**Workflow:**
1. Load environment from `release.env`
2. Checkout target (capture source SHA)
3. Build binary
4. Commit to binaries branch (capture binary SHA)
5. Tag release
6. Update versions.txt with all metadata
7. Push (unless `DRY_RUN=true`)
8. Cleanup bootstrap directory (unless error or `KEEP_BOOTSTRAP=true`)

**Output:** Beautiful progress UI with timing

## Data Tracking

### `versions.txt` - Release History

**Format:** CSV with 5 columns

```csv
source_sha,build_start_iso,binary_sha,tag,tag_date_iso
73ac3d4...,2025-10-01T15:51:07Z,9671afe...,v01.25.1001,2025-10-01T15:51:19Z
```

**Fields:**
1. **source_sha** - Commit binary was built from
2. **build_start_iso** - ISO 8601 build start timestamp
3. **binary_sha** - Commit on binaries branch
4. **tag** - Version tag (e.g., v01.25.1001)
5. **tag_date_iso** - ISO 8601 tag creation timestamp

**Uses:**
- Audit trail for all releases
- Traceability from binary → source
- Build duration analysis
- Release frequency tracking

### Binaries Branch Structure

```
binaries/
├── README.md         # Installation instructions
├── package.json      # npm metadata
└── bin/
    └── orcka.cjs     # Compiled binary (164KB)
```

**`package.json` Contents:**
```json
{
  "name": "orcka",
  "version": "000.000.001",
  "description": "Docker Compose workflow manager with hash-based image tagging",
  "bin": {
    "orcka": "./bin/orcka.cjs"
  },
  "files": ["bin/"],
  "engines": {"node": ">=18.0.0"},
  "repository": {
    "type": "git",
    "url": "git+https://github.com/camsnz/orcka.git"
  },
  "license": "MIT"
}
```

Note: Uses zero-padded internal version for proper npm sorting.

**Commit Message:**
```
Release 2025-10-02_0.0.1

Built from: 73ac3d4fcef92835705aac060264ae5837ebf755
Binary size: 164K
Build time: 2025-10-02T15:51:07Z
```

**Tag Message:**
```
Release 2025-10-02_0.0.1

Binary built from source.
Install via: npm install git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1
```

## Installation Methods

### 1. Specific Version

```bash
npm install git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1
```

### 2. Latest Binary

```bash
npm install git+https://github.com/camsnz/orcka.git#binaries
```

### 3. package.json Dependency

```json
{
  "dependencies": {
    "orcka": "git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1"
  },
  "devDependencies": {
    "orcka": "git+https://github.com/camsnz/orcka.git#binaries"
  }
}
```

### 4. Global Install

```bash
npm install -g git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1
orcka --version
```

## Command Line Options

### Modes (Required - Choose One)

| Option | Description |
|--------|-------------|
| `--dry-run` | Test release locally (creates `dry_` tags, no remote push) |
| `--commit` | Perform actual release (creates production tags, pushes to remote) |

**Note:** One of `--dry-run` or `--commit` must be specified. Running without arguments shows usage.

### Version Bump (Optional)

| Option | Description |
|--------|-------------|
| `--patch` | Bump patch version (x.y.Z) - default |
| `--minor` | Bump minor version (x.Y.0) |
| `--major` | Bump major version (X.0.0) |

## Environment Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `RELEASE_TARGET` | `HEAD` | Git ref to build | `main`, `feature/x`, `abc123` |
| `KEEP_BOOTSTRAP` | `false` | Preserve tmp directory | `true` |

## Common Use Cases

### Production Release (Patch)

```bash
git checkout main
git pull origin main

# Test first
./cmd/release/make-release.sh --dry-run

# Then commit
./cmd/release/make-release.sh --commit
# Creates: 2025-10-02_0.0.2 (if previous was 0.0.1)
```

### Minor Version Release

```bash
./cmd/release/make-release.sh --commit --minor
# Creates: 2025-10-02_0.1.0
```

### Major Version Release

```bash
./cmd/release/make-release.sh --commit --major
# Creates: 2025-10-02_1.0.0
```

### Feature Branch Release

```bash
RELEASE_TARGET=feature/experimental ./cmd/release/make-release.sh --commit
```

### Test Release Locally (Dry-run)

```bash
./cmd/release/make-release.sh --dry-run
# Creates: dry_2025-10-02_0.0.2 (local only, not pushed)

# Keep bootstrap for inspection
KEEP_BOOTSTRAP=true ./cmd/release/make-release.sh --dry-run
# Inspect: ls tmp/release/dry_2025-10-02_*/
```

### Re-release (Fix Bad Build)

```bash
# Delete tag
git tag -d 2025-10-02_0.0.1
git push origin :2025-10-02_0.0.1

# Optionally revert binaries branch
git checkout binaries
git reset --hard HEAD~1
git push -f origin binaries

# Re-release (will create same version with new date)
./cmd/release/make-release.sh --commit
```

## Troubleshooting

### Build Failures

**Symptom:** "Error: Binary not found at bin/orcka.cjs"

**Causes:**
- TypeScript compilation errors
- Missing dependencies
- Build script issues

**Debug:**
```bash
# Bootstrap directory preserved on error
cd tmp/release/2025-10-02_0.0.1/1234567890/
less release.env
# Check PROJECT_ROOT and rebuild manually
```

### Push Rejected

**Symptom:** "Updates were rejected because the tip of your current branch is behind"

**Causes:**
- Concurrent releases
- Manual commits to binaries branch
- Network issues

**Fix:**
```bash
git checkout binaries
git pull --rebase origin binaries
# Re-run release if needed
```

### Tag Conflicts

**Symptom:** "tag '2025-10-02_0.0.1' already exists"

**Options:**
1. Use `--dry-run` to test without creating production tags
2. Delete old tag: `git push origin :2025-10-02_0.0.1`
3. Wait until tomorrow (date will change in tag)
4. Bump version: `--minor` or `--major`

### npm Install Fails

**Symptoms:**
- "fatal: couldn't find remote ref"
- "Error: Cannot find module"

**Checks:**
```bash
# Tag exists?
git ls-remote --tags origin 2025-10-02_0.0.1

# Binaries branch accessible?
git ls-remote --heads origin binaries

# package.json valid?
git show binaries:package.json

# Binary executable?
git show binaries:bin/orcka.cjs | head -5
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Release Binary
on:
  workflow_dispatch:
    inputs:
      target:
        description: 'Git ref to release'
        required: false
        default: 'main'
      bump:
        description: 'Version bump type'
        required: false
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major
      dry_run:
        description: 'Dry run (no push)'
        type: boolean
        default: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for tags
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Run release
        env:
          RELEASE_TARGET: ${{ inputs.target }}
        run: |
          if [ "${{ inputs.dry_run }}" = "true" ]; then
            MODE="--dry-run"
          else
            MODE="--commit"
          fi
          ./cmd/release/make-release.sh $MODE --${{ inputs.bump }}
```

## Security & Best Practices

### ✅ DO

- Release from clean, reviewed code
- Test with `--dry-run` first
- Use semantic versioning (`--patch`, `--minor`, `--major`)
- Track releases in versions.txt
- Verify binary works before pushing
- Tag source commits separately for traceability

### ❌ DON'T

- Commit secrets to source or binary
- Force-push binaries branch (unless fixing mistake)
- Manually edit binaries branch
- Skip version numbers
- Release unreviewed code
- Include dev dependencies in binary

## Maintenance

### Cleanup Old Releases

```bash
# List all tags
git tag -l "*_*" | sort -V

# List dry-run tags
git tag -l "dry_*" | sort -V

# Delete old tags (if needed)
git tag -d 2025-10-02_0.0.1
git push origin :2025-10-02_0.0.1

# Clean up local dry-run tags
git tag -l "dry_*" | xargs git tag -d
```

### Audit Release History

```bash
# View versions.txt
cat versions.txt | column -t -s,

# Check binary sizes over time
git checkout binaries
git log --pretty=format:"%h %s" --stat bin/orcka.cjs
```

### Update Release Scripts

```bash
# Scripts are on main branch
git checkout main
vim cmd/release/release.sh
git commit -m "fix: improve error handling in release script"
git push origin main

# Next release uses updated scripts
./cmd/release/make-release.sh
```

## Future Enhancements

Potential improvements:
- [ ] Multi-platform binaries (Linux, macOS, Windows)
- [ ] Binary signing and verification
- [ ] Automated changelog generation
- [ ] GitHub Release integration
- [ ] Slack/Discord notifications
- [ ] Rollback automation
- [ ] Binary size regression alerts
- [ ] Performance benchmarking
- [ ] Pre-release testing suite

## References

- **Quick Start**: `cmd/release/QUICKSTART.md`
- **Detailed Docs**: `cmd/release/README.md`
- **Scripts**: `cmd/release/*.sh`
- **Tracking**: `versions.txt`

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-01  
**Maintained By:** Orcka Team

