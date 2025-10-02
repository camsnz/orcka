/**
 * Command handler utilities for orcka CLI commands
 */

import { type CommandConfig, parseArguments } from "../parsers/arg-parser.js";
import { parseBooleanOptions, validateVerboseQuietOptions } from "../utilities/cli-command-utils.js";

/**
 * Common command handler pattern for parsing arguments and validating options
 */
export function parseCommandArguments<T extends Record<string, unknown>>(argv: string[], config: CommandConfig): T {
  return parseArguments(argv, config) as T;
}

/**
 * Handle help display for commands
 */
export function handleCommandHelp(helpText: string): void {
  console.log(helpText);
  process.exit(0);
}

/**
 * Parse and validate common CLI options (verbose, quiet)
 */
export function parseAndValidateCommonOptions(result: Record<string, unknown>): {
  verbose: boolean;
  quiet: boolean;
} {
  const { verbose, quiet } = parseBooleanOptions(result);
  validateVerboseQuietOptions(verbose, quiet);
  return { verbose, quiet };
}

/**
 * Standard help text for stat command
 */
export const STAT_HELP_TEXT = `
Usage: orcka stat [options]

Validate the manifest, calculate deterministic tags, and write the HCL output.

Options:
  --file <path>                        Path to orcka configuration file (optional, auto-detected if not provided).
  --dotfile <path>                     Generate GraphViz DOT file for dependency visualization.
  --ascii                              Display ASCII tree visualization of dependencies.
  --verbose, -v                        Output detailed information about the calculation process.
  --quiet, -q                          Suppress all output except errors.
  --help                               Show this help message.

Examples:
  orcka stat
  orcka stat --file docker-sha.yml
  orcka stat --dotfile services.dot
  orcka stat --ascii
  orcka stat --verbose
  orcka stat --quiet
`;

/**
 * Standard help text for modify command
 */
export const MODIFY_HELP_TEXT = `
Usage: orcka modify [options]

Modify docker-compose.yml files to use calculated TAG_VER variables.

Options:
  --file <path>                        Path to docker-compose.yml file to modify (required).
  --verbose, -v                        Output detailed information about the modification process.
  --help                              Show this help message.

Examples:
  orcka modify --file docker-compose.yml
  orcka modify --file docker-compose.yml --verbose
`;

/**
 * Standard help text for build command
 */
export const BUILD_HELP_TEXT = `
Usage: orcka build [options]

Build Docker images using docker buildx bake with orcka integration.

Options:
  --file <path>                        Path to orcka configuration file (optional, auto-detected if not provided).
  --target <name>                      Specific target to build (optional, builds all targets if not specified).
  --extra-bake <path>                  Additional bake files to include in the build.
  --extra-compose <path>               Additional compose files to include in the build.
  --skip-validation                    Skip Docker environment validation.
  --pull-policy <value>                pull_policy value to use in generated compose overrides (default: never).
  --verbose, -v                        Output detailed information about the build process.
  --quiet, -q                          Suppress all output except errors.
  --help                              Show this help message.

Examples:
  orcka build
  orcka build --file orcka.yaml
  orcka build --target web-app
  orcka build --extra-bake additional.hcl
  orcka build --pull-policy always
`;

/**
 * Standard help text for up command
 */
export const UP_HELP_TEXT = `
Usage: orcka up [options]

Calculate deterministic tags and start the configured docker-compose runtime.

Options:
  --file <path>                        Path to orcka configuration file (optional, auto-detected if not provided).
  --pull-policy <value>                pull_policy value to use in the generated compose override (default: never).
  --verbose, -v                        Output detailed information about runtime execution.
  --quiet, -q                          Suppress informational output from the runtime stage.
  --help                               Show this help message.

Examples:
  orcka up
  orcka up audit-engine
  orcka up --pull-policy always
`;

/**
 * Standard help text for write command
 */
export const WRITE_HELP_TEXT = `
Usage: orcka write [options]

Generate docker-sha.hcl and a docker-compose override file with pull_policy values.

Options:
  --file <path>          Path to orcka configuration file (auto-detected if not provided).
  --output, -o <path>    Path to write docker-compose override file (default: docker-compose.orcka.override.yml).
  --pull-policy <value>  pull_policy value to apply (default: never).
  --help                 Show this help message.

Examples:
  orcka write
  orcka write --pull-policy always
  orcka write --output compose.override.yml
`;

/**
 * Standard help text for workflow command
 */
export const WORKFLOW_HELP_TEXT = `
Usage: orcka workflow [options]

Run the fast cached build workflow: stat, registry checks, image validation, bake, and compose up.

Options:
  --file <path>                        Path to orcka configuration file (optional, auto-detected if not provided).
  --ancestry                           Display dependency ancestry output during stat phase.
  --skip-bake                          Skip docker buildx bake execution.
  --skip-up                            Skip docker compose up step.
  --pull-policy <value>                pull_policy value to use in the generated compose override (default: never).
  --verbose, -v                        Output detailed information about each workflow stage.
  --quiet, -q                          Suppress all output except errors.
  --help                               Show this help message.

Examples:
  orcka workflow
  orcka workflow --ancestry
  orcka workflow --skip-bake --skip-up
`;

/**
 * Standard help text for run command
 */
export const RUN_HELP_TEXT = `
Usage: orcka run [services...] [options]

Intelligent workflow that assesses image availability and auto-builds missing images before starting services.
Performs: stat → assess → build (if needed) → up.

Positional Arguments:
  services                             List of services to run (optional, runs all services if not specified).

Options:
  --file <path>                        Path to orcka configuration file (optional, auto-detected if not provided).
  --target <name>                      Specific target to include (optional).
  --skip-build                         Skip automatic image building even if images are missing.
  --detached, -d                       Run services in detached mode (background).
  --pull-policy <value>                pull_policy value to use in the generated compose override (default: never).
  --verbose, -v                        Output detailed information about each step.
  --quiet, -q                          Suppress all output except errors.
  --help                               Show this help message.

Examples:
  orcka run                            # Assess, build if needed, and start all services
  orcka run web api                    # Run specific services
  orcka run --skip-build               # Run without building (fail if images missing)
  orcka run --detached                 # Run in background
`;
