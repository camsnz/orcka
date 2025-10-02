import { describe, expect, it } from "vitest";
import { setupOrckaTestHarness } from "@/test-utils/orcka-cli-test-harness.js";

const harness = setupOrckaTestHarness();

describe("orcka CLI main - up command", () => {
  it("runs up command for targeted services and respects runtime settings", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "up", "audit-engine"];

    mocks.parseArgumentsMock.mockReturnValue({ help: false });

    const statResult = mocks.createStatResult({
      generatedServices: [
        {
          name: "audit-engine",
          varName: "AUDIT_ENGINE_TAG_VER",
          imageTag: "audit-tag",
          imageReference: "registry/audit:123",
        },
        {
          name: "postgres",
          varName: "POSTGRES_TAG_VER",
          imageTag: "postgres-tag",
          imageReference: "registry/postgres:456",
        },
      ],
      project: {
        name: "demo",
        context: ".",
        bake: ["docker-bake.hcl"],
        compose: ["docker-compose.yml"],
        write: "docker-sha.hcl",
        buildtime: {},
        runtime: { background: true },
      },
    });

    mocks.calculateDockerSha.mockResolvedValue(statResult);

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.checkImageAvailability).toHaveBeenCalledWith(["registry/audit:123", "registry/postgres:456"]);
    expect(mocks.generateComposeOverridesYaml).toHaveBeenCalledWith(["audit-engine", "postgres"], "never");
    expect(mocks.runComposeUp).toHaveBeenCalledWith({
      composeFiles: [
        "/project/docker-compose.yml",
        expect.stringContaining(".orcka/docker-compose.orcka.override.yml"),
      ],
      quiet: false,
      services: ["audit-engine"],
      detached: true,
    });
  });

  it("builds targeted services and runs compose when requested", async () => {
    const { main, mocks } = await harness.loadCli();
    process.argv = ["node", "orcka", "build", "up", "audit-engine"];

    mocks.parseArgumentsMock.mockReturnValue({
      help: false,
      file: undefined,
      target: undefined,
      "skip-validation": false,
      "extra-bake": undefined,
      "extra-compose": undefined,
    });

    const statResult = mocks.createStatResult({
      generatedServices: [
        {
          name: "audit-engine",
          varName: "AUDIT_ENGINE_TAG_VER",
          imageTag: "audit-tag",
          imageReference: "registry/audit:123",
        },
        {
          name: "postgres",
          varName: "POSTGRES_TAG_VER",
          imageTag: "postgres-tag",
          imageReference: "registry/postgres:456",
        },
      ],
      bakeTargets: {
        "audit-engine": {
          contexts: { base: "target:postgres" },
          depends_on: ["postgres"],
        },
        postgres: {},
      },
    });

    mocks.calculateDockerSha.mockResolvedValue(statResult);

    await expect(main()).resolves.toBeUndefined();

    expect(mocks.calculateDockerSha).toHaveBeenCalledWith(
      expect.objectContaining({
        inputFile: "./discovered.yml",
        writeOutput: true,
        serviceFilter: ["audit-engine"],
      }),
    );
    expect(mocks.executeBake).toHaveBeenCalledWith(
      expect.objectContaining({
        configFile: "./discovered.yml",
        targets: ["audit-engine", "postgres"],
      }),
      expect.any(Object),
    );
    expect(mocks.runComposeUp).toHaveBeenCalledWith({
      composeFiles: [
        "/project/docker-compose.yml",
        expect.stringContaining(".orcka/docker-compose.orcka.override.yml"),
      ],
      quiet: false,
      services: ["audit-engine"],
      detached: false,
    });
  });
});
