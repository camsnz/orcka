import { writeFileSync } from "node:fs";
import {
  handleCommandHelp,
  parseAndValidateCommonOptions,
  parseCommandArguments,
  WRITE_HELP_TEXT,
} from "@/cli/handlers/command-handlers.js";
import { WriteCommandConfig } from "@/cli/parsers/command-configs.js";
import { generateComposeOverridesYaml } from "@/generators/compose/compose-overrides-generator.js";
import { ensureOrckaDirectory, resolveComposeOverridePath } from "@/utils/orcka-output-paths.js";
import { resolveConfigFile, runStatCalculation } from "./shared";

export async function handleWriteCommand(argv: string[]): Promise<void> {
  try {
    const parsed = parseCommandArguments(argv, WriteCommandConfig);

    if (parsed.help) {
      handleCommandHelp(WRITE_HELP_TEXT);
      return;
    }

    const { verbose, quiet } = parseAndValidateCommonOptions(parsed);
    const fileArg = typeof parsed.file === "string" ? parsed.file : undefined;
    const pullPolicy = typeof parsed["pull-policy"] === "string" ? parsed["pull-policy"] : "never";

    const resolved = resolveConfigFile(fileArg, quiet);

    if (!quiet) {
      console.log(`Generating compose overrides from: ${resolved.path}`);
    }

    const statResult = await runStatCalculation({
      inputFile: resolved.path,
      verbose,
      quiet,
      writeOutput: true,
    });

    const serviceNames = statResult.generatedServices.map((service) => service.name);
    const overrideYaml = generateComposeOverridesYaml(serviceNames, pullPolicy);

    ensureOrckaDirectory(statResult.projectContext);
    const defaultOutputPath = resolveComposeOverridePath(statResult.projectContext, statResult.project);
    const outputPath = typeof parsed.output === "string" ? parsed.output : defaultOutputPath;

    writeFileSync(outputPath, overrideYaml, "utf-8");

    if (!quiet) {
      console.log(`✅ Wrote compose override file: ${outputPath}`);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
