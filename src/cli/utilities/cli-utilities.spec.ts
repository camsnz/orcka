/**
 * Tests for CLI utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILD_INFO_CONFIG, showMainUsage, showVersion } from "./cli-utilities.js";

describe("cli-utilities", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("showVersion", () => {
    it("should display version information", () => {
      showVersion();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Orca: orchestrate"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Version"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Built"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Branch"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Source"));
    });

    it("should include build info placeholders", () => {
      showVersion();

      const calls = consoleSpy.mock.calls.flat();
      const versionCall = calls.find((call) => call.includes("Version"));
      const builtCall = calls.find((call) => call.includes("Built"));
      const branchCall = calls.find((call) => call.includes("Branch"));
      const sourceCall = calls.find((call) => call.includes("Source"));

      expect(versionCall).toContain("${GIT_SHA}");
      expect(builtCall).toContain("${BUILD_DATE}");
      expect(branchCall).toContain("${GIT_BRANCH}");
      expect(sourceCall).toContain("github.com/camsnz/orcka");
    });
  });

  describe("showMainUsage", () => {
    it("should display main usage information", () => {
      showMainUsage();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Orca: orchestrate"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: orcka [command] [options]"));
    });

    it("should include all main commands", () => {
      showMainUsage();

      const calls = consoleSpy.mock.calls.flat();
      const usageText = calls.join(" ");

      expect(usageText).toContain("stat");
      expect(usageText).toContain("write");
      expect(usageText).toContain("modify");
      expect(usageText).toContain("build");
      expect(usageText).toContain("write");
      expect(usageText).toContain("workflow");
    });

    it("should include global options", () => {
      showMainUsage();

      const calls = consoleSpy.mock.calls.flat();
      const usageText = calls.join(" ");

      expect(usageText).toContain("--help, -h");
      expect(usageText).toContain("--version, -v");
    });

    it("should include updated examples", () => {
      showMainUsage();

      const calls = consoleSpy.mock.calls.flat();
      const usageText = calls.join(" ");

      expect(usageText).toContain("orcka stat");
      expect(usageText).toContain("orcka write");
      expect(usageText).toContain("orcka build");
      expect(usageText).toContain("orcka write");
      expect(usageText).toContain("orcka workflow");
    });

    it("should include help instruction", () => {
      showMainUsage();

      const calls = consoleSpy.mock.calls.flat();
      const usageText = calls.join(" ");

      expect(usageText).toContain("For command-specific help");
      expect(usageText).toContain("orcka [command] --help");
    });
  });

  describe("BUILD_INFO_CONFIG", () => {
    it("should export build info configuration", () => {
      expect(BUILD_INFO_CONFIG).toBeDefined();
      expect(BUILD_INFO_CONFIG).toHaveProperty("buildDate");
      expect(BUILD_INFO_CONFIG).toHaveProperty("gitSha");
      expect(BUILD_INFO_CONFIG).toHaveProperty("gitBranch");
      expect(BUILD_INFO_CONFIG).toHaveProperty("repoUrl");
    });

    it("should contain placeholder values for build replacement", () => {
      expect(BUILD_INFO_CONFIG.buildDate).toBe("${BUILD_DATE}");
      expect(BUILD_INFO_CONFIG.gitSha).toBe("${GIT_SHA}");
      expect(BUILD_INFO_CONFIG.gitBranch).toBe("${GIT_BRANCH}");
    });
  });
});
