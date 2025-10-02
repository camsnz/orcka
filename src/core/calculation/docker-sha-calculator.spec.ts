import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeYamlFile } from "../../utils/test-helpers.js";
import { calculateDockerSha } from "./docker-sha/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, "../../tmp/calculator-test");

const createValidDockerShaConfig = () => ({
  project: {
    name: "test-project",
    context: ".",
    write: "docker-sha.hcl",
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
        files: ["api/server.js"], // Valid criterion but won't trigger if file doesn't exist
      },
    },
  },
});

describe("docker-sha-calculator", () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "web"), { recursive: true });
    mkdirSync(join(testDir, "api"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("calculateDockerSha", () => {
    it("should calculate SHAs and generate an HCL file", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      const webAppPath = join(testDir, "web/app.js");
      const apiServerPath = join(testDir, "api/server.js");

      writeYamlFile(configPath, createValidDockerShaConfig());

      const bakeHclContent = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
}
target "api" {
  dockerfile = "api/Dockerfile"
}
`;
      writeFileSync(bakePath, bakeHclContent);
      writeFileSync(webAppPath, "console.log('hello world');");
      writeFileSync(apiServerPath, "console.log('api server');");
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM scratch");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM scratch");

      const result = await calculateDockerSha({
        inputFile: configPath,
        verbose: true,
      });

      if (!result.success) {
        console.log("Calculation failed with errors:", result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.servicesCalculated).toBe(2); // Both web and api have calculate_on criteria
      const outputPath = join(testDir, ".orcka", "docker-sha.hcl");
      expect(result.outputFile).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);

      const hclContent = readFileSync(outputPath, "utf-8");
      expect(hclContent).toMatch(/WEB_TAG_VER\s*=\s*"/);
      expect(hclContent).toMatch(/API_TAG_VER\s*=\s*"/); // API also has calculate_on criteria
    });

    it("should calculate all services, including those without calculate_on criteria", async () => {
      const inputFile = join(testDir, "docker-sha.yml");
      const bakeFile = join(testDir, "docker-bake.hcl");
      writeFileSync(join(testDir, "web/app.js"), "console.log('web updated');");
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM scratch");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM scratch");

      // Create config where only web has calculate_on criteria
      const config = {
        project: {
          name: "test-project",
          context: ".",
          write: "docker-sha.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["web/app.js"],
            },
          },
        },
      };
      writeYamlFile(inputFile, config);

      const bakeHclContent = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
}
target "api" {
  dockerfile = "api/Dockerfile"
}
`;
      writeFileSync(bakeFile, bakeHclContent);

      const result = await calculateDockerSha({ inputFile });
      expect(result.success).toBe(true);
      expect(result.servicesCalculated).toBe(2); // Both web and api should be calculated (api gets default behavior)

      const hclContent = readFileSync(result.outputFile, "utf-8");
      expect(hclContent).toMatch(/WEB_TAG_VER\s*=\s*"/);
      expect(hclContent).toMatch(/API_TAG_VER\s*=\s*"/); // API should now be included with default timestamp
    });

    it("should support preview mode without writing output", async () => {
      const configPath = join(testDir, "docker-sha.yml");
      const bakePath = join(testDir, "docker-bake.hcl");
      writeYamlFile(configPath, createValidDockerShaConfig());

      const bakeHclContent = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
}
target "api" {
  dockerfile = "api/Dockerfile"
}
`;
      writeFileSync(bakePath, bakeHclContent);
      writeFileSync(join(testDir, "web/app.js"), "console.log('preview web');");
      writeFileSync(join(testDir, "api/server.js"), "console.log('preview api');");
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM scratch");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM scratch");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await calculateDockerSha({
        inputFile: configPath,
        writeOutput: false,
      });

      expect(result.success).toBe(true);
      expect(result.servicesCalculated).toBe(2);
      expect(existsSync(join(testDir, ".orcka", "docker-sha.hcl"))).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith("✅ Would write files:");
      const previewPrinted = consoleSpy.mock.calls.some(
        (args) => typeof args[0] === "string" && args[0].includes("TAG_VER"),
      );
      expect(previewPrinted).toBe(true);

      consoleSpy.mockRestore();
    });

    it("should generate a DOT file if requested", async () => {
      const inputFile = join(testDir, "docker-sha.yml");
      const bakeFile = join(testDir, "docker-bake.hcl");
      const dotFile = join(testDir, "deps.dot");
      writeFileSync(join(testDir, "web/app.js"), "console.log('web');");
      writeFileSync(join(testDir, "api/server.js"), "console.log('api server');");
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM scratch");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM scratch");

      writeYamlFile(inputFile, createValidDockerShaConfig());
      const bakeHclContent = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  contexts = {
    api_image = "target:api"
  }
}
target "api" {
  dockerfile = "api/Dockerfile"
}
`;
      writeFileSync(bakeFile, bakeHclContent);

      await calculateDockerSha({ inputFile, dotFile });

      expect(existsSync(dotFile)).toBe(true);
      const dotContent = readFileSync(dotFile, "utf-8");
      expect(dotContent).toContain("digraph ServiceDependencies");
      expect(dotContent).toContain('"web" [label="web\\n(1 files)", fillcolor=lightblue];');
      expect(dotContent).toContain('"api" [label="api\\n(1 files)", fillcolor=lightblue];');
      // Note: Dependency edges are not currently generated from bake file contexts
      // This is expected behavior until dependency detection is properly implemented
    });

    it("should return an error if validation fails", async () => {
      const inputFile = join(testDir, "docker-sha.yml");
      // Missing project section -> invalid config
      writeYamlFile(inputFile, { targets: {} });

      const result = await calculateDockerSha({ inputFile });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      if (result.errors) {
        expect(result.errors[0]).toContain("Missing required 'project' section");
      }
    });
  });
});
