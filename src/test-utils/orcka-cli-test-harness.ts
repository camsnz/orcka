import { afterEach, beforeEach, vi } from "vitest";

export class ExitError extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = "ExitError";
    this.code = code;
  }
}

interface HarnessState {
  exitSpy?: ReturnType<typeof vi.spyOn<any, any>>;
  consoleLogSpy?: ReturnType<typeof vi.spyOn<any, any>>;
  consoleErrorSpy?: ReturnType<typeof vi.spyOn<any, any>>;
  consoleWarnSpy?: ReturnType<typeof vi.spyOn<any, any>>;
}

export function setupOrckaTestHarness() {
  const originalArgv = [...process.argv];
  const state: HarnessState = {};

  beforeEach(() => {
    state.exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(typeof code === "number" ? code : 0);
    }) as never);

    state.consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    state.consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadCli() {
    vi.resetModules();

    const showMainUsage = vi.fn();
    const showVersion = vi.fn();
    vi.doMock("@/cli/utilities/cli-utilities.js", () => ({
      showMainUsage,
      showVersion,
    }));

    const parseArgumentsMock = vi.fn();
    const parseAndValidateCommonOptions = vi.fn().mockReturnValue({ verbose: false, quiet: false });
    const handleCommandHelp = vi.fn();

    const STAT_HELP_TEXT = "help:stat";
    const WRITE_HELP_TEXT = "help:write";
    const MODIFY_HELP_TEXT = "help:modify";
    const BUILD_HELP_TEXT = "help:build";
    const UP_HELP_TEXT = "help:up";

    vi.doMock("@/cli/handlers/command-handlers.js", () => ({
      STAT_HELP_TEXT,
      WRITE_HELP_TEXT,
      MODIFY_HELP_TEXT,
      BUILD_HELP_TEXT,
      UP_HELP_TEXT,
      handleCommandHelp,
      parseCommandArguments: parseArgumentsMock,
      parseAndValidateCommonOptions,
    }));

    const calculateDockerSha = vi.fn();
    vi.doMock("@/core/calculation/docker-sha/index.js", () => ({
      calculateDockerSha,
    }));

    const configDiscoveryInstance = {
      findConfigFile: vi.fn().mockReturnValue({
        found: true,
        filePath: "./discovered.yml",
        fileName: "discovered.yml",
      }),
      getNotFoundMessage: vi.fn().mockReturnValue("Configuration not found"),
    };
    const ConfigDiscovery = vi.fn(() => configDiscoveryInstance);
    vi.doMock("@/core/config/config-discovery.js", () => ({
      ConfigDiscovery,
    }));

    const modifyDockerCompose = vi.fn();
    vi.doMock("@/docker/compose/docker-compose-modifier.js", () => ({
      modifyDockerCompose,
    }));

    const validateDockerEnvironment = vi.fn().mockResolvedValue({ valid: true, warnings: [] });
    vi.doMock("@/docker/environment/docker-env-validator.js", () => ({
      validateDockerEnvironment,
    }));

    const analyzeRegistries = vi.fn().mockReturnValue({
      registries: [],
      totalImages: 0,
      totalLocal: 0,
      errors: [],
    });
    vi.doMock("@/docker/registry/registry-analyzer.js", () => ({
      analyzeRegistries,
    }));

    const executeBake = vi.fn().mockResolvedValue({ success: true });
    const checkBakeAvailability = vi.fn().mockResolvedValue({ available: true });
    vi.doMock("@/docker/bake/docker-bake-executor.js", () => ({
      executeBake,
      DockerBakeExecutor: { checkBakeAvailability },
    }));

    const generateComposeOverridesYaml = vi.fn().mockReturnValue("services:\n  web:\n    pull_policy: never\n");
    vi.doMock("@/generators/compose/compose-overrides-generator.js", () => ({
      generateComposeOverridesYaml,
    }));

    const writeFileSync = vi.fn();
    const existsSync = vi
      .fn()
      .mockImplementation(
        (filePath: string) =>
          filePath.endsWith("docker-compose.yml") || filePath.endsWith("docker-compose.orcka.override.yml"),
      );
    const mkdirSync = vi.fn();

    vi.doMock("node:fs", () => ({
      writeFileSync,
      existsSync,
      mkdirSync,
    }));

    const gatherRegistryInfo = vi.fn().mockReturnValue([{ name: "registry.example.com", authenticated: true }]);
    vi.doMock("@/docker/registry/registry-checker.js", () => ({
      gatherRegistryInfo,
    }));

    const checkDockerAvailable = vi.fn().mockReturnValue({ available: true });
    const checkImageAvailability = vi
      .fn()
      .mockReturnValue([{ image: "web:web-tag", running: false, local: true, remote: true }]);
    vi.doMock("@/docker/images/image-checker.js", () => ({
      checkDockerAvailable,
      checkImageAvailability,
    }));

    const runComposeUp = vi.fn();
    vi.doMock("@/docker/compose/docker-compose-runner.js", () => ({
      runComposeUp,
    }));

    const createStatResult = (overrides: Record<string, unknown> = {}) => ({
      success: true,
      outputFile: "/project/.orcka/docker-sha.hcl",
      projectContext: "/project",
      project: {
        name: "demo",
        context: ".",
        bake: ["docker-bake.hcl"],
        compose: ["docker-compose.yml"],
        write: "docker-sha.hcl",
        buildtime: {},
        runtime: {},
      },
      servicesCalculated: 1,
      generatedServices: [
        {
          name: "web",
          varName: "WEB_TAG_VER",
          imageTag: "tag",
          imageReference: "web:tag",
        },
      ],
      resolvedTags: { web: "web:tag" },
      composeFiles: ["docker-compose.yml"],
      bakeTargets: {
        web: { dockerfile: "web/Dockerfile", tags: ["web:tag"] },
      },
      ...overrides,
    });

    const module = await import("@/orcka.js");

    return {
      main: module.main,
      mocks: {
        showMainUsage,
        showVersion,
        parseArgumentsMock,
        parseAndValidateCommonOptions,
        handleCommandHelp,
        calculateDockerSha,
        createStatResult,
        ConfigDiscovery,
        configDiscoveryInstance,
        modifyDockerCompose,
        validateDockerEnvironment,
        analyzeRegistries,
        executeBake,
        checkBakeAvailability,
        generateComposeOverridesYaml,
        writeFileSync,
        existsSync,
        mkdirSync,
        gatherRegistryInfo,
        checkImageAvailability,
        runComposeUp,
      },
    } as const;
  }

  return {
    loadCli,
    get exitSpy() {
      return state.exitSpy!;
    },
    get consoleLogSpy() {
      return state.consoleLogSpy!;
    },
    get consoleErrorSpy() {
      return state.consoleErrorSpy!;
    },
    get consoleWarnSpy() {
      return state.consoleWarnSpy!;
    },
  };
}
