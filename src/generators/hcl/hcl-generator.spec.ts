/**
 * Tests for HCL generation utilities
 */

import { describe, expect, it, vi } from "vitest";
import type { DockerBakeTarget, DockerShaConfig } from "../../types.js";
import type { Logger } from "../../utils/logging/logger.js";
import {
  createHclConfig,
  DEFAULT_HCL_CONFIG,
  formatAlignedVariables,
  formatHclOutput,
  formatSimpleVariables,
  type GeneratedService,
  generateCalculatedHcl,
  generateHclVariableName,
  generatePullPolicyVariableName,
  generateTagVersion,
  type HclGenerationConfig,
  validateHclConfig,
} from "./hcl-generator.js";

describe("hcl-generator", () => {
  describe("generateTagVersion", () => {
    const testDate = new Date("2024-09-12T13:45:30.000Z");
    const testHash = "8e117c7a48692bde97555ec24fbd2901217a9b38"; // 40 character hash

    it("should generate tag with period formatting", () => {
      const result = generateTagVersion(testDate, "hourly", testHash);
      // "20240912_13_" = 12 chars total, so remove first 12 chars from hash
      // Hash becomes: "2bde97555ec24fbd2901217a9b38" (28 chars)
      expect(result).toBe("20240912_13_2bde97555ec24fbd2901217a9b38");
      expect(result).toHaveLength(40);
    });

    it("should generate tag with object period", () => {
      const period = { unit: "hours" as const, number: 2 };
      const result = generateTagVersion(testDate, period, testHash);
      // Same as hourly: "20240912_13_" = 12 chars total
      expect(result).toBe("20240912_13_2bde97555ec24fbd2901217a9b38");
      expect(result).toHaveLength(40);
    });

    it("should generate no timestamp when no period", () => {
      const result = generateTagVersion(testDate, undefined, testHash);
      // No period specified - should return just the hash
      expect(result).toBe("8e117c7a48692bde97555ec24fbd2901217a9b38");
      expect(result).toHaveLength(40);
    });

    it("should handle none period", () => {
      const period = { unit: "none" as const };
      const result = generateTagVersion(testDate, period, testHash);
      // Empty timestamp returns just the hash
      expect(result).toBe("8e117c7a48692bde97555ec24fbd2901217a9b38");
      expect(result).toHaveLength(40);
    });
  });

  describe("generateHclVariableName", () => {
    it("should convert kebab-case to UPPER_SNAKE_CASE with TAG_VER suffix", () => {
      expect(generateHclVariableName("web-app")).toBe("WEB_APP_TAG_VER");
      expect(generateHclVariableName("api-server")).toBe("API_SERVER_TAG_VER");
      expect(generateHclVariableName("database")).toBe("DATABASE_TAG_VER");
    });

    it("should handle already uppercase names", () => {
      expect(generateHclVariableName("WEB")).toBe("WEB_TAG_VER");
      expect(generateHclVariableName("API_SERVER")).toBe("API_SERVER_TAG_VER");
    });

    it("should handle complex service names", () => {
      expect(generateHclVariableName("my-long-service-name")).toBe("MY_LONG_SERVICE_NAME_TAG_VER");
    });
  });

  describe("generatePullPolicyVariableName", () => {
    it("should replace TAG_VER with PULL_POLICY", () => {
      expect(generatePullPolicyVariableName("WEB_TAG_VER")).toBe("WEB_PULL_POLICY");
      expect(generatePullPolicyVariableName("API_SERVER_TAG_VER")).toBe("API_SERVER_PULL_POLICY");
    });

    it("should handle edge cases", () => {
      expect(generatePullPolicyVariableName("DATABASE_TAG_VER")).toBe("DATABASE_PULL_POLICY");
    });
  });

  describe("formatAlignedVariables", () => {
    it("should align variables properly", () => {
      const variables = [
        {
          name: "WEB_TAG_VER",
          value: "20240912_134530_555ec24fbd2901217a9b38",
        },
        {
          name: "API_SERVER_TAG_VER",
          value: "20240912_134530_97555ec24fbd2901217a9b38",
        },
        {
          name: "DB_TAG_VER",
          value: "20240912_134530_c24fbd2901217a9b38555ec2",
        },
      ];

      const result = formatAlignedVariables(variables);
      const lines = result.split("\n");

      expect(lines[0]).toBe('WEB_TAG_VER        = "20240912_134530_555ec24fbd2901217a9b38"');
      expect(lines[1]).toBe('API_SERVER_TAG_VER = "20240912_134530_97555ec24fbd2901217a9b38"');
      expect(lines[2]).toBe('DB_TAG_VER         = "20240912_134530_c24fbd2901217a9b38555ec2"');
    });

    it("should handle single variable", () => {
      const variables = [
        {
          name: "WEB_TAG_VER",
          value: "20240912_134530_555ec24fbd2901217a9b38",
        },
      ];

      const result = formatAlignedVariables(variables);
      expect(result).toBe('WEB_TAG_VER = "20240912_134530_555ec24fbd2901217a9b38"');
    });

    it("should handle empty variables array", () => {
      const result = formatAlignedVariables([]);
      expect(result).toBe("");
    });
  });

  describe("formatSimpleVariables", () => {
    it("should format variables without alignment", () => {
      const variables = [
        {
          name: "WEB_TAG_VER",
          value: "20240912_134530_555ec24fbd2901217a9b38",
        },
        {
          name: "API_SERVER_TAG_VER",
          value: "20240912_134530_97555ec24fbd2901217a9b38",
        },
      ];

      const result = formatSimpleVariables(variables);
      const lines = result.split("\n");

      expect(lines[0]).toBe('WEB_TAG_VER = "20240912_134530_555ec24fbd2901217a9b38"');
      expect(lines[1]).toBe('API_SERVER_TAG_VER = "20240912_134530_97555ec24fbd2901217a9b38"');
    });

    it("should handle empty variables array", () => {
      const result = formatSimpleVariables([]);
      expect(result).toBe("");
    });
  });

  describe("formatHclOutput", () => {
    const testServices: GeneratedService[] = [
      {
        name: "web",
        varName: "WEB_TAG_VER",
        imageTag: "20240912_134530_555ec24fbd2901217a9b38",
      },
      {
        name: "api",
        varName: "API_TAG_VER",
        imageTag: "20240912_134530_97555ec24fbd2901217a9b38",
      },
    ];

    it("should format with default configuration", () => {
      const result = formatHclOutput(testServices);
      const lines = result.split("\n");

      // Should include both TAG_VER and PULL_POLICY variables
      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain("WEB_TAG_VER");
      expect(lines[1]).toContain("API_TAG_VER");
      expect(lines[2]).toContain("WEB_PULL_POLICY");
      expect(lines[3]).toContain("API_PULL_POLICY");
    });

    it("should exclude pull policy when disabled", () => {
      const config: HclGenerationConfig = { includePullPolicy: false };
      const result = formatHclOutput(testServices, config);
      const lines = result.split("\n");

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("WEB_TAG_VER");
      expect(lines[1]).toContain("API_TAG_VER");
      expect(result).not.toContain("PULL_POLICY");
    });

    it("should use custom pull policy value", () => {
      const config: HclGenerationConfig = {
        includePullPolicy: true,
        defaultPullPolicy: "always",
      };
      const result = formatHclOutput(testServices, config);

      expect(result).toContain("WEB_PULL_POLICY");
      expect(result).toContain("API_PULL_POLICY");
      expect(result).toContain('"always"');
    });

    it("should disable alignment when configured", () => {
      const config: HclGenerationConfig = { alignVariables: false };
      const result = formatHclOutput(testServices, config);
      const lines = result.split("\n");

      // Without alignment, shorter names won't have padding
      expect(lines[0]).toBe('WEB_TAG_VER = "20240912_134530_555ec24fbd2901217a9b38"');
      expect(lines[1]).toBe('API_TAG_VER = "20240912_134530_97555ec24fbd2901217a9b38"');
    });
  });

  describe("validateHclConfig", () => {
    it("should validate valid configurations", () => {
      expect(validateHclConfig({})).toBe(true);
      expect(validateHclConfig({ includePullPolicy: true })).toBe(true);
      expect(validateHclConfig({ defaultPullPolicy: "never" })).toBe(true);
      expect(validateHclConfig({ alignVariables: false })).toBe(true);
    });

    it("should reject invalid configurations", () => {
      expect(validateHclConfig({ defaultPullPolicy: 123 as any })).toBe(false);
    });
  });

  describe("createHclConfig", () => {
    it("should create config with defaults", () => {
      const result = createHclConfig();
      expect(result).toEqual(DEFAULT_HCL_CONFIG);
    });

    it("should merge overrides with defaults", () => {
      const overrides = {
        includePullPolicy: false,
        defaultPullPolicy: "always",
      };
      const result = createHclConfig(overrides);
      expect(result).toEqual({
        ...DEFAULT_HCL_CONFIG,
        includePullPolicy: false,
        defaultPullPolicy: "always",
      });
    });

    it("should not mutate defaults", () => {
      const originalDefaults = { ...DEFAULT_HCL_CONFIG };
      createHclConfig({ includePullPolicy: false });
      expect(DEFAULT_HCL_CONFIG).toEqual(originalDefaults);
    });
  });

  describe("generateCalculatedHcl", () => {
    const mockLogger: Logger = {
      verbose: vi.fn(),
      logServiceProcessing: vi.fn(),
    } as any;

    const mockBuildHashInput = vi.fn().mockResolvedValue("mock-hash-input");

    const testConfig: DockerShaConfig = {
      project: {
        name: "test",
        context: ".",
        bake: ["docker-bake.hcl"],
        write: "docker-sha.hcl",
      },
      targets: {
        web: { calculate_on: { period: "hourly" } },
        api: { calculate_on: { always: true } },
      },
    };

    const testBakeTargets: Record<string, DockerBakeTarget> = {
      web: { dockerfile: "web/Dockerfile", tags: ["web:latest"] },
      api: { dockerfile: "api/Dockerfile", tags: ["api:latest"] },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should generate HCL for all services", async () => {
      const result = await generateCalculatedHcl(
        testConfig,
        testBakeTargets,
        ["web", "api"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(result.generatedServices).toHaveLength(2);
      expect(result.generatedServices[0].name).toBe("web");
      expect(result.generatedServices[0].varName).toBe("WEB_TAG_VER");
      expect(result.generatedServices[1].name).toBe("api");
      expect(result.generatedServices[1].varName).toBe("API_TAG_VER");

      expect(result.hclOutput).toContain("WEB_TAG_VER");
      expect(result.hclOutput).toContain("API_TAG_VER");
      expect(result.hclOutput).toContain("WEB_PULL_POLICY");
      expect(result.hclOutput).toContain("API_PULL_POLICY");
    });

    it("should skip services with skip_calculate", async () => {
      const configWithSkip: DockerShaConfig = {
        ...testConfig,
        targets: {
          ...testConfig.targets,
          web: { ...testConfig.targets.web, skip_calculate: true },
        },
      };

      const result = await generateCalculatedHcl(
        configWithSkip,
        testBakeTargets,
        ["web", "api"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(result.generatedServices).toHaveLength(1);
      expect(result.generatedServices[0].name).toBe("api");
    });

    it("should handle services not in bake targets", async () => {
      const result = await generateCalculatedHcl(
        testConfig,
        testBakeTargets,
        ["web", "api", "missing"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(result.generatedServices).toHaveLength(2);
      expect(result.generatedServices.map((s) => s.name)).toEqual(["web", "api"]);
    });

    it("should use custom HCL configuration", async () => {
      const customConfig: HclGenerationConfig = {
        includePullPolicy: false,
        alignVariables: false,
      };

      const result = await generateCalculatedHcl(
        testConfig,
        testBakeTargets,
        ["web"],
        "/project",
        mockLogger,
        mockBuildHashInput,
        customConfig,
      );

      expect(result.hclOutput).toContain("WEB_TAG_VER");
      expect(result.hclOutput).not.toContain("PULL_POLICY");
    });

    it("should handle invalid bake targets", async () => {
      const invalidBakeTargets = {
        web: null,
        api: "invalid-string",
        valid: { dockerfile: "valid/Dockerfile" },
      } as any;

      const result = await generateCalculatedHcl(
        testConfig,
        invalidBakeTargets,
        ["web", "api", "valid"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(result.generatedServices).toHaveLength(1);
      expect(result.generatedServices[0].name).toBe("valid");
    });

    it("should call buildHashInput for each service", async () => {
      await generateCalculatedHcl(
        testConfig,
        testBakeTargets,
        ["web", "api"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(mockBuildHashInput).toHaveBeenCalledTimes(2);
      expect(mockBuildHashInput).toHaveBeenCalledWith(
        testBakeTargets.web,
        testConfig.targets.web.calculate_on,
        expect.any(Map),
        "/project",
        mockLogger,
        "web",
      );
    });

    it("should log service processing", async () => {
      await generateCalculatedHcl(testConfig, testBakeTargets, ["web"], "/project", mockLogger, mockBuildHashInput);

      expect(mockLogger.logServiceProcessing).toHaveBeenCalledWith("web", "Processing service");
      expect(mockLogger.logServiceProcessing).toHaveBeenCalledWith(
        "web",
        "Generated (configured)",
        expect.stringContaining("WEB_TAG_VER"),
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle real-world service configurations", async () => {
      const mockLogger: Logger = {
        verbose: vi.fn(),
        logServiceProcessing: vi.fn(),
      } as any;

      const mockBuildHashInput = vi
        .fn()
        .mockResolvedValueOnce("frontend-hash-input")
        .mockResolvedValueOnce("backend-hash-input");

      const config: DockerShaConfig = {
        project: {
          name: "microservices",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          "web-frontend": {
            calculate_on: { period: { unit: "hours", number: 6 } },
          },
          "api-backend": { calculate_on: { always: true } },
        },
      };

      const bakeTargets: Record<string, DockerBakeTarget> = {
        "web-frontend": {
          dockerfile: "frontend/Dockerfile",
          tags: ["myapp/frontend:latest"],
        },
        "api-backend": {
          dockerfile: "backend/Dockerfile",
          tags: ["myapp/backend:latest"],
        },
      };

      const result = await generateCalculatedHcl(
        config,
        bakeTargets,
        ["web-frontend", "api-backend"],
        "/project",
        mockLogger,
        mockBuildHashInput,
      );

      expect(result.generatedServices).toHaveLength(2);
      expect(result.generatedServices[0].varName).toBe("WEB_FRONTEND_TAG_VER");
      expect(result.generatedServices[1].varName).toBe("API_BACKEND_TAG_VER");

      const lines = result.hclOutput.split("\n");
      expect(lines.some((line) => line.includes("WEB_FRONTEND_TAG_VER"))).toBe(true);
      expect(lines.some((line) => line.includes("API_BACKEND_TAG_VER"))).toBe(true);
      expect(lines.some((line) => line.includes("WEB_FRONTEND_PULL_POLICY"))).toBe(true);
      expect(lines.some((line) => line.includes("API_BACKEND_PULL_POLICY"))).toBe(true);
    });
  });
});
