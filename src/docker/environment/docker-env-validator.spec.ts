import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockerEnvValidator, validateDockerEnvironment } from "./docker-env-validator.js";

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

describe("docker-env-validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DockerEnvValidator", () => {
    let validator: DockerEnvValidator;

    beforeEach(() => {
      validator = new DockerEnvValidator(mockLogger);
    });

    describe("constructor", () => {
      it("should create an instance with logger", () => {
        expect(validator).toBeInstanceOf(DockerEnvValidator);
      });

      it("should create an instance without logger", () => {
        const validatorWithoutLogger = new DockerEnvValidator();
        expect(validatorWithoutLogger).toBeInstanceOf(DockerEnvValidator);
      });
    });

    describe("validateEnvironment error handling", () => {
      it("should handle complete Docker environment failure", async () => {
        // Mock complete failure - all commands fail
        mockExecSync.mockImplementation(() => {
          const error = new Error("Docker not found");
          (error as any).code = 127;
          throw error;
        });

        const result = await validator.validateEnvironment();
        console.log("JSON buildx result", result);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.environment).toBeUndefined();
        expect(result.errors[0]).toContain("Failed to validate Docker environment");
      });

      it("should handle Docker version command failure", async () => {
        // Mock Docker version failure
        mockExecSync.mockImplementation((command) => {
          if (command.toString().includes("docker version")) {
            throw new Error("Docker version failed");
          }
          return "success";
        });

        const result = await validator.validateEnvironment();
        console.log("Plain buildx result", result);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should work without logger", async () => {
        const validatorWithoutLogger = new DockerEnvValidator();

        // Mock failure to test error path
        mockExecSync.mockImplementation(() => {
          throw new Error("Command failed");
        });

        const result = await validatorWithoutLogger.validateEnvironment();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe("integration scenarios", () => {
      it("should detect buildx using JSON formatted output", async () => {
        mockExecSync.mockImplementation((command) => {
          const cmd = command.toString();
          if (cmd.includes("docker version --format")) {
            return '{"Client":{"Version":"28.0.0","ApiVersion":"1.51"}}';
          }
          if (cmd.includes("docker info")) {
            return "Docker info success";
          }
          if (cmd.includes("docker buildx version --format")) {
            return '{"Version":"0.17.2","GitCommit":"abcdef123456"}';
          }
          if (cmd.includes("containerd --version")) {
            return "containerd github.com/containerd/containerd v1.6.24 61f9fd88f79f081d64d6fa3bb1a0dc71ec870523";
          }
          throw new Error(`Unexpected command: ${cmd}`);
        });

        const result = await validator.validateEnvironment();

        const commands = mockExecSync.mock.calls.map((call) => call[0].toString());
        expect(commands).toContain('docker buildx version --format "{{json .}}"');
        expect(result.environment?.buildx).toBeDefined();
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
        expect(result.environment?.buildx?.version).toBe("0.17.2");
        expect(result.environment?.buildxAvailable).toBe(true);
      });

      it("should detect buildx without v prefix when --format flag unsupported", async () => {
        mockExecSync.mockImplementation((command) => {
          const cmd = command.toString();
          if (cmd.includes("docker version --format")) {
            return '{"Client":{"Version":"28.0.0"}}';
          }
          if (cmd.includes("docker info")) {
            return "Docker info success";
          }
          if (cmd.includes("docker buildx version --format")) {
            const error = new Error("unknown flag: --format");
            (error as any).code = 1;
            throw error;
          }
          if (cmd.includes("docker buildx version") && !cmd.includes("--format")) {
            return "github.com/docker/buildx buildx 0.18.0 cafebabe\n";
          }
          if (cmd.includes("containerd --version")) {
            return "containerd github.com/containerd/containerd v1.6.18 deadbeefcafebabe";
          }
          throw new Error(`Unexpected command: ${cmd}`);
        });

        const result = await validator.validateEnvironment();

        const commands = mockExecSync.mock.calls.map((call) => call[0].toString());
        expect(commands).toContain('docker buildx version --format "{{json .}}"');
        expect(commands).toContain("docker buildx version");
        expect(result.environment?.buildx).toBeDefined();
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
        expect(result.environment?.buildx?.version).toBe("0.18.0");
        expect(result.environment?.buildxAvailable).toBe(true);
      });

      it("should handle malformed JSON from docker version", async () => {
        mockExecSync.mockImplementation((command) => {
          if (command.toString().includes("docker version")) {
            return "invalid json";
          }
          throw new Error("Command failed");
        });

        const result = await validator.validateEnvironment();

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should handle partial command success", async () => {
        mockExecSync.mockImplementation((command) => {
          const cmd = command.toString();
          if (cmd.includes("docker version")) {
            return '{"Client":{"Version":"24.0.0"}}';
          }
          if (cmd.includes("docker info")) {
            return "Docker info success";
          }
          // Other commands fail
          throw new Error("Command not found");
        });

        const result = await validator.validateEnvironment();

        // Should have some environment info but still fail due to missing buildx
        expect(result.environment?.docker.version).toBe("24.0.0");
        expect(result.environment?.dockerRunning).toBe(true);
        expect(result.valid).toBe(false); // Should fail due to missing buildx
      });
    });
  });

  describe("validateDockerEnvironment convenience function", () => {
    it("should create validator and call validateEnvironment", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Docker not available");
      });

      const result = await validateDockerEnvironment(mockLogger);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should work without logger", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Docker not available");
      });

      const result = await validateDockerEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("basic functionality", () => {
    it("should validate class instantiation", () => {
      const validator = new DockerEnvValidator(mockLogger);
      expect(validator).toBeInstanceOf(DockerEnvValidator);
    });

    it("should handle async validation method", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Test error");
      });

      const validator = new DockerEnvValidator();
      const result = await validator.validateEnvironment();

      expect(typeof result).toBe("object");
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
