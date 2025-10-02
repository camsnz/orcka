import { execSync } from "node:child_process";
import { handleCommandHelp, parseAndValidateCommonOptions } from "@/cli/handlers/command-handlers.js";
import { UpCommandConfig } from "@/cli/parsers/command-configs.js";
import { Logger } from "@/utils/logging/logger.js";
import { parseWithPositionals, resolveComposeFilesPaths, resolveConfigFile, runStatCalculation } from "./shared";

const DOWN_HELP_TEXT = `
Usage: orcka down [options] [services...]

Stop and remove containers, networks, and volumes created by 'orcka up'.

Options:
  --file <path>          Path to orcka configuration file (auto-detected if not provided).
  --volumes, -v          Remove named volumes declared in the compose file.
  --verbose              Output detailed information.
  --quiet, -q            Suppress all output except errors.
  --help                 Show this help message.

Examples:
  orcka down                    # Stop all services
  orcka down web api            # Stop specific services
  orcka down --volumes          # Stop services and remove volumes
`;

export async function handleDownCommand(argv: string[]): Promise<void> {
  try {
    const { parsed, positionals } = parseWithPositionals(argv, UpCommandConfig);

    if (parsed.help) {
      handleCommandHelp(DOWN_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const removeVolumes = Boolean(parsed.volumes);

    const logger = new Logger({ verbose, quiet });
    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      console.log(`Stopping services with configuration: ${resolved.path}`);
    }

    const selectedServices = new Set<string>(positionals);

    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      verbose,
      quiet,
      writeOutput: false,
    });

    const composeFiles = resolveComposeFilesPaths({
      statResult,
      configPath: resolved.path,
      logger,
      quiet,
    });

    const servicesToStop = selectedServices.size > 0 ? Array.from(selectedServices) : undefined;

    const composeArgs = composeFiles.flatMap((f) => ["-f", f]);
    const volumesArg = removeVolumes ? ["--volumes"] : [];
    const servicesArg = servicesToStop || [];

    const downCommand = ["docker", "compose", ...composeArgs, "down", ...volumesArg, ...servicesArg];

    if (verbose) {
      logger.verbose(`Running: ${downCommand.join(" ")}`);
    }

    try {
      execSync(downCommand.join(" "), {
        encoding: "utf-8",
        stdio: quiet ? "pipe" : "inherit",
      });

      logger.success("✅ Docker compose down completed");
    } catch (error) {
      console.error(`❌ Docker compose down failed: ${error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
