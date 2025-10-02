/**
 * Global test setup file for vitest
 * Automatically mocks console output to prevent stderr/stdout leakage during tests
 */

import { afterEach, beforeEach, vi } from "vitest";

let originalConsole: {
  log: typeof console.log;
  error: typeof console.error;
  warn: typeof console.warn;
  info: typeof console.info;
  debug: typeof console.debug;
};

let originalProcess: {
  stdout: typeof process.stdout.write;
  stderr: typeof process.stderr.write;
};

// Global setup to mock console output for all tests
beforeEach(() => {
  // Store original console methods
  originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  // Store original process methods
  originalProcess = {
    stdout: process.stdout.write,
    stderr: process.stderr.write,
  };

  // Mock all console methods with silent implementations
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();

  // Mock process stdout/stderr to prevent any output leakage
  process.stdout.write = vi.fn().mockReturnValue(true);
  process.stderr.write = vi.fn().mockReturnValue(true);
});

afterEach(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;

  // Restore original process methods
  process.stdout.write = originalProcess.stdout;
  process.stderr.write = originalProcess.stderr;

  // Clear all mocks
  vi.clearAllMocks();
});
