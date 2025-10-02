/**
 * Tests for CLI error handling utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidationError, ValidationWarning } from "../../types.js";
import {
  DEFAULT_ERROR_CONFIG,
  displayCommandErrors,
  displayCommandSuccess,
  displayValidationErrors,
  displayValidationSuccess,
  displayValidationWarnings,
  type ErrorDisplayConfig,
  formatValidationError,
  formatValidationWarning,
  handleConflictingOptions,
  handleMissingConfig,
} from "../handlers/cli-error-handlers.js";

describe("cli-error-handlers", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("displayValidationErrors", () => {
    it("should display validation errors with header", () => {
      const errors: ValidationError[] = [
        { message: "Invalid configuration", type: "schema" },
        { message: "Missing field", type: "validation", field: "dockerfile" },
      ];

      displayValidationErrors(errors);

      expect(consoleSpy).toHaveBeenCalledWith("❌ Validation failed");
      expect(consoleSpy).toHaveBeenCalledWith("\nErrors:");
      expect(consoleSpy).toHaveBeenCalledWith("  ❌ Invalid configuration");
      expect(consoleSpy).toHaveBeenCalledWith("  ❌ Missing field (dockerfile)");
    });

    it("should include target information when available", () => {
      const errors: ValidationError[] = [
        {
          message: "Invalid target",
          type: "validation",
          target: "web-service",
        },
      ];

      displayValidationErrors(errors);

      expect(consoleSpy).toHaveBeenCalledWith("  ❌ Invalid target [web-service]");
    });

    it("should include path information when available", () => {
      const errors: ValidationError[] = [{ message: "File not found", type: "file", path: "/path/to/file" }];

      displayValidationErrors(errors);

      expect(consoleSpy).toHaveBeenCalledWith("  ❌ File not found - /path/to/file");
    });

    it("should handle complex error with all fields", () => {
      const errors: ValidationError[] = [
        {
          message: "Complex error",
          type: "validation",
          target: "api-service",
          field: "contexts",
          path: "/project/docker-sha.yml",
        },
      ];

      displayValidationErrors(errors);

      expect(consoleSpy).toHaveBeenCalledWith("  ❌ Complex error [api-service] (contexts) - /project/docker-sha.yml");
    });

    it("should handle empty errors array", () => {
      displayValidationErrors([]);

      expect(consoleSpy).toHaveBeenCalledWith("❌ Validation failed");
      expect(consoleSpy).toHaveBeenCalledWith("\nErrors:");
      // Should not call any error-specific logs
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("displayValidationWarnings", () => {
    it("should display warnings when present", () => {
      const warnings: ValidationWarning[] = [
        { message: "Performance warning", type: "performance" },
        { message: "Best practice", type: "best_practice", target: "web" },
      ];

      displayValidationWarnings(warnings);

      expect(consoleSpy).toHaveBeenCalledWith("\nWarnings:");
      expect(consoleSpy).toHaveBeenCalledWith("  ⚠️  Performance warning");
      expect(consoleSpy).toHaveBeenCalledWith("  ⚠️  Best practice [web]");
    });

    it("should not display anything for empty warnings", () => {
      displayValidationWarnings([]);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("displayValidationSuccess", () => {
    it("should display success message", () => {
      displayValidationSuccess([]);

      expect(consoleSpy).toHaveBeenCalledWith("✅ Validation successful");
    });

    it("should display success with warnings", () => {
      const warnings: ValidationWarning[] = [{ message: "Minor issue", type: "best_practice" }];

      displayValidationSuccess(warnings);

      expect(consoleSpy).toHaveBeenCalledWith("✅ Validation successful");
      expect(consoleSpy).toHaveBeenCalledWith("\nWarnings:");
      expect(consoleSpy).toHaveBeenCalledWith("  ⚠️  Minor issue");
    });
  });

  describe("displayCommandErrors", () => {
    it("should display command errors", () => {
      const errors = ["Connection failed", "Invalid configuration"];

      displayCommandErrors(errors, "Calculate");

      expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Calculate failed:");
      expect(consoleErrorSpy).toHaveBeenCalledWith("  - Connection failed");
      expect(consoleErrorSpy).toHaveBeenCalledWith("  - Invalid configuration");
    });

    it("should handle empty errors array", () => {
      displayCommandErrors([], "Build");

      expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Build failed:");
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("displayCommandSuccess", () => {
    it("should display basic success message", () => {
      displayCommandSuccess("Operation completed");

      expect(consoleSpy).toHaveBeenCalledWith("✅ Operation completed");
    });

    it("should display success with services list", () => {
      const services = ["web", "api", "database"];

      displayCommandSuccess("Services processed", services);

      expect(consoleSpy).toHaveBeenCalledWith("✅ Services processed");
      expect(consoleSpy).toHaveBeenCalledWith("  • web");
      expect(consoleSpy).toHaveBeenCalledWith("  • api");
      expect(consoleSpy).toHaveBeenCalledWith("  • database");
    });

    it("should display success with details", () => {
      displayCommandSuccess("Build completed", [], "Total time: 2m 30s");

      expect(consoleSpy).toHaveBeenCalledWith("✅ Build completed");
      expect(consoleSpy).toHaveBeenCalledWith("Total time: 2m 30s");
    });

    it("should display success with services and details", () => {
      const services = ["web"];
      displayCommandSuccess("Modified services", services, "Changes saved");

      expect(consoleSpy).toHaveBeenCalledWith("✅ Modified services");
      expect(consoleSpy).toHaveBeenCalledWith("  • web");
      expect(consoleSpy).toHaveBeenCalledWith("Changes saved");
    });
  });

  describe("handleConflictingOptions", () => {
    it("should display default error message and exit", () => {
      expect(() => {
        handleConflictingOptions("--verbose", "--quiet");
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Cannot use --verbose and --quiet options together");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should display custom error message", () => {
      expect(() => {
        handleConflictingOptions("--file", "--auto", "Custom conflict message");
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Custom conflict message");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("handleMissingConfig", () => {
    it("should display error and exit", () => {
      expect(() => {
        handleMissingConfig("No configuration file found");
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("No configuration file found");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should display error with suggestions", () => {
      const suggestions = ["Create a docker-sha.yml file", "Use --file option to specify path"];

      expect(() => {
        handleMissingConfig("Config not found", suggestions);
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Config not found");
      expect(consoleErrorSpy).toHaveBeenCalledWith("\nSuggestions:");
      expect(consoleErrorSpy).toHaveBeenCalledWith("  - Create a docker-sha.yml file");
      expect(consoleErrorSpy).toHaveBeenCalledWith("  - Use --file option to specify path");
    });
  });

  describe("formatValidationError", () => {
    it("should format error with default config", () => {
      const error: ValidationError = {
        message: "Test error",
        type: "validation",
        target: "web",
        field: "dockerfile",
        path: "/project/config.yml",
      };

      const result = formatValidationError(error);

      expect(result).toBe("  ❌ Test error [web] (dockerfile) - /project/config.yml");
    });

    it("should format error with custom config", () => {
      const error: ValidationError = {
        message: "Test error",
        type: "validation",
        target: "web",
      };

      const config: ErrorDisplayConfig = {
        showTargetInfo: false,
        showFieldInfo: true,
        showPathInfo: true,
        useColors: false,
      };

      const result = formatValidationError(error, config);

      expect(result).toBe("  ERROR: Test error");
    });

    it("should handle minimal error", () => {
      const error: ValidationError = {
        message: "Simple error",
        type: "schema",
      };

      const result = formatValidationError(error);

      expect(result).toBe("  ❌ Simple error");
    });
  });

  describe("formatValidationWarning", () => {
    it("should format warning with default config", () => {
      const warning: ValidationWarning = {
        message: "Test warning",
        type: "performance",
        target: "api",
      };

      const result = formatValidationWarning(warning);

      expect(result).toBe("  ⚠️  Test warning [api]");
    });

    it("should format warning without colors", () => {
      const warning: ValidationWarning = {
        message: "Test warning",
        type: "best_practice",
      };

      const config: ErrorDisplayConfig = {
        showTargetInfo: true,
        showFieldInfo: true,
        showPathInfo: true,
        useColors: false,
      };

      const result = formatValidationWarning(warning, config);

      expect(result).toBe("  WARNING:  Test warning");
    });
  });

  describe("DEFAULT_ERROR_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_ERROR_CONFIG).toEqual({
        showTargetInfo: true,
        showFieldInfo: true,
        showPathInfo: true,
        useColors: true,
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle real validation result", () => {
      const errors: ValidationError[] = [
        {
          message: "Missing dockerfile",
          type: "file",
          target: "web",
          field: "dockerfile",
        },
      ];
      const warnings: ValidationWarning[] = [{ message: "Consider using cache", type: "performance", target: "web" }];

      displayValidationErrors(errors);
      displayValidationWarnings(warnings);

      expect(consoleSpy).toHaveBeenCalledWith("❌ Validation failed");
      expect(consoleSpy).toHaveBeenCalledWith("  ❌ Missing dockerfile [web] (dockerfile)");
      expect(consoleSpy).toHaveBeenCalledWith("  ⚠️  Consider using cache [web]");
    });
  });
});
