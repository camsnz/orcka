# Orcka Release System

Automated release workflow for building and distributing Orcka binaries via npm git URLs.

## Overview

The release system follows a **3-branch strategy**:

1. **`main`** / **`dev/*`** - Source code branches
2. **`release`** - Release automation scripts (this directory)
3. **`binaries`** - Compiled binaries with `package.json` for npm installation

This separation keeps source code clean while enabling `npm install git+https://github.com/...#tag` installations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Bootstrap Phase                                             │
│  • Copy scripts to tmp/release/v01.25.1001/1234567890/     │
│  • Calculate next version (MAJOR.yy.mmnn format)           │
│  • Create isolated execution environment                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Release Workflow (in isolated tmp directory)                │
│  1. Checkout target (branch or SHA)                        │
│  2. Build binary (pnpm install + pnpm build)               │
│  3. Switch to 'binaries' branch                            │
│  4. Commit binary + package.json                           │
│  5. Tag with version (v01.25.1001)                         │
│  6. Update versions.txt CSV                                │
│  7. Push branch + tag                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Result                                                      │
│  • Binary available at github.com/...#v01.25.1001          │
│  • versions.txt tracks all releases                        │
│  • Bootstrap directory cleaned up                          │
└─────────────────────────────────────────────────────────────┘
```

## Version Format

**Format:** `MAJOR.yy.mmnn`

- **MAJOR** = Major version number (00-99)
- **yy** = Two-digit year (25 = 2025)
- **mm** = Two-digit month (01-12)
- **nn** = Release count for that month (01-99)

**Examples:**
- `v01.25.1001` = Major 01, October 2025, 1st release
- `v01.25.1002` = Major 01, October 2025, 2nd release
- `v02.26.0101` = Major 02, January 2026, 1st release

Version auto-increments based on existing git tags. If year/month changes, `nn` resets to `01`.

## Usage

### Quick Start

```bash
# Release from current HEAD with default major version (01)
./cmd/release/make-release.sh

# Release from specific branch or SHA
RELEASE_TARGET=feature/new-stuff ./cmd/release/make-release.sh

# Use different major version
RELEASE_MAJOR=02 ./cmd/release/make-release.sh

# Dry run (build but don't push)
DRY_RUN=true ./cmd/release/make-release.sh

# Keep bootstrap directory for debugging
KEEP_BOOTSTRAP=true ./cmd/release/make-release.sh
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELEASE_MAJOR` | `01` | Major version number |
| `RELEASE_TARGET` | `HEAD` | Git ref to build (branch, tag, or SHA) |
| `DRY_RUN` | `false` | Build but don't push |
| `KEEP_BOOTSTRAP` | `false` | Preserve bootstrap directory after completion |

### Install Released Binary

```bash
# Install specific version
npm install git+https://github.com/camsnz/orcka.git#v01.25.1001

# Install latest from binaries branch
npm install git+https://github.com/camsnz/orcka.git#binaries

# Use in package.json
{
  "dependencies": {
    "orcka": "git+https://github.com/camsnz/orcka.git#v01.25.1001"
  }
}
```

## Scripts

### `make-release.sh`

Entry point for release process. Creates isolated execution environment.

**Responsibilities:**
- Calculate next version number
- Create `tmp/release/v{VERSION}/{UNIXTIME}/` directory
- Copy all release scripts to bootstrap directory
- Copy or create `versions.txt`
- Create `release.env` with configuration
- Execute `release.sh` in isolated environment

**Output:** Isolated release execution

---

### `version-utils.sh`

Version calculation and parsing utilities.

**Commands:**
```bash
# Get next version for major 01
./version-utils.sh next 01          # → 01.25.1001

# Parse version into components
./version-utils.sh parse 01.25.1001 # → 01 25 10 01

# Get latest tag
./version-utils.sh latest 01        # → v01.25.0903

# Validate version format
./version-utils.sh validate 01.25.1001  # → Valid

# Format with 'v' prefix
./version-utils.sh format 01.25.1001    # → v01.25.1001
```

**Algorithm:**
1. Get latest tag matching `v{MAJOR}.*`
2. Parse year/month from tag
3. If year/month unchanged, increment `nn`
4. If year/month changed, reset to `01`
5. If major version changed, reset to `01`

---

### `scm.sh`

Git operations: checkout, commit, tag, push.

**Commands:**
```bash
# Checkout target reference
./scm.sh checkout main              # Returns: source SHA

# Commit binary to binaries branch
./scm.sh commit <source_sha> <binary_path>  # Returns: binary SHA

# Tag binary commit
./scm.sh tag <binary_sha> v01.25.1001

# Push branch and tag
./scm.sh push v01.25.1001

