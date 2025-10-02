/**
 * Tests for DOT file generation utilities
 */

import { existsSync, mkdtempSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DependencyTree } from "../../core/dependencies/dependency-calculator.js";
import type { DockerShaCalculateOnConfig, DockerShaConfig } from "../../types.js";
import {
  buildDependencyMap,
  createDotConfig,
  DEFAULT_DOT_CONFIG,
  type DotFileConfig,
  extractRebuildCriteria,
  formatPeriodCriteria,
  generateDependencyEdges,
  generateDotFile,
  generateNodeDefinition,
  validateDotConfig,
} from "./dot-file-generator.js";

describe("dot-file-generator", () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dot-test-"));
    testFilePath = join(tempDir, "test.dot");
  });

  afterEach(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  describe("extractRebuildCriteria", () => {
    it("should return empty array for undefined calculateOn", () => {
      const result = extractRebuildCriteria(undefined);
      expect(result).toEqual([]);
    });

    it("should extract always criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = { always: true };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["always"]);
    });

    it("should extract string period criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = { period: "hourly" };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["hourly"]);
    });

    it("should extract object period criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = {
        period: { unit: "hours", number: 2 },
      };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["2 hours"]);
    });

    it("should extract files criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = {
        files: ["package.json", "yarn.lock"],
      };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["2 files"]);
    });

    it("should extract jq criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = {
        jq: { filename: "config.json", selector: ".version" },
      };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["jq"]);
    });

    it("should extract multiple criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = {
        always: true,
        period: "weekly",
        files: ["package.json"],
        jq: { filename: "config.json", selector: ".version" },
      };
      const result = extractRebuildCriteria(calculateOn);
      expect(result).toEqual(["always", "weekly", "1 files", "jq"]);
    });
  });

  describe("formatPeriodCriteria", () => {
    it("should format string periods", () => {
      expect(formatPeriodCriteria("hourly")).toBe("hourly");
      expect(formatPeriodCriteria("weekly")).toBe("weekly");
      expect(formatPeriodCriteria("monthly")).toBe("monthly");
    });

    it("should format object periods with number", () => {
      expect(formatPeriodCriteria({ unit: "hours", number: 2 })).toBe("2 hours");
      expect(formatPeriodCriteria({ unit: "days", number: 7 })).toBe("7 days");
    });

    it("should format none period", () => {
      expect(formatPeriodCriteria({ unit: "none" })).toBe("none");
    });

    it("should handle unknown period formats", () => {
      expect(formatPeriodCriteria({} as any)).toBe("unknown");
    });
  });

  describe("generateNodeDefinition", () => {
    it("should generate basic node definition", () => {
      const result = generateNodeDefinition("web", undefined);
      expect(result).toBe('  "web" [label="web", fillcolor=lightblue];');
    });

    it("should generate node with always rebuild", () => {
      const calculateOn: DockerShaCalculateOnConfig = { always: true };
      const result = generateNodeDefinition("web", calculateOn);
      expect(result).toBe('  "web" [label="web\\n(always)", fillcolor=lightcoral];');
    });

    it("should generate node with multiple criteria", () => {
      const calculateOn: DockerShaCalculateOnConfig = {
        period: "hourly",
        files: ["package.json"],
      };
      const result = generateNodeDefinition("web", calculateOn);
      expect(result).toBe('  "web" [label="web\\n(hourly, 1 files)", fillcolor=lightblue];');
    });

    it("should use custom config", () => {
      const config: DotFileConfig = {
        alwaysColor: "red",
        defaultColor: "green",
      };
      const calculateOn: DockerShaCalculateOnConfig = { always: true };
      const result = generateNodeDefinition("web", calculateOn, config);
      expect(result).toBe('  "web" [label="web\\n(always)", fillcolor=red];');
    });
  });

  describe("generateDependencyEdges", () => {
    it("should generate edges from dependency tree", () => {
      const dependencyTree: DependencyTree = {
        nodes: new Map([
          ["web", { dependencies: ["api", "database"] }],
          ["api", { dependencies: ["database"] }],
          ["database", { dependencies: [] }],
        ]),
      };

      const result = generateDependencyEdges(dependencyTree);
      expect(result).toEqual(['  "api" -> "web";', '  "database" -> "web";', '  "database" -> "api";']);
    });

    it("should handle empty dependency tree", () => {
      const dependencyTree: DependencyTree = { nodes: new Map() };
      const result = generateDependencyEdges(dependencyTree);
      expect(result).toEqual([]);
    });

    it("should handle services with no dependencies", () => {
      const dependencyTree: DependencyTree = {
        nodes: new Map([
          ["web", { dependencies: [] }],
          ["api", { dependencies: [] }],
        ]),
      };

      const result = generateDependencyEdges(dependencyTree);
      expect(result).toEqual([]);
    });
  });

  describe("buildDependencyMap", () => {
    it("should convert dependency tree to map", () => {
      const dependencyTree: DependencyTree = {
        nodes: new Map([
          ["web", { dependencies: ["api", "database"] }],
          ["api", { dependencies: ["database"] }],
          ["database", { dependencies: [] }],
        ]),
      };

      const result = buildDependencyMap(dependencyTree);
      expect(result).toEqual({
        web: ["api", "database"],
        api: ["database"],
        database: [],
      });
    });

    it("should handle empty dependency tree", () => {
      const dependencyTree: DependencyTree = { nodes: new Map() };
      const result = buildDependencyMap(dependencyTree);
      expect(result).toEqual({});
    });
  });

  describe("validateDotConfig", () => {
    it("should validate valid configurations", () => {
      expect(validateDotConfig({})).toBe(true);
      expect(validateDotConfig({ rankDirection: "LR" })).toBe(true);
      expect(validateDotConfig({ rankDirection: "TB" })).toBe(true);
      expect(validateDotConfig({ rankDirection: "RL" })).toBe(true);
      expect(validateDotConfig({ rankDirection: "BT" })).toBe(true);
    });

    it("should reject invalid rank directions", () => {
      expect(validateDotConfig({ rankDirection: "INVALID" as any })).toBe(false);
      expect(validateDotConfig({ rankDirection: "lr" as any })).toBe(false);
    });

    it("should validate other properties", () => {
      expect(
        validateDotConfig({
          nodeShape: "circle",
          nodeStyle: "filled",
          alwaysColor: "red",
          defaultColor: "blue",
        }),
      ).toBe(true);
    });
  });

  describe("createDotConfig", () => {
    it("should create config with defaults", () => {
      const result = createDotConfig();
      expect(result).toEqual(DEFAULT_DOT_CONFIG);
    });

    it("should merge overrides with defaults", () => {
      const overrides = { rankDirection: "TB" as const, alwaysColor: "red" };
      const result = createDotConfig(overrides);
      expect(result).toEqual({
        ...DEFAULT_DOT_CONFIG,
        rankDirection: "TB",
        alwaysColor: "red",
      });
    });

    it("should not mutate defaults", () => {
      const originalDefaults = { ...DEFAULT_DOT_CONFIG };
      createDotConfig({ rankDirection: "TB" });
      expect(DEFAULT_DOT_CONFIG).toEqual(originalDefaults);
    });
  });

  describe("generateDotFile", () => {
    it("should generate complete DOT file", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          web: { calculate_on: { always: true } },
          api: { calculate_on: { period: "hourly" } },
          database: {},
        },
      };

      const dependencyTree: DependencyTree = {
        nodes: new Map([
          ["web", { dependencies: ["api"] }],
          ["api", { dependencies: ["database"] }],
          ["database", { dependencies: [] }],
        ]),
      };

      generateDotFile(config, dependencyTree, testFilePath);

      expect(existsSync(testFilePath)).toBe(true);
      const content = readFileSync(testFilePath, "utf8");

      // Check structure
      expect(content).toContain("digraph ServiceDependencies {");
      expect(content).toContain("rankdir=LR;");
      expect(content).toContain('node [shape=box, style="rounded,filled"];');
      expect(content).toContain("}");

      // Check nodes
      expect(content).toContain('"web" [label="web\\n(always)", fillcolor=lightcoral];');
      expect(content).toContain('"api" [label="api\\n(hourly)", fillcolor=lightblue];');
      expect(content).toContain('"database" [label="database", fillcolor=lightblue];');

      // Check edges
      expect(content).toContain('"api" -> "web";');
      expect(content).toContain('"database" -> "api";');
    });

    it("should use custom DOT configuration", () => {
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

      const dependencyTree: DependencyTree = {
        nodes: new Map([["web", { dependencies: [] }]]),
      };

      const dotConfig: DotFileConfig = {
        rankDirection: "TB",
        nodeShape: "circle",
        alwaysColor: "red",
      };

      generateDotFile(config, dependencyTree, testFilePath, dotConfig);

      const content = readFileSync(testFilePath, "utf8");
      expect(content).toContain("rankdir=TB;");
      expect(content).toContain("node [shape=circle,");
      expect(content).toContain("fillcolor=red];");
    });

    it("should handle empty configuration", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {},
      };

      const dependencyTree: DependencyTree = { nodes: new Map() };

      generateDotFile(config, dependencyTree, testFilePath);

      expect(existsSync(testFilePath)).toBe(true);
      const content = readFileSync(testFilePath, "utf8");

      // Should still have basic structure
      expect(content).toContain("digraph ServiceDependencies {");
      expect(content).toContain("}");

      // Should not have any nodes or edges
      expect(content).not.toContain(" -> ");
      expect(content).not.toContain("[label=");
    });

    it("should handle complex rebuild criteria", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          complex: {
            calculate_on: {
              period: { unit: "hours", number: 6 },
              files: ["package.json", "yarn.lock", "Dockerfile"],
              jq: { filename: "config.json", selector: ".version" },
            },
          },
        },
      };

      const dependencyTree: DependencyTree = {
        nodes: new Map([["complex", { dependencies: [] }]]),
      };

      generateDotFile(config, dependencyTree, testFilePath);

      const content = readFileSync(testFilePath, "utf8");
      expect(content).toContain('"complex" [label="complex\\n(6 hours, 3 files, jq)", fillcolor=lightblue];');
    });
  });

  describe("integration scenarios", () => {
    it("should work with real-world dependency structures", () => {
      const config: DockerShaConfig = {
        project: {
          name: "microservices",
          context: ".",
          bake: ["docker-bake.hcl"],
          write: "docker-sha.hcl",
        },
        targets: {
          frontend: { calculate_on: { files: ["package.json"] } },
          "api-gateway": { calculate_on: { period: "hourly" } },
          "user-service": { calculate_on: { always: true } },
          "auth-service": {
            calculate_on: { period: { unit: "minutes", number: 30 } },
          },
          database: {},
        },
      };

      const dependencyTree: DependencyTree = {
        nodes: new Map([
          ["frontend", { dependencies: ["api-gateway"] }],
          ["api-gateway", { dependencies: ["user-service", "auth-service"] }],
          ["user-service", { dependencies: ["database"] }],
          ["auth-service", { dependencies: ["database"] }],
          ["database", { dependencies: [] }],
        ]),
      };

      generateDotFile(config, dependencyTree, testFilePath);

      expect(existsSync(testFilePath)).toBe(true);
      const content = readFileSync(testFilePath, "utf8");

      // Verify all services are present
      expect(content).toContain('"frontend"');
      expect(content).toContain('"api-gateway"');
      expect(content).toContain('"user-service"');
      expect(content).toContain('"auth-service"');
      expect(content).toContain('"database"');

      // Verify dependency relationships
      expect(content).toContain('"api-gateway" -> "frontend";');
      expect(content).toContain('"user-service" -> "api-gateway";');
      expect(content).toContain('"auth-service" -> "api-gateway";');
      expect(content).toContain('"database" -> "user-service";');
      expect(content).toContain('"database" -> "auth-service";');

      // Verify criteria are displayed
      expect(content).toContain("(1 files)");
      expect(content).toContain("(hourly)");
      expect(content).toContain("(always)");
      expect(content).toContain("(30 minutes)");
    });
  });
});
