import { describe, expect, it } from "vitest";
import { ExitError, setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - modify command", () => {
  it("modifies docker-compose files when modify command succeeds", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "modify", "--file", "docker-compose.yml"];

    mocks.parseArgumentsMock.mockReturnValue({
      file: "docker-compose.yml",
      verbose: false,
      help: false,
    });

    mocks.modifyDockerCompose.mockResolvedValue({
      success: true,
      modifiedServices: ["web"],
      errors: [],
    });

    await expect(main()).resolves.toBeUndefined();
    expect(mocks.modifyDockerCompose).toHaveBeenCalledWith("docker-compose.yml", expect.any(Object));
  });

  it("exits when modify command is missing required file option", async () => {
    const { main } = await harness.loadCli();
    process.argv = ["node", "orcka", "modify"];

    await expect(main()).rejects.toBeInstanceOf(ExitError);
    expect(harness.exitSpy).toHaveBeenCalledWith(1);
  });
});
