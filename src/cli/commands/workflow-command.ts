import {
  handleCommandHelp,
  parseAndValidateCommonOptions,
  WORKFLOW_HELP_TEXT,
} from "@/cli/handlers/command-handlers.js";
import { WorkflowCommandConfig } from "@/cli/parsers/command-configs.js";
import { buildImageAncestryTree, collectDependencyClosure } from "@/core/dependencies/dependency-calculator.js";
import { DockerBakeExecutor, executeBake } from "@/docker/bake/docker-bake-executor.js";
import { runComposeUp } from "@/docker/compose/docker-compose-runner.js";
import { gatherRegistryInfo } from "@/docker/registry/registry-checker.js";
import { Logger } from "@/utils/logging/logger.js";
import {
  parseWithPositionals,
  reportImageAvailability,
  resolveComposeFilesPaths,
  resolveConfigFile,
  runStatCalculation,
  writeComposeOverrideFile,
} from "./shared";

export async function handleWorkflowCommand(argv: string[]): Promise<void> {
  try {
    const { parsed, positionals } = parseWithPositionals(argv, WorkflowCommandConfig);

    if (parsed.help) {
      handleCommandHelp(WORKFLOW_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const logger = new Logger({ verbose, quiet });

    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const pullPolicy = typeof parsed["pull-policy"] === "string" ? parsed["pull-policy"] : "never";
    const skipBake = Boolean(parsed["skip-bake"]);
    const skipUp = Boolean(parsed["skip-up"]);
    const showAncestry = Boolean(parsed.ancestry);

    const selectedServices = new Set<string>();
    for (const token of positionals) {
      selectedServices.add(token);
    }

    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      logger.info(`Running workflow with configuration: ${resolved.path}`);
    }

    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      ascii: showAncestry,
      verbose,
      quiet,
      writeOutput: true,
      serviceFilter: selectedServices.size > 0 ? Array.from(selectedServices) : undefined,
    });

    const registrySummaries = gatherRegistryInfo();
    if (!quiet) {
      if (registrySummaries.length === 0) {
        logger.info("Registry authentication status: (none reported)");
      } else {
        logger.info("Registry authentication status:");
        for (const summary of registrySummaries) {
          const statusEmoji = summary.authenticated ? "✅" : "⚠️";
          logger.info(`  ${statusEmoji} ${summary.name}`);
        }
      }
    }

    reportImageAvailability(statResult, logger, quiet);

    if (!skipBake) {
      logger.info("Checking docker buildx bake availability...");
      const bakeAvailability = await DockerBakeExecutor.checkBakeAvailability();

      if (!bakeAvailability.available) {
        console.error(`❌ ${bakeAvailability.error}`);
        process.exit(1);
      }

      const buildTargets =
        selectedServices.size === 0
          ? undefined
          : Array.from(
              collectDependencyClosure(buildImageAncestryTree(statResult.bakeTargets), selectedServices),
            ).sort();

      logger.info("Executing docker buildx bake...");
      const bakeResult = await executeBake(
        {
          configFile: resolved.path,
          targets: buildTargets,
          generatedServices: statResult.generatedServices, // Pass for dual tagging
          verbose,
          quiet,
        },
        logger,
      );

      if (!bakeResult.success) {
        console.error("❌ Docker build failed:");
        if (bakeResult.error) {
          console.error(`  ${bakeResult.error}`);
        }
        process.exit(bakeResult.exitCode ?? 1);
      }

      logger.success("✅ Docker bake completed successfully");
    } else if (!quiet) {
      logger.info("Skipping bake stage (--skip-bake)");
    }

    if (!skipUp) {
      const serviceNamesForOverride = Array.from(
        new Set(statResult.generatedServices.map((service) => service.name)),
      ).sort();

      const overridePath = writeComposeOverrideFile({
        statResult,
        services: serviceNamesForOverride,
        pullPolicy,
        logger,
        quiet,
      });

      const composeFiles = resolveComposeFilesPaths({
        statResult,
        configPath: resolved.path,
        logger,
        quiet,
      });

      const servicesToStart = selectedServices.size > 0 ? Array.from(selectedServices) : undefined;

      await runComposeUp({
        composeFiles: [...composeFiles, overridePath],
        quiet,
        services: servicesToStart,
        detached: statResult.project.runtime?.background === true,
      });
      logger.success("✅ Docker compose up completed");
    } else if (!quiet) {
      logger.info("Skipping compose up stage (--skip-up)");
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
