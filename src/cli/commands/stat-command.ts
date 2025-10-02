import {
  handleCommandHelp,
  parseAndValidateCommonOptions,
  parseCommandArguments,
  STAT_HELP_TEXT,
} from "@/cli/handlers/command-handlers.js";
import { StatCommandConfig } from "@/cli/parsers/command-configs.js";
import { analyzeRegistries } from "@/docker/registry/registry-analyzer.js";
import { Logger } from "@/utils/logging/logger.js";
import { displayRegistrySection } from "@/utils/formatting/registry-display.js";
import { reportImageAvailability, resolveConfigFile, runStatCalculation } from "./shared";

export async function handleStatCommand(argv: string[], options: { invokedByDefault?: boolean } = {}): Promise<void> {
  try {
    const parsed = parseCommandArguments(argv, StatCommandConfig);

    if (parsed.help) {
      handleCommandHelp(STAT_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const dotFile = typeof parsed.dotfile === "string" ? parsed.dotfile : undefined;
    const ascii = Boolean(parsed.ascii);
    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const logger = new Logger({ verbose, quiet });

    if (!quiet && options.invokedByDefault) {
      logger.info("Running default stat command. Use `orcka stat --help` for options.");
    }

    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      logger.info(`Calculating docker-sha configuration from: ${resolved.path}`);
    }

    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      dotFile,
      ascii,
      verbose,
      quiet,
      writeOutput: false,
    });
    reportImageAvailability(statResult, logger, quiet);

    // Analyze and display registry information
    if (!quiet && statResult.generatedServices.length > 0) {
      const imageReferences = statResult.generatedServices.map((s) => s.imageReference);
      logger.verbose("🔍 Analyzing Docker registries...");
      const registryAnalysis = analyzeRegistries(imageReferences);
      displayRegistrySection(registryAnalysis);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
