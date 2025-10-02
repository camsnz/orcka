import { describe, expect, it, vi } from "vitest";
import { type CommandConfig, parseArguments, Validators } from "./arg-parser.js";

describe("parseArguments", () => {
  const mockConfig: CommandConfig = {
    name: "test",
    args: {
      file: {
        names: ["--file", "-f"],
        description: "Input file",
        hasValue: true,
        required: true,
      },
      verbose: {
        names: ["--verbose", "-v"],
        description: "Verbose output",
        hasValue: false,
        defaultValue: false,
      },
      tags: {
        names: ["--tags"],
        description: "Multiple tags",
        hasValue: true,
        multiValue: true,
      },
      output: {
        names: ["--output", "-o"],
        description: "Output file",
        hasValue: true,
        defaultValue: "default.txt",
      },
    },
  };

  it("should parse single value arguments", () => {
    const result = parseArguments(["--file", "input.txt"], mockConfig);
    expect(result.file).toBe("input.txt");
  });

  it("should parse short flag arguments", () => {
    const result = parseArguments(["-f", "input.txt"], mockConfig);
    expect(result.file).toBe("input.txt");
  });

  it("should parse boolean flags", () => {
    const result = parseArguments(["--file", "input.txt", "--verbose"], mockConfig);
    expect(result.verbose).toBe(true);
  });

  it("should parse multi-value arguments", () => {
    const result = parseArguments(["--file", "input.txt", "--tags", "tag1", "tag2", "tag3"], mockConfig);
    expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("should handle single value in multi-value argument", () => {
    const result = parseArguments(["--file", "input.txt", "--tags", "tag1"], mockConfig);
    expect(result.tags).toBe("tag1");
  });

  it("should apply default values when arguments are provided", () => {
    const result = parseArguments(["--file", "input.txt", "--output"], mockConfig);
    expect(result.output).toBe("default.txt");
  });

  it("should not apply default values when arguments are not provided", () => {
    const result = parseArguments(["--file", "input.txt"], mockConfig);
    expect(result.verbose).toBeUndefined();
    expect(result.output).toBeUndefined();
  });

  it("should throw error for missing required argument", () => {
    expect(() => parseArguments(["--verbose"], mockConfig)).toThrow("Required argument missing: --file");
  });

  it("should throw error for unknown argument", () => {
    expect(() => parseArguments(["--unknown"], mockConfig)).toThrow("Unknown argument: --unknown");
  });

  it("should throw error for argument requiring value without value", () => {
    expect(() => parseArguments(["--file"], mockConfig)).toThrow("--file requires a value");
  });

  it("should handle help flag by exiting", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => parseArguments(["--help"], mockConfig)).toThrow();

    mockExit.mockRestore();
    mockLog.mockRestore();
  });

  it("should run custom validators", () => {
    const configWithValidator: CommandConfig = {
      name: "test",
      args: {
        period: {
          names: ["--period"],
          description: "Period unit",
          hasValue: true,
          validator: Validators.periodUnit,
        },
      },
    };

    expect(() => parseArguments(["--period", "invalid"], configWithValidator)).toThrow(
      "--period: Must be one of: hours, days, weeks, months, quarters, years, none",
    );
  });
});

describe("Validators", () => {
  describe("periodUnit", () => {
    it("should accept valid period units", () => {
      expect(Validators.periodUnit("hours")).toBeNull();
      expect(Validators.periodUnit("days")).toBeNull();
      expect(Validators.periodUnit("weeks")).toBeNull();
      expect(Validators.periodUnit("months")).toBeNull();
      expect(Validators.periodUnit("quarters")).toBeNull();
      expect(Validators.periodUnit("years")).toBeNull();
      expect(Validators.periodUnit("none")).toBeNull();
    });

    it("should reject invalid period units", () => {
      expect(Validators.periodUnit("invalid")).toBe(
        "Must be one of: hours, days, weeks, months, quarters, years, none",
      );
    });
  });

  describe("existingFile", () => {
    it("should accept string values", () => {
      expect(Validators.existingFile("file.txt")).toBeNull();
    });

    it("should reject array values", () => {
      expect(Validators.existingFile(["file1.txt", "file2.txt"])).toBe("File path cannot be an array");
    });
  });
});
