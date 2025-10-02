import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - stat command", () => {
  it("runs stat command successfully when configuration file is provided", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "stat", "--file", "docker-sha.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-sha.yml",
      help: false,
      dotfile: undefined,
      ascii: false,
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 2,
        generatedServices: [],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.parseArgumentsMock).toHaveBeenCalledWith(
      ["--file", "docker-sha.yml"],
      expect.objectContaining({ name: "stat" }),
    );
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith({
      inputFile: "docker-sha.yml",
      dotFile: undefined,
      ascii: false,
      verbose: false,
      quiet: false,
      writeOutput: false,
    });
    expect(mocks.writeFileSync).not.toHaveBeenCalled();
    expect(harness.exitSpy).not.toHaveBeenCalled();
  });

  it("exits when stat command fails", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "stat", "--file", "docker-sha.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-sha.yml",
      help: false,
      dotfile: undefined,
      ascii: false,
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        success: false,
        errors: ["calculation failed"],
        servicesCalculated: 0,
        generatedServices: [],
      }),
    );

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith({
      inputFile: "docker-sha.yml",
      dotFile: undefined,
      ascii: false,
      verbose: false,
      quiet: false,
      writeOutput: false,
    });
  });

  it("shows stat help when --help flag is provided", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "stat", "--help"];

    mocks.parseArgumentsMock.mockReturnValue({ help: true });

    await expect(main()).resolves.toBeUndefined();
    expect(mocks.handleCommandHelp).toHaveBeenCalledWith("help:stat");
    expect(mocks.calculateDockerSha).not.toHaveBeenCalled();
  });
});
