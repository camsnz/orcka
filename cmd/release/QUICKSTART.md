# Release Quick Start Guide

## TL;DR

```bash
# Show usage
./cmd/release/make-release.sh

# Test locally first (dry-run) - no remote push
./cmd/release/make-release.sh --dry-run

# Release patch version (requires --commit flag)
./cmd/release/make-release.sh --commit

# Minor version bump
./cmd/release/make-release.sh --commit --minor

# Major version bump
./cmd/release/make-release.sh --commit --major

# Release specific branch/tag
RELEASE_TARGET=feature/my-branch ./cmd/release/make-release.sh --commit
```

## What It Does

1. **Calculates version** using semantic versioning (e.g., `0.0.1` → `0.0.2`)
2. **Builds binary** from source (`pnpm install` + `pnpm build`)
3. **Creates/updates `binaries` branch** with:
   - Compiled `bin/orcka.cjs`
   - `package.json` with internal version (000.000.001)
   - Git tag (e.g., `2025-10-02_0.0.2`)
4. **Tracks release** in `versions.txt` CSV
5. **Pushes to remote** (unless `--dry-run`)

## Installation

After release, users can install via:

```bash
# Specific version by tag
npm install git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1

# Latest binary
npm install git+https://github.com/camsnz/orcka.git#binaries

# In package.json
{
  "dependencies": {
    "orcka": "git+https://github.com/camsnz/orcka.git#2025-10-02_0.0.1"
  }
}
```

## Version Format

**Semantic Versioning: `x.y.z`**

- `x` = Major version (breaking changes)
- `y` = Minor version (new features)
- `z` = Patch version (bug fixes)

**Internal Format:** `000.000.000` (3-digit padding for proper sorting in npm)

**Tag Format:** `yyyy-mm-dd_x.y.z` (e.g., `2025-10-02_0.0.1`)
- Release date prefix for audit trail
- Dry-run tags: `dry_yyyy-mm-dd_x.y.z`

**Examples:**
- `2025-10-02_0.0.1` = First release (patch)
- `2025-10-15_0.1.0` = Minor version bump
- `2025-11-01_1.0.0` = Major version bump
- `dry_2025-10-02_0.0.2` = Dry-run test

## Command Line Options

### Modes (Required - Choose One)

| Option | Description |
|--------|-------------|
| `--dry-run` | Test release locally (creates `dry_` tags, no remote push) |
| `--commit` | Perform actual release (creates production tags, pushes to remote) |

### Version Bump (Optional)

| Option | Description |
|--------|-------------|
| `--patch` | Bump patch version (x.y.Z) - default |
| `--minor` | Bump minor version (x.Y.0) |
| `--major` | Bump major version (X.0.0) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELEASE_TARGET` | `HEAD` | Git ref to build (branch, tag, SHA) |
| `KEEP_BOOTSTRAP` | `false` | Keep tmp directory for debugging |

## Common Workflows

### Production Release

```bash
# 1. Ensure you're on latest main
git checkout main
git pull origin main

# 2. Test locally with dry-run
./cmd/release/make-release.sh --dry-run

# 3. If successful, release for real (patch bump)
./cmd/release/make-release.sh --commit

# 4. Verify
git checkout binaries
git log --oneline -1
git tag -l "*_*" | tail -1
```

### Minor Version Release

```bash
# New features, backward compatible
./cmd/release/make-release.sh --commit --minor
```

### Major Version Release

```bash
# Breaking changes
./cmd/release/make-release.sh --commit --major
```

### Release from Feature Branch

```bash
# Build from specific branch
RELEASE_TARGET=feature/new-stuff ./cmd/release/make-release.sh --commit
```

### Test Release Workflow

```bash
# Dry-run creates local changes only
./cmd/release/make-release.sh --dry-run

# Tags will be prefixed with dry_
git tag -l "dry_*"

# Push manually if satisfied
git checkout binaries
git push origin binaries
git push origin dry_2025-10-02_0.0.1
```

## Troubleshooting

### Q: "Tag already exists"

A: Another release already used this version/date. Either:
- Bump the version explicitly: `--minor` or `--major`
- Delete existing tag (see below)

### Q: "Build failed"

A: Check bootstrap directory for logs:
```bash
ls tmp/release/*/
# Directory preserved on error
```

### Q: "Push rejected"

A: Check git permissions:
```bash
git push origin binaries  # Test push access
```

### Q: "npm install fails"

A: Verify tag exists:
```bash
git ls-remote --tags origin 2025-10-02_0.0.1
git show binaries:package.json
```

### Delete Bad Release

```bash
# 1. Delete tag locally and remotely
git tag -d 2025-10-02_0.0.1
git push origin :2025-10-02_0.0.1

# 2. Delete bad commit on binaries branch (if needed)
git checkout binaries
git reset --hard HEAD~1
git push -f origin binaries

# 3. Re-run release
./cmd/release/make-release.sh --commit
```

## File Locations

- **Scripts**: `cmd/release/*.sh`
- **Versions**: `versions.txt` (CSV tracking)
- **Bootstrap**: `tmp/release/{TAG}/{UNIXTIME}/` (temporary)
- **Binaries**: `binaries` branch on remote

## Version History

```bash
# View all releases
git tag -l "*_*" | sort -V

# View dry-run tags
git tag -l "dry_*"

# View release history
cat versions.txt
```

## Next Steps

- **Full docs**: See `doc/RELEASE_SYSTEM.md`
- **Version utils**: `./cmd/release/version-utils.sh`
- **Track releases**: `cat versions.txt`

---

**Happy Releasing! 🚀**