# Update versions.txt
./scm.sh update-versions <source_sha> <build_start> <binary_sha> <tag> <tag_date>
```

**Binaries Branch Management:**
- Creates orphan `binaries` branch if it doesn't exist
- Maintains clean structure: `bin/orcka.cjs`, `package.json`, `README.md`
- Commits include metadata: source SHA, build time, binary size
- Tags are annotated with installation instructions

---

### `build.sh`

Builds the orcka binary from checked out source.

**Steps:**
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Build binary (`pnpm run build`)
3. Verify binary exists at `bin/orcka.cjs`
4. Verify binary is executable
5. Test binary runs (`./bin/orcka.cjs --version`)

**Output:** `$PROJECT_ROOT/bin/orcka.cjs`

---

### `release.sh`

Main orchestrator. Executes complete release workflow.

**Workflow:**
1. **Checkout Target** - Resolve and checkout source reference
2. **Build Binary** - Compile from source
3. **Commit Binary** - Switch to binaries branch, commit binary + package.json
4. **Tag Release** - Create annotated tag
5. **Update Versions** - Append to versions.txt CSV
6. **Push** - Push binaries branch and tag to remote (unless `DRY_RUN=true`)

**Output:**
- Binary on binaries branch
- Git tag for npm installation
- Updated versions.txt
- Cleaned bootstrap directory (unless `KEEP_BOOTSTRAP=true`)

## Data Tracking

### `versions.txt`

CSV file tracking all releases:

```csv
source_sha,build_start_iso,binary_sha,tag,tag_date_iso
86f17eb5...,2025-10-01T15:30:00Z,a1b2c3d4...,v01.25.1001,2025-10-01T15:35:00Z
```

**Columns:**
1. **source_sha** - Git SHA binary was built from
2. **build_start_iso** - ISO 8601 timestamp when build started
3. **binary_sha** - Git SHA of binary commit on binaries branch
4. **tag** - Version tag (e.g., v01.25.1001)
5. **tag_date_iso** - ISO 8601 timestamp when tag was created

**Location:**
- **Project root** (`versions.txt`) - Canonical version
- **Bootstrap dir** (`tmp/release/.../versions.txt`) - Working copy during release

## Bootstrap Directory Structure

```
tmp/release/
└── v01.25.1001/
    └── 1696176000/              # Unix timestamp
        ├── make-release.sh
        ├── version-utils.sh
        ├── scm.sh
        ├── build.sh
        ├── release.sh
        ├── release.env          # Environment configuration
        └── versions.txt         # Working copy
```

**Purpose:**
- Immutable execution environment
- Audit trail for releases
- Debugging failed releases (preserved if `KEEP_BOOTSTRAP=true` or on error)

## Binaries Branch Structure

```
binaries/
├── README.md              # Installation instructions
├── package.json           # npm metadata (version, bin, etc.)
└── bin/
    └── orcka.cjs          # Compiled binary
```

**Commit Message Format:**
```
Release v01.25.1001

Built from: 86f17eb5...
Binary size: 167K
Build time: 2025-10-01T15:35:00Z
```

**Tag Message Format:**
```
Release v01.25.1001

Binary built from source.
Install via: npm install git+https://github.com/camsnz/orcka.git#v01.25.1001
```

## Error Handling

### Failed Builds

If build fails:
- Bootstrap directory preserved for debugging
- Error message shows bootstrap location
- No commits/tags created
- No push to remote

Investigate via:
```bash
cd tmp/release/v01.25.1001/1696176000/
# Logs and scripts are here
```

### Failed Pushes

If push fails (network, permissions, etc.):
- Binary committed locally
- Tag created locally
- Run `DRY_RUN=false ./release.sh` to retry push only

### Version Conflicts

If tag already exists:
- Git will reject push
- Increment major version or wait for next month
- Delete remote tag if rerelease needed: `git push origin :v01.25.1001`

## Workflow Integration

### CI/CD Integration

```yaml
# GitHub Actions example
name: Release
on:
  workflow_dispatch:
    inputs:
      target:
        description: 'Git ref to release'
        required: false
        default: 'main'
      major:
        description: 'Major version'
        required: false
        default: '01'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for tags
      
      - uses: pnpm/action-setup@v2
      
      - name: Run release
        env:
          RELEASE_TARGET: ${{ inputs.target }}
          RELEASE_MAJOR: ${{ inputs.major }}
        run: ./cmd/release/make-release.sh
```

### Manual Release

```bash
# From release branch
git checkout release
git pull origin release

# Run release
RELEASE_TARGET=main ./cmd/release/make-release.sh

# Verify
git checkout binaries
git log --oneline -1
git tag -l "v*" | tail -1
```

## Best Practices

1. **Always release from `release` branch** - Ensures script versions are consistent
2. **Use `DRY_RUN=true` first** - Test locally before pushing
3. **Monitor versions.txt** - Track release history
4. **Use semantic major versions** - Major changes → increment MAJOR
5. **Tag source commits** - Tag main branch too for traceability
6. **Test installation** - After release, test `npm install git+...#tag`

## Troubleshooting

### Q: Version calculation wrong?

Check existing tags:
```bash
git tag -l "v01.*" | sort -V | tail -5
```

Manually calculate:
```bash
./cmd/release/version-utils.sh next 01
```

### Q: Binary not executable?

Build script should handle this, but verify:
```bash
ls -l bin/orcka.cjs
chmod +x bin/orcka.cjs
```

### Q: npm install fails?

Check:
1. Tag exists: `git ls-remote --tags origin v01.25.1001`
2. Binaries branch accessible: `git ls-remote origin binaries`
3. package.json valid: `git show binaries:package.json`

### Q: Want to re-release same version?

Delete remote tag and re-run:
```bash
git tag -d v01.25.1001
git push origin :v01.25.1001
./cmd/release/make-release.sh
```

## Security Considerations

- **Binaries branch is public** - Don't include secrets in binary
- **Git history preserved** - Failed releases visible in git log
- **Audit trail** - versions.txt tracks all releases
- **Isolated execution** - Bootstrap prevents contamination
- **Permissions** - Requires write access to repository

## Future Enhancements

Potential improvements:
- [ ] Automated testing before push
- [ ] Release notes generation from commits
- [ ] Multi-platform binary support (linux, macos, windows)
- [ ] Signature verification for binaries
- [ ] Automatic changelog updates
- [ ] Integration with GitHub Releases
- [ ] Slack/Discord notifications
- [ ] Binary size regression detection

---

**Last Updated:** 2025-10-01  
**Maintained By:** Release Automation Team

