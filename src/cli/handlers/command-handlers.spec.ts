/**
 * Tests for command handler utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILD_HELP_TEXT,
  handleCommandHelp,
  MODIFY_HELP_TEXT,
  parseAndValidateCommonOptions,
  parseCommandArguments,
  STAT_HELP_TEXT,
  WORKFLOW_HELP_TEXT,
  WRITE_HELP_TEXT,
} from "./command-handlers.js";

// Mock dependencies
vi.mock("../parsers/arg-parser.js");
vi.mock("../utilities/cli-command-utils.js");

describe("command-handlers", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("parseCommandArguments", () => {
    it("should parse command arguments using provided config", async () => {
      const { parseArguments } = await import("../parsers/arg-parser.js");
      vi.mocked(parseArguments).mockReturnValue({
        file: "test.yml",
        verbose: true,
      });

      const mockConfig = { file: { type: "string" } };
      const result = parseCommandArguments(["--file", "test.yml"], mockConfig);

      expect(parseArguments).toHaveBeenCalledWith(["--file", "test.yml"], mockConfig);
      expect(result).toEqual({ file: "test.yml", verbose: true });
    });

    it("should return typed result", async () => {
      const { parseArguments } = await import("../parsers/arg-parser.js");
      vi.mocked(parseArguments).mockReturnValue({ help: false, verbose: true });

      interface TestResult {
        help: boolean;
        verbose: boolean;
      }

      const result = parseCommandArguments<TestResult>([], {});
      expect(result.help).toBe(false);
      expect(result.verbose).toBe(true);
    });
  });

  describe("handleCommandHelp", () => {
    it("should display help text and exit", () => {
      const helpText = "Usage: test command";

      expect(() => {
        handleCommandHelp(helpText);
      }).toThrow("process.exit called");

      expect(consoleSpy).toHaveBeenCalledWith(helpText);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("parseAndValidateCommonOptions", () => {
    it("should parse and validate common options", async () => {
      const { parseBooleanOptions, validateVerboseQuietOptions } = await import("../utilities/cli-command-utils.js");

      vi.mocked(parseBooleanOptions).mockReturnValue({
        verbose: true,
        quiet: false,
      });
      vi.mocked(validateVerboseQuietOptions).mockImplementation(() => {});

      const result = parseAndValidateCommonOptions({
        verbose: true,
        quiet: false,
      });

      expect(parseBooleanOptions).toHaveBeenCalledWith({
        verbose: true,
        quiet: false,
      });
      expect(validateVerboseQuietOptions).toHaveBeenCalledWith(true, false);
      expect(result).toEqual({ verbose: true, quiet: false });
    });

    it("should call validation with parsed options", async () => {
      const { parseBooleanOptions, validateVerboseQuietOptions } = await import("../utilities/cli-command-utils.js");

      vi.mocked(parseBooleanOptions).mockReturnValue({
        verbose: false,
        quiet: true,
      });
      vi.mocked(validateVerboseQuietOptions).mockImplementation(() => {});

      parseAndValidateCommonOptions({ verbose: "false", quiet: 1 });

      expect(validateVerboseQuietOptions).toHaveBeenCalledWith(false, true);
    });
  });

  describe("help text constants", () => {
    it("should contain stat help text", () => {
      expect(STAT_HELP_TEXT).toContain("Usage: orcka stat");
      expect(STAT_HELP_TEXT).toContain("--file <path>");
      expect(STAT_HELP_TEXT).toContain("--dotfile <path>");
      expect(STAT_HELP_TEXT).toContain("--ascii");
      expect(STAT_HELP_TEXT).toContain("--verbose, -v");
      expect(STAT_HELP_TEXT).toContain("--quiet, -q");
      expect(STAT_HELP_TEXT).toContain("Examples:");
    });

    it("should contain modify help text", () => {
      expect(MODIFY_HELP_TEXT).toContain("Usage: orcka modify");
      expect(MODIFY_HELP_TEXT).toContain("--file <path>");
      expect(MODIFY_HELP_TEXT).toContain("--verbose, -v");
      expect(MODIFY_HELP_TEXT).toContain("Examples:");
    });

    it("should contain build help text", () => {
      expect(BUILD_HELP_TEXT).toContain("Usage: orcka build");
      expect(BUILD_HELP_TEXT).toContain("--file <path>");
      expect(BUILD_HELP_TEXT).toContain("--target <name>");
      expect(BUILD_HELP_TEXT).toContain("--extra-bake <path>");
      expect(BUILD_HELP_TEXT).toContain("--extra-compose <path>");
      expect(BUILD_HELP_TEXT).toContain("--skip-validation");
      expect(BUILD_HELP_TEXT).toContain("--verbose, -v");
      expect(BUILD_HELP_TEXT).toContain("--quiet, -q");
      expect(BUILD_HELP_TEXT).toContain("Examples:");
    });

    it("should contain write help text", () => {
      expect(WRITE_HELP_TEXT).toContain("Usage: orcka write");
      expect(WRITE_HELP_TEXT).toContain("--file <path>");
      expect(WRITE_HELP_TEXT).toContain("--output, -o <path>");
      expect(WRITE_HELP_TEXT).toContain("--pull-policy <value>");
      expect(WRITE_HELP_TEXT).toContain("Examples:");
    });

    it("should contain workflow help text", () => {
      expect(WORKFLOW_HELP_TEXT).toContain("Usage: orcka workflow");
      expect(WORKFLOW_HELP_TEXT).toContain("--ancestry");
      expect(WORKFLOW_HELP_TEXT).toContain("--skip-bake");
      expect(WORKFLOW_HELP_TEXT).toContain("Examples:");
    });

    it("should have consistent help text format", () => {
      const helpTexts = [STAT_HELP_TEXT, MODIFY_HELP_TEXT, BUILD_HELP_TEXT, WRITE_HELP_TEXT, WORKFLOW_HELP_TEXT];

      helpTexts.forEach((helpText) => {
        expect(helpText).toMatch(/Usage: orcka \w+/);
        expect(helpText).toContain("Options:");
        expect(helpText).toContain("Examples:");
        expect(helpText).toContain("--help");
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete help flow", () => {
      expect(() => {
        handleCommandHelp(STAT_HELP_TEXT);
      }).toThrow("process.exit called");

      expect(consoleSpy).toHaveBeenCalledWith(STAT_HELP_TEXT);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should handle complete option parsing flow", async () => {
      const { parseBooleanOptions, validateVerboseQuietOptions } = await import("../utilities/cli-command-utils.js");
      const { parseArguments } = await import("../parsers/arg-parser.js");

      vi.mocked(parseArguments).mockReturnValue({
        verbose: true,
        quiet: false,
        file: "test.yml",
      });
      vi.mocked(parseBooleanOptions).mockReturnValue({
        verbose: true,
        quiet: false,
      });
      vi.mocked(validateVerboseQuietOptions).mockImplementation(() => {});

      const mockConfig = { verbose: { type: "boolean" } };
      const parsed = parseCommandArguments(["--verbose"], mockConfig);
      const options = parseAndValidateCommonOptions(parsed);

      expect(options).toEqual({ verbose: true, quiet: false });
      expect(validateVerboseQuietOptions).toHaveBeenCalledWith(true, false);
    });
  });

  describe("type definitions", () => {
    it("should export proper type definitions", () => {
      // These are compile-time checks - if the file compiles, the types are correct
      expect(typeof STAT_HELP_TEXT).toBe("string");
      expect(typeof MODIFY_HELP_TEXT).toBe("string");
      expect(typeof BUILD_HELP_TEXT).toBe("string");
      expect(typeof WRITE_HELP_TEXT).toBe("string");
      expect(typeof WORKFLOW_HELP_TEXT).toBe("string");
    });
  });
});
