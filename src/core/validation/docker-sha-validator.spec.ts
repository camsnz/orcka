import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dump } from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findDockerShaFile, validateDockerShaFile } from "./docker-sha-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, "../../tmp/test-files");

// Helper function to write YAML files
const writeYamlFile = (filePath: string, data: any) => {
  writeFileSync(filePath, dump(data));
};

// Helper function to ensure directory exists
const ensureDir = (dirPath: string) => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

// Helper to create a valid config for tests
const createValidDockerShaConfig = () => ({
  project: {
    name: "test-project",
    context: ".",
    write: "docker-bake.sha.hcl",
    bake: ["docker-bake.hcl"],
  },
  targets: {
    web: {
      calculate_on: {
        files: ["web/app.js"],
      },
    },
    api: {
      calculate_on: {
        always: true,
      },
    },
  },
});

const createValidBakeHcl = () => `
target "web" {
  dockerfile = "Dockerfile.web"
}
target "api" {
  dockerfile = "Dockerfile.api"
}
`;

describe("docker-sha-validator", () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("findDockerShaFile", () => {
    it("should find docker-orcka.yml", () => {
      const filePath = join(testDir, "docker-orcka.yml");
      writeYamlFile(filePath, createValidDockerShaConfig());
      const result = findDockerShaFile(testDir);
      expect(result).toBe(filePath);
    });

    it("should return null if no file found", () => {
      const result = findDockerShaFile(testDir);
      expect(result).toBeNull();
    });
  });

  describe("validateDockerShaFile", () => {
    it("should validate a correct docker-sha file", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      writeYamlFile(configPath, createValidDockerShaConfig());
      writeFileSync(bakePath, createValidBakeHcl());
      ensureDir(join(testDir, "web"));
      writeFileSync(join(testDir, "web/app.js"), "console.log('hello');");
      // Also create the api directory and file
      ensureDir(join(testDir, "api"));
      writeFileSync(join(testDir, "api/server.js"), "console.log('api');");

      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing project section", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      writeYamlFile(configPath, { targets: {} }); // Missing project
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Missing required 'project' section");
    });

    it("should detect missing targets section", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const config = createValidDockerShaConfig();
      delete (config as any).targets;
      writeYamlFile(configPath, config);
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Missing required 'targets' section");
    });

    it("should detect invalid period configuration", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const config = createValidDockerShaConfig();
      (config.targets.web.calculate_on as any).period = { unit: "invalid" };
      writeYamlFile(configPath, config);
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("has invalid period unit");
    });

    it("should detect missing bake file", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      writeYamlFile(configPath, createValidDockerShaConfig()); // docker-bake.hcl is not created
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Bake file not found");
    });

    it("should detect missing file in calculate_on.files", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      const config = createValidDockerShaConfig();
      writeYamlFile(configPath, config);
      writeFileSync(bakePath, createValidBakeHcl()); // web/app.js is not created
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("File not found: web/app.js");
    });

    it("should detect target in docker-sha.yml not in bake files", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      const config = createValidDockerShaConfig();
      config.targets["extra-target"] = {
        calculate_on: { files: ["extra.js"] },
      };
      writeYamlFile(configPath, config);
      writeFileSync(bakePath, createValidBakeHcl());
      // Create all required files to get past file existence checks
      ensureDir(join(testDir, "web"));
      writeFileSync(join(testDir, "web/app.js"), "console.log('hello');");
      writeFileSync(join(testDir, "extra.js"), "console.log('extra');");
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Target 'extra-target' not found");
    });

    it("should detect cyclic dependencies in bake files", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      const bakeHclContent = `target "web" {
  depends_on = ["api"]
}
target "api" {
  depends_on = ["web"]
}`;
      const shaConfig = createValidDockerShaConfig();
      shaConfig.targets.api = { calculate_on: { always: true } };
      writeYamlFile(configPath, shaConfig);
      writeFileSync(bakePath, bakeHclContent);
      // Create all required files to get past file existence checks
      ensureDir(join(testDir, "web"));
      writeFileSync(join(testDir, "web/app.js"), "console.log('hello');");
      const result = await validateDockerShaFile(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Cyclic dependency found");
    });
  });
});
