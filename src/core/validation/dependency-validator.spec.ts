import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DockerShaConfig } from "../../types.js";
import { validateDependencies } from "./dependency-validator.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe("dependency-validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateDependencies", () => {
    it("should return no errors when no targets use jq", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: { files: ["package.json"] },
          },
          api: {
            dockerfile: "api/Dockerfile",
            calculate_on: { period: "daily" },
          },
        },
      };

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should return no errors when jq is available and targets use jq", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: {
              jq: ".version",
              files: ["package.json"],
            },
          },
        },
      };

      // Mock jq being available
      mockExecSync.mockReturnValue(Buffer.from("/usr/bin/jq"));

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).toHaveBeenCalledWith("which jq", {
        stdio: "ignore",
      });
    });

    it("should return error when jq is not available but targets use jq", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: {
              jq: ".version",
              files: ["package.json"],
            },
          },
        },
      };

      // Mock jq not being available
      mockExecSync.mockImplementation(() => {
        throw new Error("Command not found");
      });

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([
        {
          type: "dependency",
          message: "jq command not found. Install jq to use jq-based calculate_on criteria.",
        },
      ]);
      expect(mockExecSync).toHaveBeenCalledWith("which jq", {
        stdio: "ignore",
      });
    });

    it("should return error when multiple targets use jq but jq is not available", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: {
              jq: ".version",
              files: ["package.json"],
            },
          },
          api: {
            dockerfile: "api/Dockerfile",
            calculate_on: {
              jq: ".dependencies | keys",
              files: ["package.json"],
            },
          },
        },
      };

      // Mock jq not being available
      mockExecSync.mockImplementation(() => {
        throw new Error("Command not found");
      });

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([
        {
          type: "dependency",
          message: "jq command not found. Install jq to use jq-based calculate_on criteria.",
        },
      ]);
      expect(mockExecSync).toHaveBeenCalledWith("which jq", {
        stdio: "ignore",
      });
    });

    it("should handle config with no targets", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {},
      };

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should handle config with undefined targets", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        // targets is undefined
      };

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should handle targets with no calculate_on", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            // No calculate_on
          },
        },
      };

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should handle targets with calculate_on but no jq", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: {
              files: ["package.json"],
              period: "daily",
              // No jq
            },
          },
        },
      };

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("should handle mixed targets - some with jq, some without", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          web: {
            dockerfile: "Dockerfile",
            calculate_on: {
              jq: ".version",
              files: ["package.json"],
            },
          },
          api: {
            dockerfile: "api/Dockerfile",
            calculate_on: {
              files: ["requirements.txt"],
              // No jq
            },
          },
        },
      };

      // Mock jq being available
      mockExecSync.mockReturnValue(Buffer.from("/usr/bin/jq"));

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).toHaveBeenCalledWith("which jq", {
        stdio: "ignore",
      });
    });
  });

  describe("integration scenarios", () => {
    it("should work with real-world configuration", () => {
      const config: DockerShaConfig = {
        project: {
          name: "my-app",
          context: ".",
        },
        targets: {
          frontend: {
            dockerfile: "frontend/Dockerfile",
            calculate_on: {
              files: ["frontend/package.json"],
              jq: ".dependencies",
            },
          },
          backend: {
            dockerfile: "backend/Dockerfile",
            calculate_on: {
              files: ["backend/requirements.txt"],
              period: "weekly",
            },
          },
        },
      };

      // Mock jq being available
      mockExecSync.mockReturnValue(Buffer.from("/opt/homebrew/bin/jq"));

      const errors = validateDependencies(config, "/app/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExecSync).toHaveBeenCalledOnce();
    });

    it("should provide helpful error message for missing jq", () => {
      const config: DockerShaConfig = {
        project: { name: "test" },
        targets: {
          processor: {
            dockerfile: "Dockerfile",
            calculate_on: {
              jq: ".data | length",
              files: ["data.json"],
            },
          },
        },
      };

      mockExecSync.mockImplementation(() => {
        const error = new Error("Command 'jq' not found");
        (error as { code?: number }).code = 127;
        throw error;
      });

      const errors = validateDependencies(config, "/test/docker-sha.yml");

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("dependency");
      expect(errors[0].message).toContain("jq command not found");
      expect(errors[0].message).toContain("Install jq");
    });
  });
});
