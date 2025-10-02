/**
 * Command configurations for orcka CLI using the reusable argument parser
 */

import type { CommandConfig } from "./arg-parser.js";
import { CommonArgs } from "./arg-parser.js";

export const StatCommandConfig: CommandConfig = {
  name: "stat",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    dotfile: {
      names: ["--dotfile"],
      description: "Generate DOT file for visualizing service relationships and rebuild criteria",
      hasValue: true,
      required: false,
    },
    ascii: {
      names: ["--ascii"],
      description: "Display ASCII tree visualization of service dependencies and rebuild criteria",
      hasValue: false,
      required: false,
    },
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information about each step of the process",
      hasValue: false,
      required: false,
    },
    quiet: {
      names: ["--quiet", "-q"],
      description: "Suppress all output except errors",
      hasValue: false,
      required: false,
    },
  },
  examples: [
    "orcka stat",
    "orcka stat --file docker-sha.yml",
    "orcka stat --dotfile services.dot",
    "orcka stat --ascii",
    "orcka stat --verbose",
    "orcka stat --quiet",
  ],
};

export const ModifyCommandConfig: CommandConfig = {
  name: "modify",
  args: {
    file: {
      names: ["--file", "-f"],
      description: "Path to docker-compose.yml file to modify",
      hasValue: true,
      required: true,
    },
    help: CommonArgs.help,
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information about modifications",
      hasValue: false,
      required: false,
    },
  },
  examples: ["orcka modify --file docker-compose.yml", "orcka modify -f docker-compose.yml --verbose"],
};

export const BuildCommandConfig: CommandConfig = {
  name: "build",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    target: {
      names: ["--target", "-t"],
      description: "Specific target to build (optional, builds all targets if not specified)",
      hasValue: true,
      required: false,
    },
    "extra-bake": {
      names: ["--extra-bake"],
      description: "Additional bake files to include in the build",
      hasValue: true,
      required: false,
    },
    "extra-compose": {
      names: ["--extra-compose"],
      description: "Additional compose files to include in the build",
      hasValue: true,
      required: false,
    },
    "skip-validation": {
      names: ["--skip-validation"],
      description: "Skip Docker environment validation",
      hasValue: false,
      required: false,
    },
    "pull-policy": {
      names: ["--pull-policy"],
      description: "Override pull_policy when generating compose overrides",
      hasValue: true,
      required: false,
    },
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information about the build process",
      hasValue: false,
      required: false,
    },
    quiet: {
      names: ["--quiet", "-q"],
      description: "Suppress all output except errors",
      hasValue: false,
      required: false,
    },
  },
  examples: [
    "orcka build",
    "orcka build --file orcka.yaml",
    "orcka build --target web-app",
    "orcka build --extra-bake additional.hcl",
    "orcka build --pull-policy always",
    "orcka build --verbose",
  ],
};

export const UpCommandConfig: CommandConfig = {
  name: "up",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    "pull-policy": {
      names: ["--pull-policy"],
      description: "Override pull_policy when generating compose overrides",
      hasValue: true,
      required: false,
    },
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information about runtime execution",
      hasValue: false,
      required: false,
    },
    quiet: {
      names: ["--quiet", "-q"],
      description: "Suppress informational output from the runtime stage",
      hasValue: false,
      required: false,
    },
  },
  examples: ["orcka up", "orcka up audit-engine", "orcka up --pull-policy always"],
};

export const WriteCommandConfig: CommandConfig = {
  name: "write",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    output: {
      names: ["--output", "-o"],
      description: "Path to write docker-compose override file",
      hasValue: true,
      required: false,
    },
    "pull-policy": {
      names: ["--pull-policy"],
      description: "pull_policy value to apply to each service",
      hasValue: true,
      required: false,
    },
  },
  examples: ["orcka write", "orcka write --output compose.override.yml", "orcka write --pull-policy always"],
};

export const WorkflowCommandConfig: CommandConfig = {
  name: "workflow",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    ancestry: {
      names: ["--ancestry"],
      description: "Display dependency ancestry as part of the workflow run",
      hasValue: false,
      required: false,
    },
    "skip-bake": {
      names: ["--skip-bake"],
      description: "Skip docker buildx bake execution",
      hasValue: false,
      required: false,
    },
    "skip-up": {
      names: ["--skip-up"],
      description: "Skip docker compose up after generating overrides",
      hasValue: false,
      required: false,
    },
    "pull-policy": {
      names: ["--pull-policy"],
      description: "Override pull_policy when generating compose overrides",
      hasValue: true,
      required: false,
    },
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information about each workflow stage",
      hasValue: false,
      required: false,
    },
    quiet: {
      names: ["--quiet", "-q"],
      description: "Suppress informational output from the workflow",
      hasValue: false,
      required: false,
    },
  },
  examples: ["orcka workflow", "orcka workflow --ancestry", "orcka workflow --skip-bake --skip-up"],
};

export const RunCommandConfig: CommandConfig = {
  name: "run",
  args: {
    file: CommonArgs.file,
    help: CommonArgs.help,
    target: {
      names: ["--target"],
      description: "Specific target to include",
      hasValue: true,
      required: false,
    },
    "pull-policy": {
      names: ["--pull-policy"],
      description: "Override pull_policy when generating compose overrides",
      hasValue: true,
      required: false,
    },
    "skip-build": {
      names: ["--skip-build"],
      description: "Skip automatic image building even if images are missing",
      hasValue: false,
      required: false,
    },
    detached: {
      names: ["--detached", "-d"],
      description: "Run services in detached mode (background)",
      hasValue: false,
      required: false,
    },
    verbose: {
      names: ["--verbose", "-v"],
      description: "Output detailed information",
      hasValue: false,
      required: false,
    },
    quiet: {
      names: ["--quiet", "-q"],
      description: "Suppress informational output",
      hasValue: false,
      required: false,
    },
  },
  examples: [
    "orcka run",
    "orcka run web api",
    "orcka run --skip-build",
    "orcka run --detached",
  ],
};
