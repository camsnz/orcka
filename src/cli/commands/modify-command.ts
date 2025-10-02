import {
  handleCommandHelp,
  MODIFY_HELP_TEXT,
  parseAndValidateCommonOptions,
  parseCommandArguments,
} from "@/cli/handlers/command-handlers.js";
import { ModifyCommandConfig } from "@/cli/parsers/command-configs.js";
import { modifyDockerCompose } from "@/docker/compose/docker-compose-modifier.js";
import { Logger } from "@/utils/logging/logger.js";

export async function handleModifyCommand(argv: string[]): Promise<void> {
  try {
    const parsed = parseCommandArguments(argv, ModifyCommandConfig);

    if (parsed.help) {
      handleCommandHelp(MODIFY_HELP_TEXT);
      return;
    }

    if (!parsed.file || typeof parsed.file !== "string") {
      console.error("Error: --file is required for modify command and must be a string");
      process.exit(1);
    }

    const { verbose } = parseAndValidateCommonOptions(parsed);
    const logger = new Logger({ verbose, quiet: false });

    console.log(`Modifying docker-compose file: ${parsed.file}`);
    const modifyResult = await modifyDockerCompose(parsed.file, logger);

    if (!modifyResult.success) {
      console.error("❌ Modify failed:");
      for (const error of modifyResult.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }

    if (modifyResult.modifiedServices.length > 0) {
      console.log(`✅ Successfully modified ${modifyResult.modifiedServices.length} services:`);
      for (const service of modifyResult.modifiedServices) {
        console.log(`  - ${service}`);
      }
    } else {
      console.log("ℹ️  No modifications were needed");
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
