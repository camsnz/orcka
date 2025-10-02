import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - write command", () => {
  it("runs write command and writes outputs", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "write", "--pull-policy", "always"];

    mocks.parseArgumentsMock.mockReturnValue({
      help: false,
      file: undefined,
      output: undefined,
      "pull-policy": "always",
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        generatedServices: [
          {
            name: "web",
            varName: "WEB_TAG_VER",
            imageTag: "tag",
            imageReference: "web:tag",
          },
        ],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.parseArgumentsMock).toHaveBeenCalledWith(
      ["--pull-policy", "always"],
      expect.objectContaining({ name: "write" }),
    );
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith(
      expect.objectContaining({
        inputFile: "./discovered.yml",
        verbose: false,
        quiet: false,
        writeOutput: true,
      }),
    );
    expect(mocks.generateComposeOverridesYaml).toHaveBeenCalledWith(["web"], "always");
    expect(mocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(".orcka/docker-compose.orcka.override.yml"),
      "services:\n  web:\n    pull_policy: never\n",
      "utf-8",
    );
  });

  it("uses provided output path for write command", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "write", "--file", "config.yml", "--output", "custom.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      help: false,
      file: "config.yml",
      output: "custom.yml",
      "pull-policy": undefined,
    });

    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 2,
        generatedServices: [
          {
            name: "api",
            varName: "API_TAG_VER",
            imageTag: "tag",
            imageReference: "api:tag",
          },
          {
            name: "worker",
            varName: "WORKER_TAG_VER",
            imageTag: "tag",
            imageReference: "worker:tag",
          },
        ],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.generateComposeOverridesYaml).toHaveBeenCalledWith(["api", "worker"], "never");
    expect(mocks.writeFileSync).toHaveBeenCalledWith(
      "custom.yml",
      "services:\n  web:\n    pull_policy: never\n",
      "utf-8",
    );
  });

  it("shows write help when requested", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "write", "--help"];

    mocks.parseArgumentsMock.mockReturnValue({ help: true });

    await expect(main()).resolves.toBeUndefined();
    expect(mocks.handleCommandHelp).toHaveBeenCalledWith("help:write");
    expect(mocks.generateComposeOverridesYaml).not.toHaveBeenCalled();
  });

  it("exits when write command fails to calculate tags", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "write"];

    mocks.parseArgumentsMock.mockReturnValue({ help: false });

    mocks.calculateDockerSha.mockResolvedValue({
      success: false,
      errors: ["failed"],
      servicesCalculated: 0,
      generatedServices: [],
      outputFile: "docker-sha.hcl",
      projectContext: "/project",
    });

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
  });
});
