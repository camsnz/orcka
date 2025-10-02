import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - build command", () => {
  it("runs build workflow when prerequisites succeed", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "build", "--file", "docker-sha.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-sha.yml",
      help: false,
      target: undefined,
      "extra-bake": undefined,
      "extra-compose": undefined,
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 2,
        generatedServices: [],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.validateDockerEnvironment).toHaveBeenCalledTimes(1);
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith({
      inputFile: "docker-sha.yml",
      verbose: false,
      quiet: false,
      writeOutput: true,
    });
    expect(mocks.checkBakeAvailability).toHaveBeenCalledTimes(1);
    expect(mocks.executeBake).toHaveBeenCalledTimes(1);
  });

  it("exits when docker environment validation fails during build", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "build", "--file", "docker-sha.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-sha.yml",
      help: false,
    });

    mocks.validateDockerEnvironment.mockResolvedValue({
      valid: false,
      warnings: [],
      errors: ["docker unavailable"],
    });

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.calculateDockerSha).not.toHaveBeenCalled();
  });

  it("skips docker validation when --skip-validation flag is passed", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = [
      "node",
      "orcka",
      "build",
      "--file",
      "docker-sha.yml",
      "--skip-validation",
      "--extra-bake",
      "add.hcl",
      "--extra-compose",
      "compose.yml",
    ];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-sha.yml",
      help: false,
      "skip-validation": true,
      "extra-bake": "add.hcl",
      "extra-compose": "compose.yml",
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 1,
        generatedServices: [],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.validateDockerEnvironment).not.toHaveBeenCalled();
    expect(mocks.executeBake).toHaveBeenCalledWith(
      expect.objectContaining({
        configFile: "docker-sha.yml",
        targets: undefined,
        extraBakeFiles: ["add.hcl"],
        extraComposeFiles: ["compose.yml"],
        verbose: false,
        quiet: false,
      }),
      expect.any(Object),
    );
  });
});
