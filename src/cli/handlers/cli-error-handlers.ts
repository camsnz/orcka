/**
 * CLI error handling utilities for orcka commands
 */

import type { ValidationError, ValidationWarning } from "../../types.js";
import { Clout } from "../utilities/clout/index.js";

/**
 * Display validation errors in a consistent format
 */
export function displayValidationErrors(errors: ValidationError[]): void {
  console.log("❌ Validation failed");
  console.log("\nErrors:");

  for (const error of errors) {
    const targetInfo = error.target ? ` [${error.target}]` : "";
    const fieldInfo = error.field ? ` (${error.field})` : "";
    const pathInfo = error.path ? ` - ${error.path}` : "";
    console.log(`  ❌ ${error.message}${targetInfo}${fieldInfo}${pathInfo}`);
  }
}

/**
 * Display validation warnings in a consistent format
 */
export function displayValidationWarnings(warnings: ValidationWarning[]): void {
  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) {
      const targetInfo = warning.target ? ` [${warning.target}]` : "";
      console.log(`  ⚠️  ${warning.message}${targetInfo}`);
    }
  }
}

/**
 * Display success message with optional warnings
 */
export function displayValidationSuccess(warnings: ValidationWarning[]): void {
  console.log("✅ Validation successful");
  displayValidationWarnings(warnings);
}

/**
 * Display generic error messages from command results
 */
export function displayCommandErrors(errors: string[], commandName: string): void {
  console.error(`❌ ${commandName} failed:`);
  if (errors) {
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}

/**
 * Display success message for commands with service lists
 */
export function displayCommandSuccess(message: string, services?: string[], details?: string): void {
  console.log(Clout.statusLine("success", message));

  if (services && services.length > 0) {
    for (const service of services) {
      console.log(Clout.bullet(service));
    }
  }

  if (details) {
    console.log(details);
  }
}

/**
 * Handle conflicting CLI options
 */
export function handleConflictingOptions(option1: string, option2: string, message?: string): void {
  const defaultMessage = `Error: Cannot use ${option1} and ${option2} options together`;
  console.error(message || defaultMessage);
  process.exit(1);
}

/**
 * Handle missing configuration file scenarios
 */
export function handleMissingConfig(errorMessage: string, suggestions?: string[]): void {
  console.error(errorMessage);

  if (suggestions && suggestions.length > 0) {
    console.error("\nSuggestions:");
    for (const suggestion of suggestions) {
      console.error(`  - ${suggestion}`);
    }
  }

  process.exit(1);
}

/**
 * Configuration for error display formatting
 */
export interface ErrorDisplayConfig {
  showTargetInfo: boolean;
  showFieldInfo: boolean;
  showPathInfo: boolean;
  useColors: boolean;
}

/**
 * Default error display configuration
 */
export const DEFAULT_ERROR_CONFIG: ErrorDisplayConfig = {
  showTargetInfo: true,
  showFieldInfo: true,
  showPathInfo: true,
  useColors: true,
};

/**
 * Format a single validation error with custom configuration
 */
export function formatValidationError(
  error: ValidationError,
  config: ErrorDisplayConfig = DEFAULT_ERROR_CONFIG,
): string {
  let message = error.message;

  if (config.showTargetInfo && error.target) {
    message += ` [${error.target}]`;
  }

  if (config.showFieldInfo && error.field) {
    message += ` (${error.field})`;
  }

  if (config.showPathInfo && error.path) {
    message += ` - ${error.path}`;
  }

  const prefix = config.useColors ? "❌" : "ERROR:";
  return `  ${prefix} ${message}`;
}

/**
 * Format a single validation warning with custom configuration
 */
export function formatValidationWarning(
  warning: ValidationWarning,
  config: ErrorDisplayConfig = DEFAULT_ERROR_CONFIG,
): string {
  let message = warning.message;

  if (config.showTargetInfo && warning.target) {
    message += ` [${warning.target}]`;
  }

  const prefix = config.useColors ? "⚠️" : "WARNING:";
  return `  ${prefix}  ${message}`;
}
