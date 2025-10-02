/**
 * CLI command execution utilities for orcka commands
 */

import { ConfigDiscovery } from "../../core/config/config-discovery.js";
import { displayCommandErrors, handleConflictingOptions, handleMissingConfig } from "../handlers/cli-error-handlers.js";
import { Clout } from "./clout/index.js";

/**
 * Configuration for command execution
 */
export interface CommandExecutionConfig {
  verbose?: boolean;
  quiet?: boolean;
  file?: string;
}

/**
 * Result of command execution
 */
export interface CommandExecutionResult {
  success: boolean;
  errors?: string[];
  inputFile?: string;
}

/**
 * Validate conflicting verbose/quiet options
 */
export function validateVerboseQuietOptions(verbose: boolean, quiet: boolean): void {
  if (verbose && quiet) {
    handleConflictingOptions("--verbose", "--quiet", "Error: --verbose and --quiet options cannot be used together");
  }
}

/**
 * Resolve input file from arguments or auto-discovery
 */
export function resolveInputFile(fileArg: string | undefined, quiet = false): string {
  if (fileArg) {
    // User specified a file, use it directly
    if (!quiet) {
      console.log(`Using specified configuration file: ${fileArg}`);
    }
    return fileArg;
  }

  // Auto-discover configuration file
  const discovery = new ConfigDiscovery();
  const discoveryResult = discovery.findConfigFile(".");

  if (!discoveryResult.found) {
    handleMissingConfig(discovery.getNotFoundMessage("."), [
      "Create an orcka.yml or docker-orcka.yml file",
      "Use --file option to specify path",
    ]);
  }

  const inputFile = discoveryResult.filePath ?? "";
  if (!quiet) {
    console.log(`🔍 Found configuration: ${discoveryResult.fileName}`);
  }

  return inputFile;
}

/**
 * Handle command result with consistent error display
 */
export function handleCommandResult(
  result: CommandExecutionResult,
  commandName: string,
  successMessage?: string,
): void {
  if (result.success) {
    if (successMessage) {
      console.log(Clout.statusLine("success", successMessage));
    }
    // Success output is typically handled by the command itself
  } else {
    displayCommandErrors(result.errors || [], commandName);
    process.exit(1);
  }
}

/**
 * Parse boolean options from command arguments
 */
export function parseBooleanOptions(result: Record<string, unknown>): {
  verbose: boolean;
  quiet: boolean;
} {
  return {
    verbose: Boolean(result.verbose),
    quiet: Boolean(result.quiet),
  };
}

/**
 * Extract file argument from command result
 */
export function extractFileArgument(result: Record<string, unknown>): string | undefined {
  return typeof result.file === "string" ? result.file : undefined;
}

/**
 * Common command execution pattern
 */
export async function executeCommand<T extends CommandExecutionResult>(
  commandName: string,
  config: CommandExecutionConfig,
  executor: (inputFile: string, config: CommandExecutionConfig) => Promise<T>,
  successMessage?: string,
): Promise<void> {
  // Validate options
  validateVerboseQuietOptions(config.verbose || false, config.quiet || false);

  // Resolve input file
  const inputFile = resolveInputFile(config.file, config.quiet);

  // Execute command
  const result = await executor(inputFile, config);

  // Handle result
  handleCommandResult(result, commandName, successMessage);
}

/**
 * Configuration discovery utilities
 */
export class CommandConfigDiscovery {
  private discovery: ConfigDiscovery;

  constructor(discovery?: ConfigDiscovery) {
    this.discovery = discovery || new ConfigDiscovery();
  }

  /**
   * Find configuration file with error handling
   */
  findConfigFile(directory = "."): string {
    const result = this.discovery.findConfigFile(directory);

    if (!result.found) {
      handleMissingConfig(this.discovery.getNotFoundMessage(directory), [
        "Create an orcka.yml or docker-orcka.yml file",
        "Use --file option to specify configuration path",
      ]);
    }

    return result.filePath ?? "";
  }

  /**
   * Get discovery result with logging
   */
  findConfigFileWithLogging(directory = ".", quiet = false): string {
    const result = this.discovery.findConfigFile(directory);

    if (!result.found) {
      handleMissingConfig(this.discovery.getNotFoundMessage(directory));
    }

    const inputFile = result.filePath ?? "";
    if (!quiet) {
      console.log(`🔍 Found configuration: ${result.fileName}`);
    }

    return inputFile;
  }
}
