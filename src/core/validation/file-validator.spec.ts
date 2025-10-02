import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DockerBakeConfig, DockerShaConfig } from "../../types.js";
import { validateFileExistence } from "./file-validator.js";

// Mock fs and path modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:path", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    resolve: vi.fn(),
    dirname: vi.fn(),
  };
});

const mockExistsSync = vi.mocked(existsSync);
const mockResolve = vi.mocked(resolve);
const mockDirname = vi.mocked(dirname);

describe("file-validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock dirname to return the parent directory
    mockDirname.mockImplementation((path) => {
      const parts = path.split("/");
      return parts.slice(0, -1).join("/") || "/";
    });

    // Mock resolve to properly handle path resolution
    mockResolve.mockImplementation((...args) => {
      if (args.length === 1) return args[0];

      let result = args[0];
      for (let i = 1; i < args.length; i++) {
        const segment = args[i];
        if (segment === ".") {
        } else if (segment === "..") {
          // Parent directory
          const parts = result.split("/");
          result = parts.slice(0, -1).join("/") || "/";
        } else if (segment.startsWith("/")) {
          // Absolute path - replace result
          result = segment;
        } else {
          // Relative path - append
          result = result.endsWith("/") ? result + segment : `${result}/${segment}`;
        }
      }
      return result;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateFileExistence", () => {
    it("should return no errors when all files exist", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["package.json", "yarn.lock"],
            },
          },
        },
      };

      // Mock all files exist
      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledWith("/test/docker-bake.hcl");
    });

    it("should detect missing bake files", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl", "missing-bake.hcl"],
        },
        targets: {},
      };

      // Mock first file exists, second doesn't
      mockExistsSync.mockImplementation((path) => {
        return !path.toString().includes("missing-bake.hcl");
      });

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: "file",
        message: "Bake file not found: missing-bake.hcl",
        path: "/test/missing-bake.hcl",
      });
    });

    it("should detect missing calculate_on files", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["package.json", "missing-file.txt"],
            },
          },
        },
      };

      // Mock bake file exists, package.json exists, missing-file.txt doesn't
      mockExistsSync.mockImplementation((path) => {
        return !path.toString().includes("missing-file.txt");
      });

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: "file",
        target: "web",
        message: "File not found: missing-file.txt",
        path: expect.any(String),
      });
    });

    it("should handle multiple missing files across targets", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["missing-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["missing-web.json"],
            },
          },
          api: {
            calculate_on: {
              files: ["missing-api.json", "also-missing.txt"],
            },
          },
        },
      };

      // Mock all files don't exist
      mockExistsSync.mockReturnValue(false);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toHaveLength(4); // 1 bake + 1 web + 2 api files

      // Check bake file error
      expect(errors[0]).toEqual({
        type: "file",
        message: "Bake file not found: missing-bake.hcl",
        path: "/test/missing-bake.hcl",
      });

      // Check web target error
      expect(errors[1]).toEqual({
        type: "file",
        target: "web",
        message: "File not found: missing-web.json",
        path: expect.any(String),
      });

      // Check api target errors
      expect(errors[2]).toEqual({
        type: "file",
        target: "api",
        message: "File not found: missing-api.json",
        path: expect.any(String),
      });

      expect(errors[3]).toEqual({
        type: "file",
        target: "api",
        message: "File not found: also-missing.txt",
        path: expect.any(String),
      });
    });

    it("should handle config without project.bake", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: [],
          // Empty bake array instead of missing
        },
        targets: {
          web: {
            calculate_on: {
              files: ["package.json"],
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("should handle config without targets", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        // No targets field
      } as DockerShaConfig;

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledWith("/test/docker-bake.hcl");
    });

    it("should handle targets without calculate_on", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {},
            // Empty calculate_on
          },
          api: {
            calculate_on: {
              files: ["requirements.txt"],
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("should handle targets with calculate_on but no files", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              period: "hourly",
              // No files
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("should handle empty bake array", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: [], // Empty array
        },
        targets: {},
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("should handle empty files array", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: [], // Empty array
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
    });

    it("should work with bakeConfigs parameter", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["package.json"],
            },
          },
        },
      };

      const bakeConfigs = new Map<string, DockerBakeConfig>();
      bakeConfigs.set("docker-bake.hcl", {
        target: {
          web: {
            dockerfile: "Dockerfile",
          },
        },
      });

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml", bakeConfigs);

      expect(errors).toEqual([]);
    });

    it("should use ContextResolver for file path resolution", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["docker-bake.hcl"],
        },
        targets: {
          web: {
            context_of: "dockerfile",
            calculate_on: {
              files: ["package.json"],
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);

      const errors = validateFileExistence(config, "/test/docker-sha.yml");

      expect(errors).toEqual([]);
      // Should call resolve for both bake file and target file
      expect(mockResolve).toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle real-world configuration with mixed file states", () => {
      const config: DockerShaConfig = {
        project: {
          name: "multi-service-app",
          context: ".",
          write: "generated/docker-tags.hcl",
          bake: ["docker-bake.hcl", "docker-bake.override.hcl"],
        },
        targets: {
          frontend: {
            calculate_on: {
              files: ["frontend/package.json", "frontend/yarn.lock"],
            },
          },
          backend: {
            calculate_on: {
              files: ["backend/requirements.txt", "backend/missing.txt"],
            },
          },
          worker: {
            calculate_on: {
              period: "hourly",
              // No files to check
            },
          },
        },
      };

      // Mock: first bake exists, second doesn't; frontend files exist, one backend file missing
      mockExistsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        return !pathStr.includes("override.hcl") && !pathStr.includes("missing.txt");
      });

      const errors = validateFileExistence(config, "/app/docker-sha.yml");

      expect(errors).toHaveLength(2);

      // Should find missing bake file
      expect(errors.some((e) => e.message.includes("docker-bake.override.hcl"))).toBe(true);

      // Should find missing backend file
      expect(errors.some((e) => e.target === "backend" && e.message.includes("missing.txt"))).toBe(true);
    });

    it("should handle absolute and relative path resolution correctly", () => {
      const config: DockerShaConfig = {
        project: {
          name: "test-project",
          write: "output.hcl",
          bake: ["../shared/docker-bake.hcl"],
        },
        targets: {
          web: {
            calculate_on: {
              files: ["./src/package.json"],
            },
          },
        },
      };

      mockExistsSync.mockReturnValue(true);
      mockResolve.mockImplementation((base, relative) => `${base}/${relative}`);

      const errors = validateFileExistence(config, "/project/docker-sha.yml");

      expect(errors).toEqual([]);
      expect(mockResolve).toHaveBeenCalled();
    });
  });
});
