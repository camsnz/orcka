import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseCommandArguments } from "@/cli/handlers/command-handlers.js";
import type { CommandConfig } from "@/cli/parsers/arg-parser.js";
import { Clout } from "@/cli/utilities/clout";
import { calculateDockerSha } from "@/core/calculation/docker-sha/index.js";
import { ConfigDiscovery } from "@/core/config/config-discovery.js";
import { checkDockerAvailable, checkImageAvailability } from "@/docker/images/image-checker.js";
import { generateComposeOverridesYaml } from "@/generators/compose/compose-overrides-generator.js";
import type { Logger } from "@/utils/logging/logger.js";
import { ensureOrckaDirectory, resolveComposeOverridePath } from "@/utils/orcka-output-paths.js";

const COMPOSE_FILE_CANDIDATES = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];

function locateComposeFile(configFile: string, projectContext?: string): { composeFile?: string; checked: string[] } {
  const searchDirs = new Set<string>([dirname(configFile)]);
  if (projectContext) {
    searchDirs.add(projectContext);
  }

  const checked: string[] = [];

  for (const dir of searchDirs) {
    for (const candidate of COMPOSE_FILE_CANDIDATES) {
      const candidatePath = resolve(dir, candidate);
      checked.push(candidatePath);
      if (existsSync(candidatePath)) {
        return { composeFile: candidatePath, checked };
      }
    }
  }

  return { checked };
}

export function parseWithPositionals<T extends Record<string, unknown>>(
  argv: string[],
  config: CommandConfig,
): { parsed: T; positionals: string[] } {
  const optionArgs: string[] = [];
  const positionals: string[] = [];

  const argMap = new Map<string, { key: string; def: (typeof config.args)[string] }>();
  for (const [key, def] of Object.entries(config.args)) {
    for (const name of def.names) {
      argMap.set(name, { key, def });
    }
  }

  let i = 0;
  while (i < argv.length) {
    const token = argv[i];

    if (!token.startsWith("-")) {
      positionals.push(token);
      i++;
      continue;
    }

    optionArgs.push(token);
    const match = argMap.get(token);

    if (match?.def?.hasValue) {
      i++;
      if (i < argv.length) {
        optionArgs.push(argv[i]);

        if (match.def.multiValue) {
          while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
            i++;
            optionArgs.push(argv[i]);
          }
        }
      }
    }

    i++;
  }

  const parsed = parseCommandArguments<T>(optionArgs, config);
  return { parsed, positionals };
}

export function writeComposeOverrideFile({
  statResult,
  services,
  pullPolicy,
  logger,
  quiet,
}: {
  statResult: Awaited<ReturnType<typeof runStatCalculation>>;
  services: string[];
  pullPolicy: string;
  logger: Logger;
  quiet: boolean;
}): string {
  ensureOrckaDirectory(statResult.projectContext);
  const overridePath = resolveComposeOverridePath(statResult.projectContext, statResult.project);
  const overrideYaml = generateComposeOverridesYaml(services, pullPolicy);
  writeFileSync(overridePath, overrideYaml, "utf-8");
  if (!quiet) {
    logger.info(`Generated compose override: ${overridePath}`);
  }
  return overridePath;
}

export function resolveComposeFilesPaths({
  statResult,
  configPath,
  logger,
  quiet,
}: {
  statResult: Awaited<ReturnType<typeof runStatCalculation>>;
  configPath: string;
  logger: Logger;
  quiet: boolean;
}): string[] {
  const baseDir = statResult.projectContext;
  const configured = statResult.composeFiles.map((file) => resolve(baseDir, file));
  const existing = configured.filter((file) => existsSync(file));
  const missing = configured.filter((file) => !existsSync(file));

  if (missing.length > 0 && !quiet) {
    for (const file of missing) {
      logger.warn(`Missing compose file referenced in configuration: ${file}`);
    }
  }

  if (existing.length > 0) {
    if (!quiet) {
      for (const file of existing) {
        logger.info(`Using compose file: ${file}`);
      }
    }
    return existing;
  }

  const { composeFile, checked } = locateComposeFile(configPath, statResult.projectContext);
  if (!composeFile) {
    console.error(`❌ Could not find a docker compose file. Checked: ${checked.join(", ")}`);
    process.exit(1);
  }

  logger.verbose(`Compose file search paths: ${checked.join(", ")}`);

  if (!quiet) {
    logger.info(`Using compose file: ${composeFile}`);
  }

  return [composeFile];
}

export function reportImageAvailability(
  statResult: Awaited<ReturnType<typeof runStatCalculation>>,
  logger: Logger,
  quiet: boolean,
): void {
  if (quiet) {
    return;
  }

  const images = Array.from(
    new Set(
      statResult.generatedServices
        .map((service) => service.imageReference || service.imageTag)
        .filter((tag) => typeof tag === "string" && tag.length > 0),
    ),
  );

  if (images.length === 0) {
    logger.info("No image tags produced during stat phase");
    return;
  }

  const dockerStatus = checkDockerAvailable();

  console.log(`\n${Clout.statusLine("info", "Images: [C]ontainer [L]ocal [R]emote")}`);

  if (!dockerStatus.available) {
    console.log(Clout.statusLine("error", "Docker Services unavailable. Cannot fetch image info."));
    return;
  }

  // Prepare table data (CLR = Container, Local, Remote)
  const headers = ["Image", "C", "L", "R"];
  const maxImageLength = Math.max(...images.map((img: string) => img.length), 40);

  const availability = checkImageAvailability(images as string[]);
  const rows = availability.map((entry) => [
    entry.image,
    entry.running ? `[${Clout.symbols.star}]` : "[ ]",  // C = Container (running)
    entry.local ? `[${Clout.symbols.checkmark}]` : "[ ]",  // L = Local
    entry.remote ? `[${Clout.symbols.checkmark}]` : "[ ]",  // R = Remote
  ]);

  // Format and display table
  const table = Clout.table(headers, rows, {
    columnWidths: [maxImageLength, 3, 3, 3],
    align: ["left", "center", "center", "center"],
    border: false,
    truncate: true,
  });

  console.log(table);
  console.log();
}

export async function runStatCalculation({
  inputFile,
  dotFile,
  ascii,
  verbose,
  quiet,
  writeOutput = true,
  serviceFilter,
}: {
  inputFile: string;
  dotFile?: string;
  ascii?: boolean;
  verbose: boolean;
  quiet: boolean;
  writeOutput?: boolean;
  serviceFilter?: string[] | Set<string>;
}) {
  const result = await calculateDockerSha({
    inputFile,
    dotFile,
    ascii,
    verbose,
    quiet,
    writeOutput,
    serviceFilter,
  });

  if (!result.success) {
    console.error("❌ Stat failed:");
    if (result.errors) {
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
    }
    process.exit(1);
  }

  return result;
}

export function resolveConfigFile(fileArg: string | undefined, quiet: boolean): { path: string; name?: string } {
  if (fileArg) {
    return { path: fileArg };
  }

  const discovery = new ConfigDiscovery();
  const discoveryResult = discovery.findConfigFile(".");

  if (!discoveryResult.found || !discoveryResult.filePath) {
    console.error(discovery.getNotFoundMessage("."));
    process.exit(1);
  }

  if (!quiet) {
    console.log(`🔍 Found configuration: ${discoveryResult.fileName}`);
  }

  return {
    path: discoveryResult.filePath,
    name: discoveryResult.fileName,
  };
}
