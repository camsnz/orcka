import { beforeEach, describe, expect, it, vi } from "vitest";

const execSync = vi.fn();

vi.mock("node:child_process", () => ({
  execSync,
}));

describe("image-checker", () => {
  beforeEach(() => {
    execSync.mockReset();
  });

  it("reports running, local and remote availability for images", async () => {
    execSync
      .mockReturnValueOnce("container-id-123\n") // docker ps for web:tag (running)
      .mockReturnValueOnce("local info") // docker image inspect web:tag
      .mockReturnValueOnce("remote info") // docker manifest inspect web:tag
      .mockReturnValueOnce("") // docker ps for api:tag (not running)
      .mockImplementationOnce(() => {
        throw new Error("missing local");
      }) // docker image inspect api:tag
      .mockReturnValueOnce("remote info"); // docker manifest inspect api:tag

    const module = await import("./image-checker.js");
    const results = module.checkImageAvailability(["web:tag", "api:tag"]);

    expect(execSync).toHaveBeenNthCalledWith(1, "docker ps --filter ancestor=web:tag --format '{{.ID}}'", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    expect(execSync).toHaveBeenNthCalledWith(2, "docker image inspect web:tag", { stdio: "pipe", encoding: "utf-8" });
    expect(execSync).toHaveBeenNthCalledWith(3, "docker manifest inspect web:tag", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    expect(execSync).toHaveBeenNthCalledWith(4, "docker ps --filter ancestor=api:tag --format '{{.ID}}'", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    expect(execSync).toHaveBeenNthCalledWith(5, "docker image inspect api:tag", { stdio: "pipe", encoding: "utf-8" });
    expect(execSync).toHaveBeenNthCalledWith(6, "docker manifest inspect api:tag", {
      stdio: "pipe",
      encoding: "utf-8",
    });

    expect(results).toEqual([
      { image: "web:tag", running: true, local: true, remote: true },
      { image: "api:tag", running: false, local: false, remote: true },
    ]);
  });

  it("handles docker CLI failures gracefully", async () => {
    execSync.mockImplementation(() => {
      throw new Error("boom");
    });

    const module = await import("./image-checker.js");
    const results = module.checkImageAvailability(["web:tag"]);

    expect(results).toEqual([{ image: "web:tag", running: false, local: false, remote: false }]);
  });

  it("checks if Docker daemon is available", async () => {
    execSync.mockReturnValueOnce("Docker info output");

    const module = await import("./image-checker.js");
    const result = module.checkDockerAvailable();

    expect(result.available).toBe(true);
    expect(execSync).toHaveBeenCalledWith("docker info", {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 3000,
    });
  });

  it("detects when Docker daemon is unavailable", async () => {
    execSync.mockImplementationOnce(() => {
      throw new Error("Cannot connect to Docker daemon");
    });

    const module = await import("./image-checker.js");
    const result = module.checkDockerAvailable();

    expect(result.available).toBe(false);
    expect(result.error).toContain("Cannot connect to Docker daemon");
  });
});
