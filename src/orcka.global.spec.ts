import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - global behaviour", () => {
  it("shows usage when no command is provided", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka"];

    await expect(main()).rejects.toMatchObject({ code: 0 });
    expect(harness.exitSpy).toHaveBeenCalledWith(0);
    expect(mocks.showMainUsage).toHaveBeenCalledTimes(1);
    expect(mocks.parseArgumentsMock).not.toHaveBeenCalled();
    expect(mocks.calculateDockerSha).not.toHaveBeenCalled();
  });

  it("shows version information for global version flags", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "--version"];

    await expect(main()).rejects.toMatchObject({ code: 0 });
    expect(harness.exitSpy).toHaveBeenCalledWith(0);
    expect(mocks.showVersion).toHaveBeenCalledTimes(1);
  });

  it("exits with error when command is unknown", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "unknown"];

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.showMainUsage).toHaveBeenCalledTimes(1);
  });
});
