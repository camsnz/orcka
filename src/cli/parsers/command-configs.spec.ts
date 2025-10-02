import { describe, expect, it } from "vitest";
import {
  BuildCommandConfig,
  ModifyCommandConfig,
  StatCommandConfig,
  UpCommandConfig,
  WorkflowCommandConfig,
  WriteCommandConfig,
} from "./command-configs.js";

describe("command-configs", () => {
  describe("StatCommandConfig", () => {
    it("should have correct command name", () => {
      expect(StatCommandConfig.name).toBe("stat");
    });

    it("should include all stat arguments", () => {
      const expectedArgs = ["file", "help", "dotfile", "ascii", "verbose", "quiet"];
      for (const arg of expectedArgs) {
        expect(StatCommandConfig.args).toHaveProperty(arg);
      }
    });

    it("should configure dotfile argument correctly", () => {
      const dotfileArg = StatCommandConfig.args.dotfile;
      expect(dotfileArg.names).toEqual(["--dotfile"]);
      expect(dotfileArg.hasValue).toBe(true);
      expect(dotfileArg.required).toBe(false);
      expect(dotfileArg.description).toContain("DOT file");
    });

    it("should configure ascii argument correctly", () => {
      const asciiArg = StatCommandConfig.args.ascii;
      expect(asciiArg.names).toEqual(["--ascii"]);
      expect(asciiArg.hasValue).toBe(false);
      expect(asciiArg.required).toBe(false);
      expect(asciiArg.description).toContain("ASCII tree");
    });

    it("should provide comprehensive examples", () => {
      expect(StatCommandConfig.examples).toBeInstanceOf(Array);
      expect(StatCommandConfig.examples?.length).toBeGreaterThanOrEqual(5);
      expect(StatCommandConfig.examples).toContain("orcka stat");
      expect(StatCommandConfig.examples).toContain("orcka stat --dotfile services.dot");
      expect(StatCommandConfig.examples).toContain("orcka stat --ascii");
    });
  });

  describe("WriteCommandConfig", () => {
    it("should have correct command name", () => {
      expect(WriteCommandConfig.name).toBe("write");
    });

    it("should expose write command arguments", () => {
      const expectedArgs = ["file", "help", "output", "pull-policy"];
      for (const arg of expectedArgs) {
        expect(WriteCommandConfig.args).toHaveProperty(arg);
      }
    });

    it("should configure output argument correctly", () => {
      const outputArg = WriteCommandConfig.args.output;
      expect(outputArg.names).toEqual(["--output", "-o"]);
      expect(outputArg.hasValue).toBe(true);
      expect(outputArg.required).toBe(false);
      expect(outputArg.description).toContain("override file");
    });

    it("should configure pull-policy argument correctly", () => {
      const pullPolicyArg = WriteCommandConfig.args["pull-policy"];
      expect(pullPolicyArg.names).toEqual(["--pull-policy"]);
      expect(pullPolicyArg.hasValue).toBe(true);
      expect(pullPolicyArg.required).toBe(false);
      expect(pullPolicyArg.description).toContain("pull_policy value");
    });

    it("should include helpful examples", () => {
      expect(WriteCommandConfig.examples).toBeInstanceOf(Array);
      expect(WriteCommandConfig.examples).toContain("orcka write");
      expect(WriteCommandConfig.examples).toContain("orcka write --pull-policy always");
    });
  });

  describe("ModifyCommandConfig", () => {
    it("should have correct command name", () => {
      expect(ModifyCommandConfig.name).toBe("modify");
    });

    it("should require file argument", () => {
      const fileArg = ModifyCommandConfig.args.file;
      expect(fileArg.names).toEqual(["--file", "-f"]);
      expect(fileArg.hasValue).toBe(true);
      expect(fileArg.required).toBe(true);
      expect(fileArg.description).toContain("docker-compose.yml");
    });

    it("should include verbose option", () => {
      const verboseArg = ModifyCommandConfig.args.verbose;
      expect(verboseArg.names).toEqual(["--verbose", "-v"]);
      expect(verboseArg.hasValue).toBe(false);
      expect(verboseArg.required).toBe(false);
    });
  });

  describe("BuildCommandConfig", () => {
    it("should have correct command name", () => {
      expect(BuildCommandConfig.name).toBe("build");
    });

    it("should include all build arguments", () => {
      const expectedArgs = [
        "file",
        "help",
        "target",
        "extra-bake",
        "extra-compose",
        "skip-validation",
        "pull-policy",
        "verbose",
        "quiet",
      ];
      for (const arg of expectedArgs) {
        expect(BuildCommandConfig.args).toHaveProperty(arg);
      }
    });

    it("should configure skip-validation argument correctly", () => {
      const skipValidationArg = BuildCommandConfig.args["skip-validation"];
      expect(skipValidationArg.names).toEqual(["--skip-validation"]);
      expect(skipValidationArg.hasValue).toBe(false);
      expect(skipValidationArg.required).toBe(false);
      expect(skipValidationArg.description).toContain("Skip Docker environment");
    });

    it("should configure pull-policy argument correctly", () => {
      const pullPolicyArg = BuildCommandConfig.args["pull-policy"];
      expect(pullPolicyArg.names).toEqual(["--pull-policy"]);
      expect(pullPolicyArg.hasValue).toBe(true);
      expect(pullPolicyArg.required).toBe(false);
    });

    it("should include representative examples", () => {
      expect(BuildCommandConfig.examples).toBeInstanceOf(Array);
      expect(BuildCommandConfig.examples).toContain("orcka build");
      expect(BuildCommandConfig.examples?.some((example) => example.includes("--target"))).toBe(true);
      expect(BuildCommandConfig.examples?.some((example) => example.includes("--pull-policy"))).toBe(true);
    });
  });

  describe("UpCommandConfig", () => {
    it("should include runtime arguments", () => {
      const expectedArgs = ["file", "help", "pull-policy", "verbose", "quiet"];
      for (const arg of expectedArgs) {
        expect(UpCommandConfig.args).toHaveProperty(arg);
      }
    });
  });

  describe("WorkflowCommandConfig", () => {
    it("should have correct command name", () => {
      expect(WorkflowCommandConfig.name).toBe("workflow");
    });

    it("should include orchestrated workflow arguments", () => {
      const expectedArgs = ["file", "help", "ancestry", "skip-bake", "skip-up", "pull-policy", "verbose", "quiet"];

      for (const arg of expectedArgs) {
        expect(WorkflowCommandConfig.args).toHaveProperty(arg);
      }
    });

    it("should configure ancestry flag correctly", () => {
      const ancestryArg = WorkflowCommandConfig.args.ancestry;
      expect(ancestryArg.names).toEqual(["--ancestry"]);
      expect(ancestryArg.hasValue).toBe(false);
      expect(ancestryArg.required).toBe(false);
    });

    it("should configure skip-bake flag correctly", () => {
      const skipBakeArg = WorkflowCommandConfig.args["skip-bake"];
      expect(skipBakeArg.names).toEqual(["--skip-bake"]);
      expect(skipBakeArg.hasValue).toBe(false);
      expect(skipBakeArg.required).toBe(false);
    });

    it("should configure pull-policy option correctly", () => {
      const pullPolicyArg = WorkflowCommandConfig.args["pull-policy"];
      expect(pullPolicyArg.names).toEqual(["--pull-policy"]);
      expect(pullPolicyArg.hasValue).toBe(true);
      expect(pullPolicyArg.required).toBe(false);
    });

    it("should provide workflow examples", () => {
      expect(WorkflowCommandConfig.examples).toBeInstanceOf(Array);
      expect(WorkflowCommandConfig.examples).toContain("orcka workflow");
    });
  });

  describe("configuration consistency", () => {
    const allConfigs = [
      StatCommandConfig,
      WriteCommandConfig,
      ModifyCommandConfig,
      BuildCommandConfig,
      UpCommandConfig,
      WorkflowCommandConfig,
    ];

    it("should all be valid CommandConfig objects", () => {
      for (const config of allConfigs) {
        expect(typeof config.name).toBe("string");
        expect(typeof config.args).toBe("object");
        expect(Array.isArray(config.examples)).toBe(true);
        expect(config.args).toHaveProperty("help");
      }
    });
  });
});
