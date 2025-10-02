import { describe, expect, it, vi } from "vitest";

const execSync = vi.fn();

vi.mock("node:child_process", () => ({
  execSync,
}));

describe("docker-compose-runner", () => {
  it("invokes docker compose up with override file", async () => {
    const module = await import("./docker-compose-runner.js");

    module.runComposeUp({
      composeFiles: ["/path/to/docker-compose.yml", "/path/to/docker-compose.orcka.override.yml"],
      quiet: false,
    });

    expect(execSync).toHaveBeenCalledWith(
      "docker compose --file /path/to/docker-compose.yml --file /path/to/docker-compose.orcka.override.yml up",
      {
        stdio: "inherit",
        env: process.env,
      },
    );
  });

  it("uses silent stdio when quiet is true", async () => {
    execSync.mockClear();
    const module = await import("./docker-compose-runner.js");

    module.runComposeUp({
      composeFiles: ["config.yml", "override.yml"],
      quiet: true,
    });

    expect(execSync).toHaveBeenCalledWith("docker compose --file config.yml --file override.yml up", {
      stdio: "pipe",
      env: process.env,
    });
  });

  it("supports detached mode and targeted services", async () => {
    execSync.mockClear();
    const module = await import("./docker-compose-runner.js");

    module.runComposeUp({
      composeFiles: ["compose.yml"],
      quiet: false,
      services: ["audit-engine"],
      detached: true,
    });

    expect(execSync).toHaveBeenCalledWith("docker compose --file compose.yml up -d audit-engine", {
      stdio: "inherit",
      env: process.env,
    });
  });
});
