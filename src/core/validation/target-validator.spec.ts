/**
 * Tests for target validation utilities
 */

import { describe, expect, it } from "vitest";
import type { DockerBakeTarget, DockerShaConfig } from "../../types.js";
import {
  generateHclVariableName,
  isVariableDeclaredInBakeFiles,
  type ParsedBakeConfig,
  validateTargetExistence,
  validateTargetsAndVariables,
} from "./target-validator.js";

describe("target-validator", () => {
  describe("generateHclVariableName", () => {
    it("should convert kebab-case to UPPER_SNAKE_CASE", () => {
      expect(generateHclVariableName("web-app")).toBe("WEB_APP");
      expect(generateHclVariableName("api-server")).toBe("API_SERVER");
      expect(generateHclVariableName("database")).toBe("DATABASE");
      expect(generateHclVariableName("my-long-service-name")).toBe("MY_LONG_SERVICE_NAME");
    });

    it("should handle already uppercase names", () => {
      expect(generateHclVariableName("WEB")).toBe("WEB");
      expect(generateHclVariableName("API_SERVER")).toBe("API_SERVER");
    });

    it("should handle single word names", () => {
      expect(generateHclVariableName("web")).toBe("WEB");
      expect(generateHclVariableName("api")).toBe("API");
    });
  });

  describe("isVariableDeclaredInBakeFiles", () => {
    it("should find variable declaration in bake file content", () => {
      const bakeFileContents = new Map([
        [
          "docker-bake.hcl",
          `
					variable "WEB_TAG_VER" {
						default = ""
					}
					target "web" {
						dockerfile = "Dockerfile"
					}
				`,
        ],
      ]);

      expect(isVariableDeclaredInBakeFiles("WEB_TAG_VER", bakeFileContents)).toBe(true);
    });

    it("should handle case-insensitive variable matching", () => {
      const bakeFileContents = new Map([
        [
          "docker-bake.hcl",
          `
					variable "web_tag_ver" {
						default = ""
					}
				`,
        ],
      ]);

      expect(isVariableDeclaredInBakeFiles("WEB_TAG_VER", bakeFileContents)).toBe(true);
    });

    it("should return false when variable is not declared", () => {
      const bakeFileContents = new Map([
        [
          "docker-bake.hcl",
          `
					target "web" {
						dockerfile = "Dockerfile"
					}
				`,
        ],
      ]);

      expect(isVariableDeclaredInBakeFiles("WEB_TAG_VER", bakeFileContents)).toBe(false);
    });

    it("should search across multiple bake files", () => {
      const bakeFileContents = new Map([
        [
          "docker-bake.hcl",
          `
					target "web" {
						dockerfile = "Dockerfile"
					}
				`,
        ],
        [
          "variables.hcl",
          `
					variable "WEB_TAG_VER" {
						default = ""
					}
				`,
        ],
      ]);

      expect(isVariableDeclaredInBakeFiles("WEB_TAG_VER", bakeFileContents)).toBe(true);
    });

    it("should handle whitespace variations in variable declarations", () => {
      const bakeFileContents = new Map([
        [
          "docker-bake.hcl",
          `
					variable   "WEB_TAG_VER"   {
						default = ""
					}
				`,
        ],
      ]);

      expect(isVariableDeclaredInBakeFiles("WEB_TAG_VER", bakeFileContents)).toBe(true);
    });
  });

  describe("validateTargetExistence", () => {
    it("should return no errors when all targets exist in bake files", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
          api: { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        web: { dockerfile: "web/Dockerfile" },
        api: { dockerfile: "api/Dockerfile" },
      };

      const errors = validateTargetExistence(config, allBakeTargets);
      expect(errors).toHaveLength(0);
    });

    it("should return errors for missing targets", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
          api: { calculate_on: { always: true } },
          database: { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        web: { dockerfile: "web/Dockerfile" },
      };

      const errors = validateTargetExistence(config, allBakeTargets);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain("Target 'api' not found");
      expect(errors[1]).toContain("Target 'database' not found");
    });
  });

  describe("validateTargetsAndVariables", () => {
    it("should return no errors when all targets and variables are valid", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
          api: { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        web: { dockerfile: "web/Dockerfile" },
        api: { dockerfile: "api/Dockerfile" },
      };

      const parsedBakeConfigs = new Map<string, ParsedBakeConfig>([
        [
          "docker-bake.hcl",
          {
            variable: {
              WEB_TAG_VER: { default: "" },
              API_TAG_VER: { default: "" },
            },
            target: {
              web: { dockerfile: "web/Dockerfile" },
              api: { dockerfile: "api/Dockerfile" },
            },
          },
        ],
      ]);

      const errors = validateTargetsAndVariables(config, allBakeTargets, parsedBakeConfigs);
      expect(errors).toHaveLength(0);
    });

    it("should return errors for missing targets", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
          missing: { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        web: { dockerfile: "web/Dockerfile" },
      };

      const parsedBakeConfigs = new Map<string, ParsedBakeConfig>([
        [
          "docker-bake.hcl",
          {
            variable: {
              WEB_TAG_VER: { default: "" },
            },
          },
        ],
      ]);

      const errors = validateTargetsAndVariables(config, allBakeTargets, parsedBakeConfigs);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Target 'missing' not found in any bake file");
    });

    it("should return errors for missing variable declarations", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        web: { dockerfile: "web/Dockerfile" },
      };

      const parsedBakeConfigs = new Map<string, ParsedBakeConfig>([
        [
          "docker-bake.hcl",
          {
            target: {
              web: { dockerfile: "web/Dockerfile" },
            },
            // No variables defined - this should cause the error
          },
        ],
      ]);

      const errors = validateTargetsAndVariables(config, allBakeTargets, parsedBakeConfigs);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Variable 'WEB_TAG_VER' not found");
      expect(errors[0]).toContain('Please declare: variable "WEB_TAG_VER"');
    });

    it("should handle complex target names with hyphens", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          "web-frontend": { calculate_on: { always: true } },
          "api-backend": { calculate_on: { always: true } },
        },
      };

      const allBakeTargets: Record<string, DockerBakeTarget> = {
        "web-frontend": { dockerfile: "web/Dockerfile" },
        "api-backend": { dockerfile: "api/Dockerfile" },
      };

      const parsedBakeConfigs = new Map<string, ParsedBakeConfig>([
        [
          "docker-bake.hcl",
          {
            variable: {
              WEB_FRONTEND_TAG_VER: { default: "" },
              API_BACKEND_TAG_VER: { default: "" },
            },
          },
        ],
      ]);

      const errors = validateTargetsAndVariables(config, allBakeTargets, parsedBakeConfigs);
      expect(errors).toHaveLength(0);
    });
  });
});
