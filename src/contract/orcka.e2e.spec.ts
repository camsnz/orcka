import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, "../../tmp/e2e-test");
const orckaBin = join(__dirname, "../../bin/orcka.cjs");

describe("orcka e2e tests", () => {
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

  describe("orcka stat command", () => {
    it("should calculate tags and write HCL output for valid configuration", () => {
      const dockerShaYml = `
project:
  name: test-project
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
      period:
        unit: days
        number: 7
  api:
    calculate_on:
      period:
        unit: days
        number: 1
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}

variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
  depends_on = ["api"]
}

target "api" {
  dockerfile = "api/Dockerfile"
  tags = ["api:latest"]
}
`;

      writeFileSync(join(testDir, "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM node:18\nCOPY . .\nRUN corepack enable && pnpm install");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM node:18\nCOPY . .\nRUN corepack enable && pnpm install");
      writeFileSync(join(testDir, "web/app.js"), "console.log('web app');");

      const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
        cwd: testDir,
        encoding: "utf8",
      });

      expect(result).toContain("✅ Calculating targets:");
      expect(result).toContain("✅ Would write files:");
      expect(result).toContain("  • .orcka/docker-sha.hcl");
      expect(result).toMatch(/WEB_TAG_VER = "[a-f0-9_]+"/);
      expect(result).toMatch(/API_TAG_VER = "[a-f0-9_]+"/);

      const outputFile = join(testDir, ".orcka", "docker-sha.hcl");
      expect(existsSync(outputFile)).toBe(false);
    }, 60000);

    it("should fail with invalid configuration", () => {
      const invalidDockerShaYml = `
targets:
  web:
    calculate_on:
      files:
        - web/app.js
`;

      writeFileSync(join(testDir, "orcka.yml"), invalidDockerShaYml);

      expect(() => {
        execSync(`node ${orckaBin} stat --file orcka.yml`, {
          cwd: testDir,
          encoding: "utf8",
        });
      }).toThrow();
    });

    it("should calculate tags for services regardless of calculate_on criteria", () => {
      const dockerShaYml = `
project:
  name: test-project
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - web/app.js
      period:
        unit: days
        number: 7
  api: {}
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}

target "api" {
  dockerfile = "api/Dockerfile"
  tags = ["api:latest"]
}
`;

      writeFileSync(join(testDir, "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "web/app.js"), "console.log('web');");

      const result = execSync(`node ${orckaBin} stat --file orcka.yml`, {
        cwd: testDir,
        encoding: "utf8",
      });

      expect(result).toContain("✅ Calculating targets:");
      expect(result).toContain("✅ Would write files:");
      expect(result).toContain("  • .orcka/docker-sha.hcl");

      const hclPath = join(testDir, ".orcka", "docker-sha.hcl");
      expect(existsSync(hclPath)).toBe(false);
    }, 60000);
  });

  describe("orcka write command", () => {
    it("should generate override file with pull_policy overrides", () => {
      const dockerShaYml = `
project:
  name: override-test
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web: {}
  api: {}
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}
variable "API_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}

target "api" {
  dockerfile = "api/Dockerfile"
  tags = ["api:latest"]
}
`;

      writeFileSync(join(testDir, "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM node:18");
      writeFileSync(join(testDir, "api/Dockerfile"), "FROM node:18");

      execSync(`node ${orckaBin} write`, {
        cwd: testDir,
        encoding: "utf8",
      });

      const overridePath = join(testDir, ".orcka", "docker-compose.orcka.override.yml");
      expect(existsSync(overridePath)).toBe(true);

      const overrideContent = readFileSync(overridePath, "utf-8");
      expect(overrideContent).toContain("web:");
      expect(overrideContent).toContain("pull_policy: never");
      expect(overrideContent).toContain("api:");
    });

    it("should respect custom output path and pull_policy value", () => {
      const dockerShaYml = `
project:
  name: override-test
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  worker: {}
`;

      const dockerBakeHcl = `
variable "WORKER_TAG_VER" {
  default = ""
}

target "worker" {
  dockerfile = "web/Dockerfile"
  tags = ["worker:latest"]
}
`;

      writeFileSync(join(testDir, "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM node:18");

      execSync(`node ${orckaBin} write --output custom.yml --pull-policy always`, {
        cwd: testDir,
        encoding: "utf8",
      });

      const overridePath = join(testDir, "custom.yml");
      expect(existsSync(overridePath)).toBe(true);

      const overrideContent = readFileSync(overridePath, "utf-8");
      expect(overrideContent).toContain("pull_policy: always");
      expect(overrideContent).toContain("worker:");
    });
  });

  describe("orcka integration flow", () => {
    it("should run stat by default and emit guidance", () => {
      const dockerShaYml = `
project:
  name: default-test
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web: {}
`;

      const dockerBakeHcl = `
variable "WEB_TAG_VER" {
  default = ""
}

target "web" {
  dockerfile = "web/Dockerfile"
  tags = ["web:latest"]
}
`;

      writeFileSync(join(testDir, "orcka.yml"), dockerShaYml);
      writeFileSync(join(testDir, "docker-bake.hcl"), dockerBakeHcl);
      writeFileSync(join(testDir, "web/Dockerfile"), "FROM node:18");

      const result = execSync(`node ${orckaBin}`, {
        cwd: testDir,
        encoding: "utf8",
      });

      expect(result).toContain("Usage: orcka [command] [options]");
      expect(result).toContain("For command-specific help");
      expect(existsSync(join(testDir, ".orcka", "docker-sha.hcl"))).toBe(false);
    });
  });
});
