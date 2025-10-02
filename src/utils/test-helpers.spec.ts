import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeYamlFile } from "./test-helpers.js";

describe("test-helpers", () => {
  const testDir = join(process.cwd(), "tmp", "test-helpers-spec");

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("writeYamlFile", () => {
    it("should write a simple object to YAML file", () => {
      const filePath = join(testDir, "simple.yml");
      const content = {
        name: "test",
        version: "1.0.0",
        enabled: true,
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("name: test");
      expect(fileContent).toContain("version: 1.0.0");
      expect(fileContent).toContain("enabled: true");
    });

    it("should write nested objects to YAML file", () => {
      const filePath = join(testDir, "nested.yml");
      const content = {
        project: {
          name: "orcka",
          config: {
            debug: false,
            timeout: 30,
          },
        },
        services: {
          web: {
            dockerfile: "Dockerfile.web",
            ports: [3000, 8080],
          },
        },
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("project:");
      expect(fileContent).toContain("name: orcka");
      expect(fileContent).toContain("config:");
      expect(fileContent).toContain("debug: false");
      expect(fileContent).toContain("services:");
      expect(fileContent).toContain("web:");
      expect(fileContent).toContain("dockerfile: Dockerfile.web");
    });

    it("should write arrays to YAML file", () => {
      const filePath = join(testDir, "arrays.yml");
      const content = {
        dependencies: ["typescript", "vitest", "yaml"],
        ports: [3000, 8080, 9000],
        features: [
          { name: "auth", enabled: true },
          { name: "logging", enabled: false },
        ],
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("dependencies:");
      expect(fileContent).toContain("- typescript");
      expect(fileContent).toContain("- vitest");
      expect(fileContent).toContain("- yaml");
      expect(fileContent).toContain("ports:");
      expect(fileContent).toContain("- 3000");
      expect(fileContent).toContain("features:");
      expect(fileContent).toContain("name: auth");
      expect(fileContent).toContain("enabled: true");
    });

    it("should handle empty objects", () => {
      const filePath = join(testDir, "empty.yml");
      const content = {};

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent.trim()).toBe("{}");
    });

    it("should handle special characters and strings", () => {
      const filePath = join(testDir, "special.yml");
      const content = {
        message: "Hello, World!",
        path: "/path/to/file",
        command: "echo 'test'",
        multiline: "Line 1\nLine 2\nLine 3",
        special: "Special chars: @#$%^&*()",
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("message: Hello, World!");
      expect(fileContent).toContain("path: /path/to/file");
      expect(fileContent).toContain("command: echo 'test'");
    });

    it("should handle null and undefined values", () => {
      const filePath = join(testDir, "nulls.yml");
      const content = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: "",
        zeroNumber: 0,
        falseBoolean: false,
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("nullValue: null");
      expect(fileContent).toContain('emptyString: ""');
      expect(fileContent).toContain("zeroNumber: 0");
      expect(fileContent).toContain("falseBoolean: false");
      // undefined values are typically omitted in YAML
      expect(fileContent).not.toContain("undefinedValue");
    });

    it("should create parent directories if they don't exist", () => {
      const nestedPath = join(testDir, "deep", "nested", "path");
      const filePath = join(nestedPath, "test.yml");
      const content = { test: "value" };

      // Ensure parent directory doesn't exist
      expect(existsSync(nestedPath)).toBe(false);

      // This should create the parent directories
      mkdirSync(nestedPath, { recursive: true });
      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("test: value");
    });

    it("should overwrite existing files", () => {
      const filePath = join(testDir, "overwrite.yml");
      const initialContent = { initial: "value" };
      const newContent = { updated: "value", added: true };

      // Write initial content
      writeYamlFile(filePath, initialContent);
      expect(existsSync(filePath)).toBe(true);
      let fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("initial: value");

      // Overwrite with new content
      writeYamlFile(filePath, newContent);
      fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("updated: value");
      expect(fileContent).toContain("added: true");
      expect(fileContent).not.toContain("initial: value");
    });

    it("should handle docker-sha.yml structure", () => {
      const filePath = join(testDir, "docker-sha.yml");
      const content = {
        project: {
          name: "test-project",
          write: {
            hcl: "docker-sha.hcl",
          },
        },
        services: {
          web: {
            dockerfile: "Dockerfile.web",
            rebuild: {
              period: {
                unit: "days",
                number: 7,
              },
              files: ["package.json", "src/**/*.ts"],
            },
          },
          api: {
            dockerfile: "Dockerfile.api",
            resolves: ["database"],
            rebuild: {
              always: true,
            },
          },
        },
      };

      writeYamlFile(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      const fileContent = readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("project:");
      expect(fileContent).toContain("name: test-project");
      expect(fileContent).toContain("services:");
      expect(fileContent).toContain("web:");
      expect(fileContent).toContain("dockerfile: Dockerfile.web");
      expect(fileContent).toContain("rebuild:");
      expect(fileContent).toContain("period:");
      expect(fileContent).toContain("unit: days");
      expect(fileContent).toContain("number: 7");
      expect(fileContent).toContain("always: true");
    });
  });
});
