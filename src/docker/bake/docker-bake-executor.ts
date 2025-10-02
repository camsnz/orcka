/**
 * Docker Bake Executor for orcka
 * Executes docker buildx bake commands with orcka integration
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { resolveTagsOutputPath } from "@/utils/orcka-output-paths.js";
import type { DockerShaConfig } from "../../types.js";
import type { Logger } from "../../utils/logging/logger.js";
import type { GeneratedServiceResult } from "@/core/calculation/docker-sha/types.js";

interface BakeExecutionOptions {
  configFile: string;
  target?: string;
  targets?: string[];
  extraBakeFiles?: string[];
  extraComposeFiles?: string[];
  generatedServices?: GeneratedServiceResult[]; // NEW: For dual tagging
  verbose?: boolean;
  quiet?: boolean;
}

interface BakeExecutionResult {
  success: boolean;
  exitCode: number;
  output?: string;
  error?: string;
}

/**
 * Docker Bake Executor
 */
export class DockerBakeExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute docker buildx bake command with orcka configuration
   */
  async executeBake(options: BakeExecutionOptions): Promise<BakeExecutionResult> {
    try {
      // 1. Parse orcka configuration to get bake files
      const config = await this.parseOrckaConfig(options.configFile);

      // 2. Build docker buildx bake command
      const bakeCommand = this.buildBakeCommand(config, options);

      this.logger.verbose(`🏗️  Executing: ${bakeCommand.join(" ")}`);

      // 3. Execute the command
      return await this.runBakeCommand(bakeCommand, options);
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        error: `Failed to execute bake: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Parse orcka configuration file
   */
  private async parseOrckaConfig(configFile: string): Promise<DockerShaConfig> {
    const { parse: yamlParse } = await import("yaml");
    const { readFileSync } = await import("node:fs");

    if (!existsSync(configFile)) {
      throw new Error(`Configuration file not found: ${configFile}`);
    }

    const content = readFileSync(configFile, "utf-8");

    // Support both YAML and HCL formats
    if (configFile.endsWith(".hcl")) {
      // health-checks: ignore TODO until 2025-10-04      // TODO: Re-enable HCL parsing when async handling is implemented
      throw new Error("HCL config files are temporarily not supported. Please use YAML format.");
    } else {
      return yamlParse(content) as DockerShaConfig;
    }
  }

  /**
   * Build docker buildx bake command arguments
   */
  private buildBakeCommand(config: DockerShaConfig, options: BakeExecutionOptions): string[] {
    const command = ["docker", "buildx", "bake"];
    const configDir = dirname(options.configFile);
    const projectConfig = config.project ?? { name: "orcka", bake: [] };
    const projectContext = resolve(configDir, projectConfig.context ?? ".");

    // Add bake files from orcka configuration
    if (projectConfig.bake) {
      for (const bakeFile of projectConfig.bake) {
        const resolvedPath = resolve(projectContext, bakeFile);
        if (existsSync(resolvedPath)) {
          command.push("--file", resolvedPath);
          this.logger.verbose(`📄 Using bake file: ${resolvedPath}`);
        } else {
          this.logger.warn(`⚠️  Bake file not found: ${resolvedPath}`);
        }
      }
    }

    // Add extra bake files
    if (options.extraBakeFiles) {
      for (const extraFile of options.extraBakeFiles) {
        const resolvedPath = resolve(extraFile);
        if (existsSync(resolvedPath)) {
          command.push("--file", resolvedPath);
          this.logger.verbose(`📄 Using extra bake file: ${resolvedPath}`);
        } else {
          this.logger.warn(`⚠️  Extra bake file not found: ${resolvedPath}`);
        }
      }
    }

    // Add extra compose files
    if (options.extraComposeFiles) {
      for (const extraFile of options.extraComposeFiles) {
        const resolvedPath = resolve(extraFile);
        if (existsSync(resolvedPath)) {
          command.push("--file", resolvedPath);
          this.logger.verbose(`📄 Using extra compose file: ${resolvedPath}`);
        } else {
          this.logger.warn(`⚠️  Extra compose file not found: ${resolvedPath}`);
        }
      }
    }

    // Add generated HCL file with calculated tags
    const generatedHclPath = resolveTagsOutputPath(projectContext, projectConfig);
    if (existsSync(generatedHclPath)) {
      command.push("--file", generatedHclPath);
      this.logger.verbose(`📄 Using generated HCL: ${generatedHclPath}`);
    } else {
      this.logger.warn(`⚠️  Generated HCL file not found: ${generatedHclPath}`);
    }

    const targets =
      options.targets && options.targets.length > 0 ? options.targets : options.target ? [options.target] : [];

    // Add dual tagging via --set flags
    if (options.generatedServices) {
      const servicesWithComposeTags = options.generatedServices.filter((s) => s.composeTag && s.composeReference);
      
      for (const service of servicesWithComposeTags) {
        // Format: --set target.tags=image:orcka-tag,image:compose-tag
        const tagsValue = `${service.imageReference},${service.composeReference}`;
        command.push("--set", `${service.name}.tags=${tagsValue}`);
        this.logger.verbose(`🏷️  Dual tagging ${service.name}: ${service.imageReference}, ${service.composeReference}`);
      }
      
      if (servicesWithComposeTags.length > 0) {
        this.logger.verbose(`📝 Applied dual tagging to ${servicesWithComposeTags.length} services`);
      }
    }

    if (targets.length > 0) {
      for (const target of targets) {
        command.push(target);
      }
      this.logger.verbose(`🎯 Building targets: ${targets.join(", ")}`);
    } else {
      // Build all targets by default
      this.logger.verbose(`🎯 Building all targets`);
    }

    return command;
  }

  /**
   * Execute the docker buildx bake command
   */
  private async runBakeCommand(command: string[], options: BakeExecutionOptions): Promise<BakeExecutionResult> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command;

      this.logger.info(`🚀 Starting Docker build...`);

      const child = spawn(cmd, args, {
        stdio: options.quiet ? "pipe" : "inherit",
        env: process.env,
      });

      let output = "";
      let error = "";

      if (options.quiet) {
        child.stdout?.on("data", (data) => {
          output += data.toString();
        });

        child.stderr?.on("data", (data) => {
          error += data.toString();
        });
      }

      child.on("close", (code) => {
        const success = code === 0;

        if (success) {
          this.logger.success(`✅ Docker build completed successfully`);
        } else {
          this.logger.error(`❌ Docker build failed with exit code ${code}`);
        }

        resolve({
          success,
          exitCode: code || 0,
          output: output || undefined,
          error: error || undefined,
        });
      });

      child.on("error", (err) => {
        this.logger.error(`❌ Failed to start docker buildx bake: ${err.message}`);
        resolve({
          success: false,
          exitCode: 1,
          error: err.message,
        });
      });
    });
  }

  /**
   * Check if docker buildx bake is available
   */
  static async checkBakeAvailability(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      execSync("docker buildx bake --help", {
        stdio: "pipe",
        timeout: 5000,
      });
      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: `docker buildx bake not available: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Convenience function for executing docker bake
 */
export async function executeBake(options: BakeExecutionOptions, logger: Logger): Promise<BakeExecutionResult> {
  const executor = new DockerBakeExecutor(logger);
  return executor.executeBake(options);
}
