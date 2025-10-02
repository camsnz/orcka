# Health Check Session Tracking

## Overview

Health checks now track sessions in an SQLite database to enable intelligent test optimization. Contract tests only run every 5th successful session, significantly reducing health check time for routine checks.

## Features

### Session Tracking
- **Session ID**: Each health check run gets a unique correlation ID
- **Git State**: Tracks current commit SHA and branch
- **Workspace Changes**: Counts staged/modified lines and untracked KB
- **Segment Timing**: Records start/end times for each check module (dependencies, testing, quality)
- **Success Tracking**: Records session outcomes and exit codes

### Smart Test Skipping
- **Expensive Test Optimization**: Contract tests only run every 5th successful session
- **Graceful Degradation**: If database unavailable, falls back to running all tests
- **Quick Mode Override**: `--quick` flag still skips contract tests immediately

## Database Location

```
$GIT_DIR/tmp/health-checks/db/sessions.db
```

Typically: `.git/tmp/health-checks/db/sessions.db`

## Usage

### Normal Usage (Automatic)

Just run health checks as usual:

```bash
task health
# or
./cmd/health-check.sh
```

The system automatically:
1. Starts a new session with git state capture
2. Tracks each check segment
3. Records completion with exit code
4. Decides if expensive tests should run

### Manual Session Commands

For debugging or custom integration:

```bash
# Start a new session (returns session ID)
pnpm exec tsx cmd/health-check/session-tracker.ts start

# Start a segment
pnpm exec tsx cmd/health-check/session-tracker.ts start-segment "dependencies"

# End a segment
pnpm exec tsx cmd/health-check/session-tracker.ts end-segment "dependencies"

# End session with exit code
pnpm exec tsx cmd/health-check/session-tracker.ts end 0

# Check if expensive tests should run (exit code 0 = yes, 1 = no)
pnpm exec tsx cmd/health-check/session-tracker.ts should-run-expensive

# View recent session history (last 10 by default)
pnpm exec tsx cmd/health-check/session-tracker.ts history 10

# Get session analytics
pnpm exec tsx cmd/health-check/session-tracker.ts analytics

# Cleanup old sessions (older than 30 days by default)
pnpm exec tsx cmd/health-check/session-tracker.ts cleanup 30
```

## Database Schema

### `sessions` Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                 -- session-{timestamp}-{random}
  start_time TEXT NOT NULL,            -- ISO 8601 timestamp
  end_time TEXT,                       -- ISO 8601 timestamp
  git_sha TEXT NOT NULL,               -- Current commit SHA
  git_branch TEXT NOT NULL,            -- Current branch name
  staged_lines INTEGER NOT NULL,       -- Count of staged diff lines
  modified_lines INTEGER NOT NULL,     -- Count of modified diff lines
  untracked_kb INTEGER NOT NULL,       -- Size of untracked files (KB)
  success INTEGER,                     -- 1 = success, 0 = failure
  exit_code INTEGER,                   -- Shell exit code
  duration_ms INTEGER                  -- Total session duration
);
```

### `segments` Table
```sql
CREATE TABLE segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,            -- Foreign key to sessions
  segment TEXT NOT NULL,               -- 'dependencies', 'testing', 'quality'
  start_time TEXT NOT NULL,            -- ISO 8601 timestamp
  end_time TEXT,                       -- ISO 8601 timestamp
  duration_ms INTEGER,                 -- Segment duration
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

## Example Session Flow

```bash
# Session 1 (count = 0): Runs contract tests ✅
task health
# -> All tests run, session recorded as successful

# Session 2 (count = 1): Skips contract tests ⏭️
task health
# -> Contract tests skipped (optimization)

# Session 3 (count = 2): Skips contract tests ⏭️
task health
# -> Contract tests skipped (optimization)

# Session 4 (count = 3): Skips contract tests ⏭️
task health
# -> Contract tests skipped (optimization)

# Session 5 (count = 4): Skips contract tests ⏭️
task health
# -> Contract tests skipped (optimization)

# Session 6 (count = 5): Runs contract tests ✅
task health
# -> All tests run (5th session), cycle restarts
```

## Benefits

### Time Savings
- **Typical run**: 4-5 seconds (unit tests only)
- **Full run**: 35-40 seconds (unit + contract tests)
- **Net savings**: ~75% reduction in health check time for routine runs

### When Contract Tests Run
Contract tests still run in these scenarios:
- Every 5th successful session (automatic)
- Quick mode disabled and first run ever
- `--quick` flag NOT provided
- Database unavailable (falls back to safe behavior)

### Failure Handling
If a health check fails:
- Session is recorded as unsuccessful
- Counter does NOT increment
- Next successful run will still be checked against the previous success count
- Contract tests will run on next success if it's the 5th

## Dependencies

- **Node.js**: 18+ required
- **pnpm**: For package management
- **tsx**: TypeScript execution (installed as dev dependency)
- **better-sqlite3**: SQLite database driver (installed as dev dependency)

## Troubleshooting

### Database Not Created
If you see the warning:
```
⚠️  Could not initialize session database: [error]
```

The system will fall back to running all tests. This is safe behavior.

Common causes:
- `.git/tmp/health-checks/db/` not writable
- SQLite3 not available
- Permissions issue

### Session Tracking Not Working
Check if tsx is installed:
```bash
pnpm exec tsx --version
```

If not, install dependencies:
```bash
pnpm install
```

### Manually Reset Counter
To force contract tests to run on next health check:
```bash
rm -f .git/tmp/health-checks/db/sessions.db
```

## Implementation Details

### TypeScript Module
`cmd/health-check/session-tracker.ts` - Core implementation with SQLite integration

### Bash Wrapper
`cmd/health-check/session-tracker.sh` - Shell interface that calls the TypeScript module via `tsx`

### Health Check Integration
- `cmd/health-check.sh` - Main script with session start/end/segment tracking
- `cmd/health-check/testing.sh` - Contract test skipping logic based on session count


