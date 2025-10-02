/**
 * Tests for CLI command execution utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommandConfigDiscovery,
  type CommandExecutionConfig,
  type CommandExecutionResult,
  executeCommand,
  extractFileArgument,
  handleCommandResult,
  parseBooleanOptions,
  resolveInputFile,
  validateVerboseQuietOptions,
} from "./cli-command-utils.js";

// Mock dependencies
vi.mock("../../core/config/config-discovery.js");
vi.mock("../handlers/cli-error-handlers.js");

describe("cli-command-utils", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as () => never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("validateVerboseQuietOptions", () => {
    it("should not throw when verbose and quiet are both false", () => {
      expect(() => validateVerboseQuietOptions(false, false)).not.toThrow();
    });

    it("should not throw when only verbose is true", () => {
      expect(() => validateVerboseQuietOptions(true, false)).not.toThrow();
    });

    it("should not throw when only quiet is true", () => {
      expect(() => validateVerboseQuietOptions(false, true)).not.toThrow();
    });

    it("should call handleConflictingOptions when both are true", async () => {
      const { handleConflictingOptions } = await import("../handlers/cli-error-handlers.js");

      validateVerboseQuietOptions(true, true);

      expect(handleConflictingOptions).toHaveBeenCalledWith(
        "--verbose",
        "--quiet",
        "Error: --verbose and --quiet options cannot be used together",
      );
    });
  });

  describe("resolveInputFile", () => {
    it("should return file argument when provided", () => {
      const result = resolveInputFile("custom.yml", false);
      expect(result).toBe("custom.yml");
      expect(consoleSpy).toHaveBeenCalledWith("Using specified configuration file: custom.yml");
    });

    it("should not log when quiet is true", () => {
      resolveInputFile("custom.yml", true);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should auto-discover when no file argument provided", async () => {
      const { ConfigDiscovery } = await import("../../core/config/config-discovery.js");
      const mockDiscovery = {
        findConfigFile: vi.fn().mockReturnValue({
          found: true,
          filePath: "/project/orcka.yml",
          fileName: "orcka.yml",
        }),
        getNotFoundMessage: vi.fn(),
      };
      vi.mocked(ConfigDiscovery).mockImplementation(() => mockDiscovery as any);

      const result = resolveInputFile(undefined, false);

      expect(result).toBe("/project/orcka.yml");
      expect(consoleSpy).toHaveBeenCalledWith("🔍 Found configuration: orcka.yml");
    });

    it("should handle missing config file", async () => {
      const { ConfigDiscovery } = await import("../../core/config/config-discovery.js");
      const { handleMissingConfig } = await import("../handlers/cli-error-handlers.js");

      const mockDiscovery = {
        findConfigFile: vi.fn().mockReturnValue({ found: false }),
        getNotFoundMessage: vi.fn().mockReturnValue("Config not found"),
      };
      vi.mocked(ConfigDiscovery).mockImplementation(() => mockDiscovery as any);

      resolveInputFile(undefined, false);

      expect(handleMissingConfig).toHaveBeenCalledWith("Config not found", [
        "Create an orcka.yml or docker-orcka.yml file",
        "Use --file option to specify path",
      ]);
    });
  });

  describe("handleCommandResult", () => {
    it("should log success message when result is successful", () => {
      const result: CommandExecutionResult = { success: true };

      handleCommandResult(result, "Test", "Operation completed");

      expect(consoleSpy).toHaveBeenCalledWith("✅ Operation completed");
    });

    it("should not log when no success message provided", () => {
      const result: CommandExecutionResult = { success: true };

      handleCommandResult(result, "Test");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should handle failure with errors", async () => {
      const { displayCommandErrors } = await import("../handlers/cli-error-handlers.js");
      const result: CommandExecutionResult = {
        success: false,
        errors: ["Error 1", "Error 2"],
      };

      expect(() => {
        handleCommandResult(result, "Test");
      }).toThrow("process.exit called");

      expect(displayCommandErrors).toHaveBeenCalledWith(["Error 1", "Error 2"], "Test");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle failure without errors", async () => {
      const { displayCommandErrors } = await import("../handlers/cli-error-handlers.js");
      const result: CommandExecutionResult = { success: false };

      expect(() => {
        handleCommandResult(result, "Test");
      }).toThrow("process.exit called");

      expect(displayCommandErrors).toHaveBeenCalledWith([], "Test");
    });
  });

  describe("parseBooleanOptions", () => {
    it("should parse boolean options correctly", () => {
      const result = parseBooleanOptions({
        verbose: true,
        quiet: false,
        other: "value",
      });

      expect(result).toEqual({
        verbose: true,
        quiet: false,
      });
    });

    it("should handle truthy values", () => {
      const result = parseBooleanOptions({
        verbose: "true",
        quiet: 0,
      });

      expect(result).toEqual({
        verbose: true,
        quiet: false,
      });
    });

    it("should handle missing values", () => {
      const result = parseBooleanOptions({});

      expect(result).toEqual({
        verbose: false,
        quiet: false,
      });
    });
  });

  describe("extractFileArgument", () => {
    it("should extract string file argument", () => {
      const result = extractFileArgument({ file: "config.yml" });
      expect(result).toBe("config.yml");
    });

    it("should return undefined for non-string file", () => {
      const result = extractFileArgument({ file: true });
      expect(result).toBeUndefined();
    });

    it("should return undefined when file is missing", () => {
      const result = extractFileArgument({});
      expect(result).toBeUndefined();
    });
  });

  describe("executeCommand", () => {
    it("should execute command successfully", async () => {
      const { ConfigDiscovery } = await import("../../core/config/config-discovery.js");
      const mockDiscovery = {
        findConfigFile: vi.fn().mockReturnValue({
          found: true,
          filePath: "/project/orcka.yml",
          fileName: "orcka.yml",
        }),
      };
      vi.mocked(ConfigDiscovery).mockImplementation(() => mockDiscovery as any);

      const mockExecutor = vi.fn().mockResolvedValue({ success: true });
      const config: CommandExecutionConfig = { verbose: false, quiet: true };

      await executeCommand("Test", config, mockExecutor, "Success!");

      expect(mockExecutor).toHaveBeenCalledWith("/project/orcka.yml", config);
      expect(consoleSpy).toHaveBeenCalledWith("✅ Success!");
    });

    it("should handle command failure", async () => {
      const { ConfigDiscovery } = await import("../../core/config/config-discovery.js");
      const { displayCommandErrors } = await import("../handlers/cli-error-handlers.js");

      const mockDiscovery = {
        findConfigFile: vi.fn().mockReturnValue({
          found: true,
          filePath: "/project/orcka.yml",
        }),
      };
      vi.mocked(ConfigDiscovery).mockImplementation(() => mockDiscovery as any);

      const mockExecutor = vi.fn().mockResolvedValue({
        success: false,
        errors: ["Command failed"],
      });
      const config: CommandExecutionConfig = { file: "test.yml" };

      await expect(async () => {
        await executeCommand("Test", config, mockExecutor);
      }).rejects.toThrow("process.exit called");

      expect(displayCommandErrors).toHaveBeenCalledWith(["Command failed"], "Test");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("CommandConfigDiscovery", () => {
    describe("findConfigFile", () => {
      it("should find config file successfully", () => {
        const mockDiscovery = {
          findConfigFile: vi.fn().mockReturnValue({
            found: true,
            filePath: "/project/orcka.yml",
          }),
          getNotFoundMessage: vi.fn(),
        };
        const discovery = new CommandConfigDiscovery(mockDiscovery as any);

        const result = discovery.findConfigFile(".");

        expect(result).toBe("/project/orcka.yml");
        expect(mockDiscovery.findConfigFile).toHaveBeenCalledWith(".");
      });

      it("should handle missing config file", async () => {
        const { handleMissingConfig } = await import("../handlers/cli-error-handlers.js");

        const mockDiscovery = {
          findConfigFile: vi.fn().mockReturnValue({ found: false }),
          getNotFoundMessage: vi.fn().mockReturnValue("Not found"),
        };
        const discovery = new CommandConfigDiscovery(mockDiscovery as any);

        discovery.findConfigFile(".");

        expect(handleMissingConfig).toHaveBeenCalledWith("Not found", [
          "Create an orcka.yml or docker-orcka.yml file",
          "Use --file option to specify configuration path",
        ]);
      });
    });

    describe("findConfigFileWithLogging", () => {
      it("should find config file with logging", () => {
        const mockDiscovery = {
          findConfigFile: vi.fn().mockReturnValue({
            found: true,
            filePath: "/project/orcka.yml",
            fileName: "orcka.yml",
          }),
          getNotFoundMessage: vi.fn(),
        };
        const discovery = new CommandConfigDiscovery(mockDiscovery as any);

        const result = discovery.findConfigFileWithLogging(".", false);

        expect(result).toBe("/project/orcka.yml");
        expect(consoleSpy).toHaveBeenCalledWith("🔍 Found configuration: orcka.yml");
      });

      it("should not log when quiet is true", () => {
        const mockDiscovery = {
          findConfigFile: vi.fn().mockReturnValue({
            found: true,
            filePath: "/project/orcka.yml",
            fileName: "orcka.yml",
          }),
          getNotFoundMessage: vi.fn(),
        };
        const discovery = new CommandConfigDiscovery(mockDiscovery as any);

        discovery.findConfigFileWithLogging(".", true);

        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete command flow", async () => {
      const { ConfigDiscovery } = await import("../../core/config/config-discovery.js");
      const mockDiscovery = {
        findConfigFile: vi.fn().mockReturnValue({
          found: true,
          filePath: "/project/orcka.yml",
          fileName: "orcka.yml",
        }),
      };
      vi.mocked(ConfigDiscovery).mockImplementation(() => mockDiscovery as any);

      const config: CommandExecutionConfig = { verbose: true, quiet: false };
      const mockExecutor = vi.fn().mockResolvedValue({ success: true });

      await executeCommand("Integration", config, mockExecutor, "All done!");

      expect(consoleSpy).toHaveBeenCalledWith("🔍 Found configuration: orcka.yml");
      expect(consoleSpy).toHaveBeenCalledWith("✅ All done!");
      expect(mockExecutor).toHaveBeenCalledWith("/project/orcka.yml", config);
    });
  });
});
