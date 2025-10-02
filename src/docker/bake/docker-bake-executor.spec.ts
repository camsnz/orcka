import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as yamlParse } from "yaml";
import type { DockerShaConfig } from "@/types.js";
import { DockerBakeExecutor } from "./docker-bake-executor.js";

// Mock node modules
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

// Mock logger
const mockLogger = {
  verbose: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  logServiceSummary: vi.fn(),
  logServiceProcessing: vi.fn(),
  updateOptions: vi.fn(),
} as any;

describe("docker-bake-executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DockerBakeExecutor", () => {
    let executor: DockerBakeExecutor;

    beforeEach(() => {
      executor = new DockerBakeExecutor(mockLogger);
    });

    describe("constructor", () => {
      it("should create an instance with logger", () => {
        expect(executor).toBeInstanceOf(DockerBakeExecutor);
      });
    });

    describe("checkBakeAvailability", () => {
      it("should return available when docker buildx bake works", async () => {
        mockExecSync.mockReturnValue(Buffer.from("Docker buildx bake help"));

        const result = await DockerBakeExecutor.checkBakeAvailability();

        expect(result.available).toBe(true);
        expect(result.error).toBeUndefined();
        expect(mockExecSync).toHaveBeenCalledWith(
          "docker buildx bake --help",
          expect.objectContaining({
            stdio: "pipe",
            timeout: 5000,
          }),
        );
      });

      it("should return unavailable when docker buildx bake fails", async () => {
        mockExecSync.mockImplementation(() => {
          throw new Error("Command not found");
        });

        const result = await DockerBakeExecutor.checkBakeAvailability();

        expect(result.available).toBe(false);
        expect(result.error).toContain("docker buildx bake not available");
        expect(result.error).toContain("Command not found");
      });

      it("should handle non-Error exceptions", async () => {
        mockExecSync.mockImplementation(() => {
          throw "String error";
        });

        const result = await DockerBakeExecutor.checkBakeAvailability();

        expect(result.available).toBe(false);
        expect(result.error).toContain("String error");
      });
    });

    describe("executeBake error handling", () => {
      it("should handle config file not found", async () => {
        const result = await executor.executeBake({
          configFile: "nonexistent.yaml",
        });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.error).toContain("Configuration file not found");
      });

      it("should handle HCL config files", async () => {
        const result = await executor.executeBake({
          configFile: "orcka.hcl",
        });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(1);
        // The function checks for file existence first, so we expect file not found
        expect(result.error).toContain("Configuration file not found");
      });

      it("should handle general execution errors", async () => {
        const result = await executor.executeBake({
          configFile: "invalid-path",
        });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.error).toContain("Failed to execute bake");
      });
    });
  });

  describe("integration tests", () => {
    it("should validate basic class functionality", () => {
      const executor = new DockerBakeExecutor(mockLogger);
      expect(executor).toBeInstanceOf(DockerBakeExecutor);
    });

    it("should handle static method calls", async () => {
      mockExecSync.mockReturnValue(Buffer.from("help text"));

      const result = await DockerBakeExecutor.checkBakeAvailability();

      expect(result.available).toBe(true);
      expect(mockExecSync).toHaveBeenCalled();
    });

    it("resolves bake and tags files relative to project context", () => {
      const executor = new DockerBakeExecutor(mockLogger);
      const tempDir = mkdtempSync(join(tmpdir(), "orcka-bake-"));
      const configPath = join(tempDir, "docker-sha.yml");
      const bakePath = join(tempDir, "docker-bake.hcl");
      const orckaDir = join(tempDir, ".orcka");
      const tagsPath = join(orckaDir, "docker-orcka.tags.hcl");

      mkdirSync(orckaDir, { recursive: true });
      writeFileSync(
        configPath,
        `project:\n  name: demo\n  context: .\n  write: docker-orcka.tags.hcl\n  bake:\n    - docker-bake.hcl\ntargets: {}\n`,
        "utf-8",
      );
      writeFileSync(bakePath, 'target "demo" {}\n', "utf-8");
      writeFileSync(tagsPath, 'variable "DEMO_TAG_VER" { default = "" }\n', "utf-8");

      try {
        const config = yamlParse(readFileSync(configPath, "utf-8")) as DockerShaConfig;
        const command = (
          executor as unknown as {
            buildBakeCommand(parsed: DockerShaConfig, options: { configFile: string }): string[];
          }
        ).buildBakeCommand(config, { configFile: configPath });

        expect(command).toContain("--file");
        expect(command).toContain(bakePath);
        expect(command).toContain(tagsPath);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
