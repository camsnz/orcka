#!/usr/bin/env node

import { handleBuildCommand } from "@/cli/commands/build-command.js";
import { handleDownCommand } from "@/cli/commands/down-command.js";
import { handleModifyCommand } from "@/cli/commands/modify-command.js";
import { handleRunCommand } from "@/cli/commands/run-command.js";
import { handleStatCommand } from "@/cli/commands/stat-command.js";
import { handleUpCommand } from "@/cli/commands/up-command.js";
import { handleWorkflowCommand } from "@/cli/commands/workflow-command.js";
import { handleWriteCommand } from "@/cli/commands/write-command.js";
import { showMainUsage, showVersion } from "@/cli/utilities/cli-utilities.js";

type CommandHandler = (args: string[]) => Promise<void> | void;

const COMMAND_REGISTRY: Record<string, CommandHandler> = {
  stat: (args) => handleStatCommand(args),
  write: handleWriteCommand,
  modify: handleModifyCommand,
  build: handleBuildCommand,
  up: handleUpCommand,
  down: handleDownCommand,
  run: handleRunCommand,
  workflow: handleWorkflowCommand,
};

const GLOBAL_FLAGS: Record<string, () => void> = {
  "--help": () => {
    showMainUsage();
    process.exit(0);
  },
  "-h": () => {
    showMainUsage();
    process.exit(0);
  },
  "--version": () => {
    showVersion();
    process.exit(0);
  },
  "-v": () => {
    showVersion();
    process.exit(0);
  },
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showMainUsage();
    process.exit(0);
  }

  const command = args[0];

  if (command in GLOBAL_FLAGS) {
    GLOBAL_FLAGS[command]();
    return;
  }

  if (command in COMMAND_REGISTRY) {
    await COMMAND_REGISTRY[command](args.slice(1));
    return;
  }

  console.error(`Unknown command: ${command}`);
  showMainUsage();
  process.exit(1);
}

if (require.main === module) {
  main();
}

export { main };
