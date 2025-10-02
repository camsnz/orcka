import { beforeEach, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  analyzeRegistries,
  checkImageLocal,
  checkRegistryAccessibility,
  checkRegistryAuth,
  formatRegistryStatus,
  parseRegistryFromImage,
} from "./registry-analyzer";

// Mock node modules
vi.mock("node:child_process");
vi.mock("node:fs");

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe("registry-analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseRegistryFromImage", () => {
    it("should parse Docker Hub from official images", () => {
      expect(parseRegistryFromImage("nginx:latest")).toBe("docker.io");
      expect(parseRegistryFromImage("redis")).toBe("docker.io");
      expect(parseRegistryFromImage("postgres:13")).toBe("docker.io");
    });

    it("should parse Docker Hub from user/repo format", () => {
      expect(parseRegistryFromImage("myuser/myapp:v1")).toBe("docker.io");
      expect(parseRegistryFromImage("company/service:latest")).toBe("docker.io");
    });

    it("should parse explicit Docker Hub registry", () => {
      expect(parseRegistryFromImage("docker.io/library/nginx:latest")).toBe("docker.io");
      expect(parseRegistryFromImage("docker.io/user/app:tag")).toBe("docker.io");
    });

    it("should parse GitHub Container Registry", () => {
      expect(parseRegistryFromImage("ghcr.io/owner/repo:tag")).toBe("ghcr.io");
      expect(parseRegistryFromImage("ghcr.io/org/project/image:v1")).toBe("ghcr.io");
    });

    it("should parse Google Container Registry", () => {
      expect(parseRegistryFromImage("gcr.io/project/image:tag")).toBe("gcr.io");
      expect(parseRegistryFromImage("gcr.io/my-project/app:latest")).toBe("gcr.io");
    });

    it("should parse Quay.io", () => {
      expect(parseRegistryFromImage("quay.io/org/repo:tag")).toBe("quay.io");
    });

    it("should parse localhost registry with port", () => {
      expect(parseRegistryFromImage("localhost:5000/myapp:v1")).toBe("localhost:5000");
      expect(parseRegistryFromImage("localhost:8080/test:latest")).toBe("localhost:8080");
    });

    it("should parse custom domain registries", () => {
      expect(parseRegistryFromImage("registry.example.com/app:v1")).toBe("registry.example.com");
      expect(parseRegistryFromImage("my-registry.internal:443/service:tag")).toBe("my-registry.internal:443");
    });

    it("should handle images without tags", () => {
      expect(parseRegistryFromImage("nginx")).toBe("docker.io");
      expect(parseRegistryFromImage("ghcr.io/owner/repo")).toBe("ghcr.io");
      expect(parseRegistryFromImage("localhost:5000/app")).toBe("localhost:5000");
    });

    it("should handle complex image paths", () => {
      expect(parseRegistryFromImage("docker.io/library/ubuntu:20.04")).toBe("docker.io");
      expect(parseRegistryFromImage("gcr.io/distroless/base:nonroot")).toBe("gcr.io");
    });
  });

  describe("checkRegistryAuth", () => {
    it("should return true when direct auth exists", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "ghcr.io": { auth: "base64token" },
        },
      }));

      expect(checkRegistryAuth("ghcr.io")).toBe(true);
    });

    it("should return true when auth exists with https prefix", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "https://ghcr.io": { auth: "base64token" },
        },
      }));

      expect(checkRegistryAuth("ghcr.io")).toBe(true);
    });

    it("should return true for Docker Hub with index URL", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "https://index.docker.io/v1/": { auth: "base64token" },
        },
      }));

      expect(checkRegistryAuth("docker.io")).toBe(true);
    });

    it("should return true when username exists in auth", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "registry.example.com": { username: "user", password: "pass" },
        },
      }));

      expect(checkRegistryAuth("registry.example.com")).toBe(true);
    });

    it("should return false when auth entry is empty", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "ghcr.io": {},
        },
      }));

      expect(checkRegistryAuth("ghcr.io")).toBe(false);
    });

    it("should return true when credential store is configured", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        credsStore: "osxkeychain",
        auths: {},
      }));

      expect(checkRegistryAuth("ghcr.io")).toBe(true);
    });

    it("should return true when credential helpers are configured", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        credHelpers: {
          "gcr.io": "gcloud",
        },
      }));

      expect(checkRegistryAuth("gcr.io")).toBe(true);
    });

    it("should return false when config file doesn't exist", () => {
      mockExistsSync.mockReturnValue(false);

      expect(checkRegistryAuth("ghcr.io")).toBe(false);
    });

    it("should return false when registry is not in config", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "docker.io": { auth: "token" },
        },
      }));

      expect(checkRegistryAuth("ghcr.io")).toBe(false);
    });

    it("should handle JSON parse errors gracefully", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("invalid json");

      expect(checkRegistryAuth("ghcr.io")).toBe(false);
    });
  });

  describe("checkRegistryAccessibility", () => {
    it("should return accessible true when manifest inspect succeeds", () => {
      mockExecSync.mockReturnValue(Buffer.from("manifest data"));

      const result = checkRegistryAccessibility("docker.io");

      expect(result.accessible).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return unauthorized error for 401", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("unauthorized access: 401");
      });

      const result = checkRegistryAccessibility("ghcr.io");

      expect(result.accessible).toBe(false);
      expect(result.error).toBe("unauthorized");
    });

    it("should return not found error for 404", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("manifest not found: 404");
      });

      const result = checkRegistryAccessibility("gcr.io");

      expect(result.accessible).toBe(false);
      expect(result.error).toBe("not found");
    });

    it("should return connection failed for timeout", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("connection timeout");
      });

      const result = checkRegistryAccessibility("registry.example.com");

      expect(result.accessible).toBe(false);
      expect(result.error).toBe("connection failed");
    });

    it("should return unknown error for other failures", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("some other error");
      });

      const result = checkRegistryAccessibility("custom-registry.io");

      expect(result.accessible).toBe(false);
      expect(result.error).toBe("unknown");
    });
  });

  describe("checkImageLocal", () => {
    it("should return true when image exists locally", () => {
      mockExecSync.mockReturnValue(Buffer.from("image data"));

      expect(checkImageLocal("nginx:latest")).toBe(true);
    });

    it("should return false when image doesn't exist locally", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      expect(checkImageLocal("nonexistent:tag")).toBe(false);
    });
  });

  describe("analyzeRegistries", () => {
    beforeEach(() => {
      // Default mocks for config checks
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        auths: {
          "https://index.docker.io/v1/": { auth: "token" },
          "ghcr.io": { auth: "token" },
        },
      }));
    });

    it("should analyze multiple registries from image references", () => {
      // Setup mocks - calls happen in order:
      // 1. checkImageLocal for each image (nginx, redis, ghcr.io/owner/app)
      // 2. checkRegistryAccessibility for each unique registry (docker.io, ghcr.io)
      mockExecSync
        .mockReturnValueOnce(Buffer.from("ok")) // nginx local check
        .mockReturnValueOnce(Buffer.from("ok")) // redis local check
        .mockImplementationOnce(() => { throw new Error("not found"); }) // ghcr.io/owner/app not local
        .mockReturnValueOnce(Buffer.from("ok")) // docker.io manifest check
        .mockReturnValueOnce(Buffer.from("ok")); // ghcr.io manifest check

      const images = [
        "nginx:latest",
        "redis:alpine",
        "ghcr.io/owner/app:v1",
      ];

      const result = analyzeRegistries(images);

      expect(result.registries).toHaveLength(2);
      expect(result.totalImages).toBe(3);
      expect(result.totalLocal).toBe(2);
      
      const dockerHub = result.registries.find(r => r.name === "docker.io");
      expect(dockerHub).toBeDefined();
      expect(dockerHub?.imageCount).toBe(2);
      expect(dockerHub?.localCount).toBe(2);
      expect(dockerHub?.authenticated).toBe(true);
      expect(dockerHub?.accessible).toBe(true);

      const ghcr = result.registries.find(r => r.name === "ghcr.io");
      expect(ghcr).toBeDefined();
      expect(ghcr?.imageCount).toBe(1);
      expect(ghcr?.localCount).toBe(0);
      expect(ghcr?.authenticated).toBe(true);
      expect(ghcr?.accessible).toBe(true);
    });

    it("should sort registries by image count (most used first)", () => {
      mockExecSync.mockReturnValue(Buffer.from("ok"));

      const images = [
        "nginx:latest",
        "redis:alpine",
        "postgres:13",
        "ghcr.io/app:v1",
      ];

      const result = analyzeRegistries(images);

      expect(result.registries[0].name).toBe("docker.io");
      expect(result.registries[0].imageCount).toBe(3);
      expect(result.registries[1].name).toBe("ghcr.io");
      expect(result.registries[1].imageCount).toBe(1);
    });

    it("should handle registry analysis errors gracefully", () => {
      mockExistsSync.mockReturnValue(false); // No config
      mockExecSync.mockImplementation(() => {
        throw new Error("connection failed");
      });

      const images = ["ghcr.io/app:v1"];

      const result = analyzeRegistries(images);

      expect(result.registries).toHaveLength(1);
      expect(result.registries[0].authenticated).toBe(false);
      expect(result.registries[0].accessible).toBe(false);
      expect(result.registries[0].error).toBe("connection failed");
    });

    it("should handle empty image list", () => {
      const result = analyzeRegistries([]);

      expect(result.registries).toHaveLength(0);
      expect(result.totalImages).toBe(0);
      expect(result.totalLocal).toBe(0);
    });
  });

  describe("formatRegistryStatus", () => {
    it("should format authenticated and accessible", () => {
      expect(formatRegistryStatus({
        name: "docker.io",
        authenticated: true,
        accessible: true,
        imageCount: 5,
        localCount: 3,
      })).toBe("✅ authenticated");
    });

    it("should format accessible but not authenticated", () => {
      expect(formatRegistryStatus({
        name: "docker.io",
        authenticated: false,
        accessible: true,
        imageCount: 5,
        localCount: 3,
      })).toBe("🔓 accessible");
    });

    it("should format unauthorized error", () => {
      expect(formatRegistryStatus({
        name: "ghcr.io",
        authenticated: false,
        accessible: false,
        imageCount: 2,
        localCount: 0,
        error: "unauthorized",
      })).toBe("🔒 unauthorized");
    });

    it("should format not found error", () => {
      expect(formatRegistryStatus({
        name: "custom.io",
        authenticated: false,
        accessible: false,
        imageCount: 1,
        localCount: 0,
        error: "not found",
      })).toBe("❓ not found");
    });

    it("should format connection failed error", () => {
      expect(formatRegistryStatus({
        name: "registry.local",
        authenticated: false,
        accessible: false,
        imageCount: 1,
        localCount: 0,
        error: "connection failed",
      })).toBe("⚠️ unreachable");
    });

    it("should format unknown error", () => {
      expect(formatRegistryStatus({
        name: "unknown.io",
        authenticated: false,
        accessible: false,
        imageCount: 1,
        localCount: 0,
        error: "something else",
      })).toBe("❌ inaccessible");
    });
  });
});

