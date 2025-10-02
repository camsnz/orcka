import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - workflow command", () => {
  it("runs workflow command end-to-end", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "workflow"];

    mocks.parseArgumentsMock.mockReturnValue({
      help: false,
      ancestry: false,
      "skip-bake": false,
      "skip-up": false,
    });

    mocks.calculateDockerSha.mockResolvedValue(mocks.createStatResult());

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.checkBakeAvailability).toHaveBeenCalledTimes(1);
    expect(mocks.executeBake).toHaveBeenCalledTimes(1);
    expect(mocks.runComposeUp).toHaveBeenCalledTimes(1);
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith(expect.objectContaining({ writeOutput: true }));
  });

  it("fails workflow when no compose file is present", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "workflow"];

    mocks.parseArgumentsMock.mockReturnValue({ help: false, ancestry: false });
    mocks.existsSync.mockReturnValue(false);
    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        generatedServices: [],
        composeFiles: [],
      }),
    );

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.runComposeUp).not.toHaveBeenCalled();
  });

  it("enables ancestry output when requested in workflow", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "workflow", "--ancestry"];

    mocks.parseArgumentsMock.mockReturnValue({ help: false, ancestry: true });
    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 1,
        generatedServices: [],
      }),
    );

    mocks.executeBake.mockResolvedValue({ success: true });

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.calculateDockerSha).toHaveBeenCalledWith(expect.objectContaining({ ascii: true, writeOutput: true }));
  });

  it("skips bake and compose stages when configured", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "workflow", "--skip-bake", "--skip-up"];

    mocks.parseArgumentsMock.mockReturnValue({
      help: false,
      ancestry: false,
      "skip-bake": true,
      "skip-up": true,
    });
    mocks.calculateDockerSha.mockResolvedValue(
      mocks.createStatResult({
        servicesCalculated: 1,
        generatedServices: [],
      }),
    );

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.checkBakeAvailability).not.toHaveBeenCalled();
    expect(mocks.executeBake).not.toHaveBeenCalled();
    expect(mocks.runComposeUp).not.toHaveBeenCalled();
    expect(mocks.calculateDockerSha).toHaveBeenCalledWith(expect.objectContaining({ writeOutput: true }));
  });
});
