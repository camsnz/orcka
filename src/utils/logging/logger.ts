/**
 * Logging utility for orcka CLI with support for verbose and quiet modes
 */

import { Clout } from "@/cli/utilities/clout";

interface LoggerOptions {
  verbose: boolean;
  quiet: boolean;
}

export class Logger {
  private options: LoggerOptions;

  constructor(options: LoggerOptions = { verbose: false, quiet: false }) {
    this.options = options;
  }

  /**
   * Log an error message (always shown unless quiet mode conflicts)
   */
  error(message: string): void {
    console.error(Clout.statusLine("error", message));
  }

  /**
   * Log an info message (shown unless quiet mode is enabled)
   */
  info(message: string): void {
    if (!this.options.quiet) {
      console.log(Clout.statusLine("info", message));
    }
  }

  /**
   * Log a success message (shown unless quiet mode is enabled)
   */
  success(message: string): void {
    if (!this.options.quiet) {
      console.log(Clout.statusLine("success", message));
    }
  }

  /**
   * Log a verbose message (only shown in verbose mode)
   */
  verbose(message: string): void {
    if (this.options.verbose && !this.options.quiet) {
      console.log(`🔍 ${message}`);
    }
  }

  /**
   * Log a warning message (shown unless quiet mode is enabled)
   */
  warn(message: string): void {
    if (!this.options.quiet) {
      console.warn(Clout.statusLine("warning", message));
    }
  }

  /**
   * Log service generation summary
   */
  logServiceSummary(services: Array<{ name: string; varName: string; imageTag: string }>): void {
    if (this.options.quiet) return;

    if (services.length === 0) {
      this.info("No services with calculate_on criteria found");
      return;
    }

    this.info(`Generated ${services.length} service tag${services.length === 1 ? "" : "s"}:`);

    // Sort services alphabetically by varName
    const sortedServices = [...services].sort((a, b) => a.varName.localeCompare(b.varName));

    // Find the maximum length of varName for alignment, considering truncation
    const maxVarNameLength = Math.min(66, Math.max(...sortedServices.map((s) => s.varName.length)));

    for (const service of sortedServices) {
      // Truncate varName if longer than 66 characters
      const displayVarName = service.varName.length > 66 ? `${service.varName.substring(0, 63)}...` : service.varName;

      // Calculate padding needed for alignment
      const padding = maxVarNameLength - displayVarName.length;
      const spaces = " ".repeat(Math.max(0, padding));

      console.log(` ${displayVarName}:${spaces} "${service.imageTag}"`);
    }
  }

  /**
   * Log detailed service processing information
   */
  logServiceProcessing(serviceName: string, step: string, details?: string): void {
    if (!this.options.verbose || this.options.quiet) return;

    const message = details ? `${step}: ${details}` : step;
    console.log(`🔍 [${serviceName}] ${message}`);
  }

  /**
   * Update logger options
   */
  updateOptions(options: Partial<LoggerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
