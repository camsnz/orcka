/**
 * Orcka Run Command
 * 
 * Comprehensive workflow that:
 * 1. Performs stat calculation
 * 2. Assesses image availability
 * 3. Auto-builds missing images (if not skipped)
 * 4. Displays run plan
 * 5. Starts services with docker compose
 */

import { handleCommandHelp, parseAndValidateCommonOptions, RUN_HELP_TEXT } from "@/cli/handlers/command-handlers.js";
import { RunCommandConfig } from "@/cli/parsers/command-configs.js";
import { buildImageAncestryTree, collectDependencyClosure } from "@/core/dependencies/dependency-calculator.js";
import { DockerBakeExecutor, executeBake } from "@/docker/bake/docker-bake-executor.js";
import { runComposeUp } from "@/docker/compose/docker-compose-runner.js";
import { checkImageAvailability } from "@/docker/images/image-checker.js";
import { analyzeRegistries } from "@/docker/registry/registry-analyzer.js";
import { Logger } from "@/utils/logging/logger.js";
import { displayRegistrySection } from "@/utils/formatting/registry-display.js";
import {
  parseWithPositionals,
  resolveComposeFilesPaths,
  resolveConfigFile,
  runStatCalculation,
  writeComposeOverrideFile,
} from "./shared";

export async function handleRunCommand(argv: string[]): Promise<void> {
  try {
    const { parsed, positionals } = parseWithPositionals(argv, RunCommandConfig);

    if (parsed.help) {
      handleCommandHelp(RUN_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const pullPolicy = typeof parsed["pull-policy"] === "string" ? parsed["pull-policy"] : "never";
    const skipBuild = parsed["skip-build"] === true;
    const detached = parsed.detached === true;

    const logger = new Logger({ verbose, quiet });
    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      logger.info(`🚀 Running services with configuration: ${resolved.path}`);
    }

    // Parse selected services from positionals and --target
    const selectedServices = new Set<string>(positionals);
    if (typeof parsed.target === "string" && parsed.target.length > 0) {
      selectedServices.add(parsed.target);
    }

    const serviceFilter = selectedServices.size > 0 ? Array.from(selectedServices) : undefined;

    // 1. Perform stat calculation
    logger.verbose("📊 Calculating image tags...");
    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      verbose,
      quiet,
      writeOutput: true,
      serviceFilter,
    });

    if (!statResult.success) {
      console.error("❌ Failed to calculate image tags");
      process.exit(1);
    }

    // 2. Check image availability
    logger.verbose("🔍 Checking image availability...");
    const imageReferences = statResult.generatedServices.map((s) => s.imageReference);
    const imageAvailability = checkImageAvailability(imageReferences);
    
    // Count missing images (not available locally)
    const missingImages = imageAvailability.filter((img) => !img.local);

    // Display run plan
    if (!quiet) {
      displayRunPlan(statResult, imageAvailability, selectedServices);
      
      // Display registry information
      const imageReferences = statResult.generatedServices.map((s) => s.imageReference);
      logger.verbose("🔍 Analyzing Docker registries...");
      const registryAnalysis = analyzeRegistries(imageReferences);
      displayRegistrySection(registryAnalysis);
    }

    // 3. Auto-build missing images if needed
    if (missingImages.length > 0 && !skipBuild) {
      logger.info(`🔨 Building ${missingImages.length} missing image(s)...`);

      const bakeAvailability = await DockerBakeExecutor.checkBakeAvailability();
      if (!bakeAvailability.available) {
        console.error(`❌ ${bakeAvailability.error}`);
        process.exit(1);
      }

      // Determine which targets to build (include dependencies)
      const missingServiceNames = missingImages
        .map((img) => {
          const service = statResult.generatedServices.find((s) => s.imageReference === img.image);
          return service?.name;
        })
        .filter((name): name is string => name !== undefined);

      const buildTargets = Array.from(
        collectDependencyClosure(
          buildImageAncestryTree(statResult.bakeTargets),
          new Set(missingServiceNames),
        ),
      ).sort();

      logger.verbose(`🎯 Building targets: ${buildTargets.join(", ")}`);

      const bakeResult = await executeBake(
        {
          configFile: resolved.path,
          targets: buildTargets,
          generatedServices: statResult.generatedServices,
          verbose,
          quiet,
        },
        logger,
      );

      if (!bakeResult.success) {
        console.error("❌ Build failed:");
        if (bakeResult.error) {
          console.error(`  ${bakeResult.error}`);
        }
        process.exit(bakeResult.exitCode ?? 1);
      }

      logger.success("✅ Images built successfully");
    } else if (missingImages.length > 0 && skipBuild) {
      logger.warn(`⚠️  ${missingImages.length} image(s) missing but build skipped (--skip-build)`);
    } else if (!quiet) {
      logger.success("✅ All images are available locally");
    }

    // 4. Write compose override
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

    // 5. Run compose up
    const composeFiles = resolveComposeFilesPaths({
      statResult,
      configPath: resolved.path,
      logger,
      quiet,
    });
    const allComposeFiles = overridePath ? [...composeFiles, overridePath] : composeFiles;

    const servicesToRun = serviceFilter || undefined;

    logger.info(`🚀 Starting services${detached ? " (detached)" : ""}...`);

    runComposeUp({
      composeFiles: allComposeFiles,
      quiet,
      services: servicesToRun,
      detached,
    });

    if (!quiet) {
      logger.success(`✅ Services ${detached ? "started" : "running"}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Run failed: ${errorMsg}`);
    process.exit(1);
  }
}

/**
 * Display run plan showing services, images, and their status
 */
function displayRunPlan(
  statResult: Awaited<ReturnType<typeof runStatCalculation>>,
  imageAvailability: ReturnType<typeof checkImageAvailability>,
  selectedServices: Set<string>,
): void {
  console.log("");
  console.log("📋 Run Plan:");
  console.log("");

  // Services section
  const servicesToRun =
    selectedServices.size > 0
      ? statResult.generatedServices.filter((s) => selectedServices.has(s.name))
      : statResult.generatedServices;

  console.log(`  Services to start: ${servicesToRun.length}`);
  for (const service of servicesToRun) {
    const availability = imageAvailability.find((img) => img.image === service.imageReference);
    const status = getServiceStatus(availability);
    console.log(`    • ${service.name}: ${status}`);
  }

  // Running containers section
  const runningServices = servicesToRun.filter((service) => {
    const availability = imageAvailability.find((img) => img.image === service.imageReference);
    return availability?.running;
  });

  if (runningServices.length > 0) {
    console.log("");
    console.log(`  ⚠️  ${runningServices.length} service(s) already running:`);
    for (const service of runningServices) {
      console.log(`    • ${service.name}`);
    }
  }

  // Missing images section
  const missingServices = servicesToRun.filter((service) => {
    const availability = imageAvailability.find((img) => img.image === service.imageReference);
    return !availability?.local;
  });

  if (missingServices.length > 0) {
    console.log("");
    console.log(`  🔨 ${missingServices.length} image(s) will be built:`);
    for (const service of missingServices) {
      console.log(`    • ${service.name} → ${service.imageReference}`);
    }
  }

  console.log("");
}

/**
 * Get human-readable service status
 */
function getServiceStatus(
  availability?: { image: string; running: boolean; local: boolean; remote: boolean },
): string {
  if (!availability) {
    return "❓ unknown";
  }

  if (availability.running) {
    return "🟢 running";
  }

  if (availability.local) {
    return "✅ ready";
  }

  if (availability.remote) {
    return "📦 remote (will build)";
  }

  return "❌ missing (will build)";
}

