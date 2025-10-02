import { beforeEach, describe, expect, it, vi } from "vitest";

const execSync = vi.fn();
const readFileSync = vi.fn();
const existsSync = vi.fn();

vi.mock("node:child_process", () => ({
  execSync,
}));

vi.mock("node:fs", () => ({
  readFileSync,
  existsSync,
}));

describe("registry-checker", () => {
  beforeEach(() => {
    execSync.mockReset();
    readFileSync.mockReset();
    existsSync.mockReset();
    delete process.env.DOCKER_CONFIG;
  });

  it("returns registry authentication summaries", async () => {
    process.env.DOCKER_CONFIG = "/tmp/docker-config.json";

    execSync.mockReturnValue(
      JSON.stringify({
        "docker.io": { Name: "docker.io", Secure: true },
        "ghcr.io": { Name: "ghcr.io", Secure: true },
      }),
    );

    readFileSync.mockReturnValue(
      JSON.stringify({
        auths: {
          "https://docker.io": { auth: "token" },
        },
      }),
    );
    existsSync.mockReturnValue(true);

    const module = await import("./registry-checker.js");
    const results = module.gatherRegistryInfo();

    expect(execSync).toHaveBeenCalledWith("docker info --format {{json .RegistryConfig.IndexConfigs}}", {
      encoding: "utf-8",
    });
    expect(readFileSync).toHaveBeenCalledWith("/tmp/docker-config.json", "utf-8");
    expect(results).toEqual([
      { name: "docker.io", authenticated: true },
      { name: "ghcr.io", authenticated: false },
    ]);
  });

  it("returns empty array when docker info is unavailable", async () => {
    execSync.mockImplementation(() => {
      throw new Error("docker not available");
    });
    existsSync.mockReturnValue(false);

    const module = await import("./registry-checker.js");
    const results = module.gatherRegistryInfo();

    expect(results).toEqual([]);
  });
});
