#!/usr/bin/env node

/**
 * Health Check Session Tracker
 * 
 * Tracks health check sessions in SQLite database to enable smart test skipping:
 * - Contract tests only run every 5th successful session
 * - Tracks git state, file changes, and session outcomes
 * - Provides session correlation IDs for debugging
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import initSqlJs, { Database } from "sql.js";

interface SessionStart {
  gitSha: string;
  gitBranch: string;
  stagedLines: number;
  modifiedLines: number;
  untrackedKb: number;
}

interface SessionResult {
  success: boolean;
  exitCode: number;
}

class HealthCheckSessionTracker {
  private db: Database | null = null;
  private dbPath: string;
  private currentSessionId: string | null = null;
  private sqlJs: any = null;

  constructor() {
    // Use $GIT_DIR/tmp/health-checks/db/ or fall back to .git/tmp/health-checks/db/
    const gitDir = this.getGitDir();
    const dbDir = join(gitDir, "tmp", "health-checks", "db");
    this.dbPath = join(dbDir, "sessions.db");
  }

  async initialize(): Promise<void> {
    try {
      const dbDir = join(this.getGitDir(), "tmp", "health-checks", "db");
      this.ensureDbDirectory(dbDir);
      await this.initializeDb();
    } catch (error) {
      console.warn(`⚠️  Could not initialize session database: ${error instanceof Error ? error.message : String(error)}`);
      this.db = null;
    }
  }

  private getGitDir(): string {
    try {
      return execSync("git rev-parse --git-dir", { encoding: "utf-8" }).trim();
    } catch {
      return ".git";
    }
  }

  private ensureDbDirectory(dbDir: string): void {
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
  }

  private async initializeDb(): Promise<void> {
    // Initialize sql.js
    this.sqlJs = await initSqlJs();

    // Load existing database or create new one
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new this.sqlJs.Database(buffer);
    } else {
      this.db = new this.sqlJs.Database();
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time TEXT NOT NULL,
        end_time TEXT,
        git_sha TEXT NOT NULL,
        git_branch TEXT NOT NULL,
        staged_lines INTEGER NOT NULL,
        modified_lines INTEGER NOT NULL,
        untracked_kb INTEGER NOT NULL,
        success INTEGER,
        exit_code INTEGER,
        duration_ms INTEGER
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_ms INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_segments_session_id ON segments(session_id);`);

    this.saveDb();
  }

  private saveDb(): void {
    if (this.db) {
      const data = this.db.export();
      writeFileSync(this.dbPath, Buffer.from(data));
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private getGitSha(): string {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    } catch {
      return "unknown";
    }
  }

  private getGitBranch(): string {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    } catch {
      return "unknown";
    }
  }

  private countLines(diff: string): number {
    if (!diff) return 0;
    return diff.split("\n").filter(line => line.startsWith("+") || line.startsWith("-")).length;
  }

  private getWorkspaceStats(): SessionStart {
    const gitSha = this.getGitSha();
    const gitBranch = this.getGitBranch();

    let stagedLines = 0;
    let modifiedLines = 0;
    let untrackedKb = 0;

    try {
      // Count staged changes
      const stagedDiff = execSync("git diff --cached", { encoding: "utf-8" });
      stagedLines = this.countLines(stagedDiff);

      // Count modified changes
      const modifiedDiff = execSync("git diff", { encoding: "utf-8" });
      modifiedLines = this.countLines(modifiedDiff);

      // Count untracked files size
      const untrackedFiles = execSync("git ls-files --others --exclude-standard", { encoding: "utf-8" })
        .split("\n")
        .filter(Boolean);

      for (const file of untrackedFiles) {
        try {
          const stats = statSync(file);
          untrackedKb += stats.size;
        } catch {
          // File might not exist or not accessible
        }
      }
      untrackedKb = Math.round(untrackedKb / 1024);
    } catch {
      // Git commands might fail, use defaults
    }

    return { gitSha, gitBranch, stagedLines, modifiedLines, untrackedKb };
  }

  startSession(): string | null {
    if (!this.db) return null;

    this.currentSessionId = this.generateSessionId();
    const stats = this.getWorkspaceStats();
    const startTime = new Date().toISOString();

    this.db.run(
      `INSERT INTO sessions (id, start_time, git_sha, git_branch, staged_lines, modified_lines, untracked_kb)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [this.currentSessionId, startTime, stats.gitSha, stats.gitBranch, stats.stagedLines, stats.modifiedLines, stats.untrackedKb]
    );

    this.saveDb();
    return this.currentSessionId;
  }

  startSegment(segment: string): void {
    if (!this.db || !this.currentSessionId) return;

    const startTime = new Date().toISOString();
    this.db.run(
      `INSERT INTO segments (session_id, segment, start_time) VALUES (?, ?, ?)`,
      [this.currentSessionId, segment, startTime]
    );

    this.saveDb();
  }

  endSegment(segment: string): void {
    if (!this.db || !this.currentSessionId) return;

    const endTime = new Date().toISOString();

    // Find the most recent segment with this name for this session
    const result = this.db.exec(
      `SELECT id, start_time FROM segments 
       WHERE session_id = ? AND segment = ? AND end_time IS NULL 
       ORDER BY id DESC LIMIT 1`,
      [this.currentSessionId, segment]
    );

    if (result.length > 0 && result[0].values.length > 0) {
      const [id, startTime] = result[0].values[0];
      const startMs = new Date(startTime as string).getTime();
      const endMs = new Date(endTime).getTime();
      const durationMs = endMs - startMs;

      this.db.run(
        `UPDATE segments SET end_time = ?, duration_ms = ? WHERE id = ?`,
        [endTime, durationMs, id]
      );

      this.saveDb();
    }
  }

  endSession(result: SessionResult, sessionId?: string): void {
    if (!this.db) return;

    // Use provided sessionId, or currentSessionId, or find most recent uncompleted session
    let targetSessionId = sessionId || this.currentSessionId;
    
    if (!targetSessionId) {
      // Find the most recent session without an end_time
      const recentResult = this.db.exec(
        `SELECT id FROM sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`
      );
      
      if (recentResult.length > 0 && recentResult[0].values.length > 0) {
        targetSessionId = recentResult[0].values[0][0] as string;
      } else {
        return; // No uncompleted session found
      }
    }

    const endTime = new Date().toISOString();

    const sessionResult = this.db.exec(
      `SELECT start_time FROM sessions WHERE id = ?`,
      [targetSessionId]
    );

    if (sessionResult.length > 0 && sessionResult[0].values.length > 0) {
      const startTime = sessionResult[0].values[0][0] as string;
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      const durationMs = endMs - startMs;

      this.db.run(
        `UPDATE sessions SET end_time = ?, success = ?, exit_code = ?, duration_ms = ? WHERE id = ?`,
        [endTime, result.success ? 1 : 0, result.exitCode, durationMs, targetSessionId]
      );

      this.saveDb();
    }

    if (this.currentSessionId === targetSessionId) {
      this.currentSessionId = null;
    }
  }

  shouldRunExpensiveTests(): boolean {
    if (!this.db) return true; // If DB unavailable, run all tests

    // Get count of successful sessions
    const result = this.db.exec(
      `SELECT COUNT(*) as count FROM sessions WHERE success = 1 AND end_time IS NOT NULL`
    );

    if (result.length > 0 && result[0].values.length > 0) {
      const count = result[0].values[0][0] as number;
      // Run expensive tests every 5th successful session (0, 5, 10, 15, ...)
      return count % 5 === 0;
    }

    return true;
  }

  getSessionHistory(limit: number = 10): any[] {
    if (!this.db) return [];

    const result = this.db.exec(
      `SELECT id, start_time, end_time, git_sha, git_branch, success, exit_code, duration_ms
       FROM sessions 
       WHERE end_time IS NOT NULL
       ORDER BY start_time DESC 
       LIMIT ?`,
      [limit]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
      const obj: any = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  getSessionAnalytics(): any {
    if (!this.db) return null;

    const result = this.db.exec(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_sessions,
        AVG(duration_ms) as avg_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        MAX(duration_ms) as max_duration_ms
      FROM sessions
      WHERE end_time IS NOT NULL
    `);

    if (result.length > 0 && result[0].values.length > 0) {
      const [total, successful, avg, min, max] = result[0].values[0];
      return {
        totalSessions: total,
        successfulSessions: successful,
        failedSessions: (total as number) - (successful as number),
        successRate: successful ? ((successful as number) / (total as number)) * 100 : 0,
        avgDurationMs: avg,
        minDurationMs: min,
        maxDurationMs: max,
      };
    }

    return null;
  }

  cleanupOldSessions(daysToKeep: number = 30): number {
    if (!this.db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    // Delete old segments first (foreign key constraint)
    this.db.run(
      `DELETE FROM segments WHERE session_id IN (
        SELECT id FROM sessions WHERE start_time < ?
      )`,
      [cutoffIso]
    );

    // Delete old sessions
    const result = this.db.exec(
      `SELECT COUNT(*) FROM sessions WHERE start_time < ?`,
      [cutoffIso]
    );

    const count = result.length > 0 && result[0].values.length > 0 ? (result[0].values[0][0] as number) : 0;

    this.db.run(`DELETE FROM sessions WHERE start_time < ?`, [cutoffIso]);

    this.saveDb();
    return count;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// CLI Interface
const main = async () => {
  const command = process.argv[2];
  const tracker = new HealthCheckSessionTracker();

  try {
    await tracker.initialize();

    switch (command) {
      case "start": {
        const sessionId = tracker.startSession();
        if (sessionId) {
          console.log(sessionId);
        }
        break;
      }

      case "start-segment": {
        const segment = process.argv[3];
        if (!segment) {
          console.error("Error: segment name required");
          process.exit(1);
        }
        tracker.startSegment(segment);
        break;
      }

      case "end-segment": {
        const segment = process.argv[3];
        if (!segment) {
          console.error("Error: segment name required");
          process.exit(1);
        }
        tracker.endSegment(segment);
        break;
      }

      case "end": {
        const exitCode = parseInt(process.argv[3] || "0", 10);
        tracker.endSession({ success: exitCode === 0, exitCode });
        break;
      }

      case "should-run-expensive": {
        const shouldRun = tracker.shouldRunExpensiveTests();
        console.log(shouldRun ? "true" : "false");
        process.exit(shouldRun ? 0 : 1);
        break;
      }

      case "history": {
        const limit = parseInt(process.argv[3] || "10", 10);
        const history = tracker.getSessionHistory(limit);
        console.log(JSON.stringify(history, null, 2));
        break;
      }

      case "analytics": {
        const analytics = tracker.getSessionAnalytics();
        if (analytics) {
          console.log(JSON.stringify(analytics, null, 2));
        } else {
          console.log("No session data available");
        }
        break;
      }

      case "cleanup": {
        const days = parseInt(process.argv[3] || "30", 10);
        const count = tracker.cleanupOldSessions(days);
        console.log(`Cleaned up ${count} old sessions (older than ${days} days)`);
        break;
      }

      default:
        console.error(`Usage: ${process.argv[1]} <start|start-segment|end-segment|end|should-run-expensive|history|analytics|cleanup> [args]`);
        process.exit(1);
    }

    tracker.close();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { HealthCheckSessionTracker };
