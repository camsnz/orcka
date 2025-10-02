import { handleCommandHelp, parseAndValidateCommonOptions, UP_HELP_TEXT } from "@/cli/handlers/command-handlers.js";
import { UpCommandConfig } from "@/cli/parsers/command-configs.js";
import { runComposeUp } from "@/docker/compose/docker-compose-runner.js";
import { Logger } from "@/utils/logging/logger.js";
import {
  parseWithPositionals,
  reportImageAvailability,
  resolveComposeFilesPaths,
  resolveConfigFile,
  runStatCalculation,
  writeComposeOverrideFile,
} from "./shared";

export async function handleUpCommand(argv: string[]): Promise<void> {
  try {
    const { parsed, positionals } = parseWithPositionals(argv, UpCommandConfig);

    if (parsed.help) {
      handleCommandHelp(UP_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const pullPolicy = typeof parsed["pull-policy"] === "string" ? parsed["pull-policy"] : "never";

    const logger = new Logger({ verbose, quiet });
    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      logger.info(`Starting services with configuration: ${resolved.path}`);
    }

    const selectedServices = new Set<string>(positionals);

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
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
