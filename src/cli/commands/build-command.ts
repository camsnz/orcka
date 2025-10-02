import { BUILD_HELP_TEXT, handleCommandHelp, parseAndValidateCommonOptions } from "@/cli/handlers/command-handlers.js";
import { BuildCommandConfig } from "@/cli/parsers/command-configs.js";
import { buildImageAncestryTree, collectDependencyClosure } from "@/core/dependencies/dependency-calculator.js";
import { DockerBakeExecutor, executeBake } from "@/docker/bake/docker-bake-executor.js";
import { runComposeUp } from "@/docker/compose/docker-compose-runner.js";
import { validateDockerEnvironment } from "@/docker/environment/docker-env-validator.js";
import { analyzeRegistries } from "@/docker/registry/registry-analyzer.js";
import { Logger } from "@/utils/logging/logger.js";
import { displayRegistrySection } from "@/utils/formatting/registry-display.js";
import {
  parseWithPositionals,
  reportImageAvailability,
  resolveComposeFilesPaths,
  resolveConfigFile,
  runStatCalculation,
  writeComposeOverrideFile,
} from "./shared";

export async function handleBuildCommand(argv: string[]): Promise<void> {
  try {
    const { parsed, positionals } = parseWithPositionals(argv, BuildCommandConfig);

    if (parsed.help) {
      handleCommandHelp(BUILD_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const skipValidation = Boolean(parsed["skip-validation"]);

    const logger = new Logger({ verbose, quiet });

    if (!skipValidation) {
      logger.verbose("🔍 Validating Docker environment...");
      const dockerValidation = await validateDockerEnvironment(logger);

      if (!dockerValidation.valid) {
        console.error("❌ Docker environment validation failed:");
        for (const error of dockerValidation.errors) {
          console.error(`  - ${error}`);
        }
        process.exit(1);
      }

      for (const warning of dockerValidation.warnings) {
        logger.warn(`⚠️  ${warning}`);
      }

      logger.verbose("✅ Docker environment validation passed");
    }

    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const pullPolicy = typeof parsed["pull-policy"] === "string" ? parsed["pull-policy"] : "never";

    const resolved = resolveConfigFile(fileArg, quiet);
    if (!quiet) {
      logger.info(`Building with configuration: ${resolved.path}`);
    }

    const selectedServices = new Set<string>();
    const positionalTokens = [...positionals];
    const shouldRunUp = positionalTokens[0] === "up";
    if (shouldRunUp) {
      positionalTokens.shift();
    }

    for (const token of positionalTokens) {
      selectedServices.add(token);
    }

    if (typeof parsed.target === "string" && parsed.target.length > 0) {
      selectedServices.add(parsed.target);
    }

    const serviceFilter = selectedServices.size > 0 ? Array.from(selectedServices) : undefined;

    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      verbose,
      quiet,
      writeOutput: true,
      serviceFilter,
    });

    reportImageAvailability(statResult, logger, quiet);

    // Analyze and display registry information
    if (!quiet && statResult.generatedServices.length > 0) {
      const imageReferences = statResult.generatedServices.map((s) => s.imageReference);
      logger.verbose("🔍 Analyzing Docker registries...");
      const registryAnalysis = analyzeRegistries(imageReferences);
      displayRegistrySection(registryAnalysis);
    }

    const serviceNamesForOverride = Array.from(
      new Set(statResult.generatedServices.map((service) => service.name)),
    ).sort();

    let overridePath: string | undefined;
    const shouldWriteOverride = statResult.project.buildtime?.apply_compose_tags === true || shouldRunUp;

    if (shouldWriteOverride) {
      overridePath = writeComposeOverrideFile({
        statResult,
        services: serviceNamesForOverride,
        pullPolicy,
        logger,
        quiet,
      });
    }

    logger.verbose("🔍 Checking docker buildx bake availability...");
    const bakeAvailability = await DockerBakeExecutor.checkBakeAvailability();

    if (!bakeAvailability.available) {
      console.error(`❌ ${bakeAvailability.error}`);
      process.exit(1);
    }

    const buildTargets = (() => {
      if (selectedServices.size === 0) {
        return undefined;
      }
      const ancestryTree = buildImageAncestryTree(statResult.bakeTargets);
      return Array.from(collectDependencyClosure(ancestryTree, selectedServices)).sort();
    })();

    logger.info("🚀 Executing docker buildx bake...");
    const bakeResult = await executeBake(
      {
        configFile: resolved.path,
        targets: buildTargets,
        extraBakeFiles: typeof parsed["extra-bake"] === "string" ? [parsed["extra-bake"]] : undefined,
        extraComposeFiles: typeof parsed["extra-compose"] === "string" ? [parsed["extra-compose"]] : undefined,
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

    logger.success("✅ Build completed successfully!");

    if (shouldRunUp) {
      const ensuredOverridePath =
        overridePath ??
        writeComposeOverrideFile({
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
        composeFiles: [...composeFiles, ensuredOverridePath],
        quiet,
        services: servicesToStart,
        detached: statResult.project.runtime?.background === true,
      });

      logger.success("✅ Docker compose up completed");
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
