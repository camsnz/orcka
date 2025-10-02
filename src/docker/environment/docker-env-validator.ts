/**
 * Docker Environment Validator for orcka
 * Validates Docker, Docker Buildx, and containerd versions and availability
 */

import { execSync } from "node:child_process";
import type { Logger } from "../../utils/logging/logger.js";

interface DockerVersion {
  version: string;
  apiVersion?: string;
  gitCommit?: string;
  buildTime?: string;
}

interface DockerBuildxVersion {
  version: string;
  gitCommit?: string;
}

interface ContainerdVersion {
  version: string;
  revision?: string;
}

interface DockerEnvironment {
  docker: DockerVersion;
  buildx?: DockerBuildxVersion;
  containerd?: ContainerdVersion;
  dockerRunning: boolean;
  buildxAvailable: boolean;
  containerdAvailable: boolean;
}

interface DockerValidationResult {
  valid: boolean;
  environment?: DockerEnvironment;
  errors: string[];
  warnings: string[];
}

/**
 * Minimum required versions for orcka functionality
 */
const MINIMUM_VERSIONS = {
  docker: "20.10.0",
  buildx: "0.8.0",
  containerd: "1.6.0",
} as const;

/**
 * Docker Environment Validator
 */
export class DockerEnvValidator {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Validate the complete Docker environment
   */
  async validateEnvironment(): Promise<DockerValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let environment: DockerEnvironment | undefined;

    this.logger?.verbose("🐳 Validating Docker environment...");

    try {
      // Check Docker
      const dockerVersion = await this.getDockerVersion();
      const dockerRunning = await this.isDockerRunning();

      // Check Docker Buildx
      const buildxDetection = await this.detectBuildx();
      const buildxVersion = buildxDetection.version;
      const buildxAvailable = buildxDetection.available;

      // Check containerd
      const containerdVersion = await this.getContainerdVersion();
      const containerdAvailable = containerdVersion !== null;

      environment = {
        docker: dockerVersion,
        buildx: buildxVersion || undefined,
        containerd: containerdVersion || undefined,
        dockerRunning,
        buildxAvailable,
        containerdAvailable,
      };

      // Validate versions
      if (!this.isVersionSufficient(dockerVersion.version, MINIMUM_VERSIONS.docker)) {
        errors.push(`Docker version ${dockerVersion.version} is below minimum required ${MINIMUM_VERSIONS.docker}`);
      }

      if (
        buildxVersion &&
        buildxVersion.version !== "unknown" &&
        !this.isVersionSufficient(buildxVersion.version, MINIMUM_VERSIONS.buildx)
      ) {
        errors.push(
          `Docker Buildx version ${buildxVersion.version} is below minimum required ${MINIMUM_VERSIONS.buildx}`,
        );
      }

      if (containerdVersion && !this.isVersionSufficient(containerdVersion.version, MINIMUM_VERSIONS.containerd)) {
        warnings.push(
          `containerd version ${containerdVersion.version} is below recommended ${MINIMUM_VERSIONS.containerd}`,
        );
      }

      // Check runtime status
      if (!dockerRunning) {
        errors.push("Docker daemon is not running. Please start Docker.");
      }

      if (!buildxAvailable) {
        errors.push("Docker Buildx is not available. orcka requires Buildx for multi-platform builds.");
      }

      if (!containerdAvailable) {
        warnings.push("containerd is not available. This may affect some advanced Docker features.");
      }

      // Log results
      if (this.logger) {
        this.logEnvironmentInfo(environment);
      }
    } catch (error) {
      errors.push(`Failed to validate Docker environment: ${error instanceof Error ? error.message : String(error)}`);
    }

    const valid = errors.length === 0;

    if (valid) {
      this.logger?.verbose("✅ Docker environment validation passed");
    } else {
      this.logger?.verbose("❌ Docker environment validation failed");
    }

    return {
      valid,
      environment,
      errors,
      warnings,
    };
  }

  /**
   * Get Docker version information
   */
  private async getDockerVersion(): Promise<DockerVersion> {
    try {
      const output = execSync("docker version --format json", {
        encoding: "utf-8",
        timeout: 5000,
      });

      const versionInfo = JSON.parse(output);
      const client = versionInfo.Client;

      return {
        version: client.Version,
        apiVersion: client.ApiVersion,
        gitCommit: client.GitCommit,
        buildTime: client.BuildTime,
      };
    } catch (error) {
      throw new Error(`Failed to get Docker version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if Docker daemon is running
   */
  private async isDockerRunning(): Promise<boolean> {
    try {
      execSync("docker info", {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker Buildx version information
   */
  private async detectBuildx(): Promise<{
    version: DockerBuildxVersion | null;
    available: boolean;
  }> {
    const commands = ['docker buildx version --format "{{json .}}"', "docker buildx version"];

    let fallbackOutput: string | null = null;

    for (const command of commands) {
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout: 5000,
          stdio: "pipe",
        });

        const parsed = this.parseBuildxVersionOutput(output);
        if (parsed) {
          return { version: parsed, available: true };
        }
        fallbackOutput = output;
      } catch {}
    }

    if (fallbackOutput && fallbackOutput.trim().length > 0) {
      return { version: { version: "unknown" }, available: true };
    }

    return { version: null, available: false };
  }

  private parseBuildxVersionOutput(output: string): DockerBuildxVersion | null {
    const trimmed = output.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("{")) {
      try {
        const data = JSON.parse(trimmed) as {
          Version?: string;
          version?: string;
          BuildxVersion?: string;
          buildxVersion?: string;
          GitCommit?: string;
          gitCommit?: string;
          Revision?: string;
          revision?: string;
          BuildxCommit?: string;
          buildxCommit?: string;
        };
        const version = data.Version ?? data.version ?? data.BuildxVersion ?? data.buildxVersion;
        if (typeof version === "string" && version.length > 0) {
          return {
            version: version.replace(/^v/, ""),
            gitCommit:
              data.GitCommit ??
              data.gitCommit ??
              data.BuildxCommit ??
              data.buildxCommit ??
              data.Revision ??
              data.revision,
          };
        }
      } catch {
        // Fallback to plain-text parsing below
      }
    }

    const versionMatch = trimmed.match(/v?(\d+\.\d+\.\d+(?:-[\w.+]+)?)/);
    if (versionMatch) {
      const commitMatch = trimmed.match(/\b([a-f0-9]{7,})\b/);
      return {
        version: versionMatch[1],
        gitCommit: commitMatch?.[1],
      };
    }

    return null;
  }

  /**
   * Get containerd version information
   */
  private async getContainerdVersion(): Promise<ContainerdVersion | null> {
    // Try direct containerd command first
    try {
      const output = execSync("containerd --version", {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });

      // Parse output like: "containerd github.com/containerd/containerd v1.6.24 61f9fd88f79f081d64d6fa3bb1a0dc71ec870523"
      const match = output.match(/containerd.*?v(\d+\.\d+\.\d+(?:-\w+)?)\s+([a-f0-9]+)?/);
      if (match) {
        return {
          version: match[1],
          revision: match[2],
        };
      }
    } catch {
      // Fallback: try to parse from docker version
      // On Docker Desktop, containerd is bundled and not in PATH
      try {
        const dockerVersionOutput = execSync("docker version", {
          encoding: "utf-8",
          timeout: 5000,
          stdio: "pipe",
        });

        // Look for containerd info in docker version output
        // Format: "  Version:          1.7.27" under "containerd:" section
        const lines = dockerVersionOutput.split("\n");
        let inContainerdSection = false;
        for (const line of lines) {
          if (line.trim().startsWith("containerd:")) {
            inContainerdSection = true;
            continue;
          }
          if (inContainerdSection && line.includes("Version:")) {
            const versionMatch = line.match(/Version:\s+(\d+\.\d+\.\d+(?:-\w+)?)/);
            if (versionMatch) {
              return {
                version: versionMatch[1],
                revision: undefined,
              };
            }
          }
          // Stop if we hit another section
          if (inContainerdSection && line.match(/^\s*[a-z-]+:$/i)) {
            break;
          }
        }
      } catch {
        // Ignore fallback errors
      }
    }

    return null;
  }

  /**
   * Compare version strings (semantic versioning)
   */
  private isVersionSufficient(current: string, minimum: string): boolean {
    const currentParts = current.replace(/^v/, "").split(".").map(Number);
    const minimumParts = minimum.split(".").map(Number);

    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const minimumPart = minimumParts[i] || 0;

      if (currentPart > minimumPart) return true;
      if (currentPart < minimumPart) return false;
    }

    return true; // Equal versions are sufficient
  }

  /**
   * Log environment information
   */
  private logEnvironmentInfo(env: DockerEnvironment): void {
    if (!this.logger) return;

    this.logger.verbose("🐳 Docker Environment:");
    this.logger.verbose(`  Docker: ${env.docker.version} (API: ${env.docker.apiVersion})`);
    this.logger.verbose(`  Docker Running: ${env.dockerRunning ? "✅" : "❌"}`);

    if (env.buildx) {
      this.logger.verbose(`  Buildx: ${env.buildx.version} ${env.buildxAvailable ? "✅" : "❌"}`);
    } else {
      this.logger.verbose(`  Buildx: Not available ❌`);
    }

    if (env.containerd) {
      this.logger.verbose(`  containerd: ${env.containerd.version} ${env.containerdAvailable ? "✅" : "⚠️"}`);
    } else {
      this.logger.verbose(`  containerd: Not available ⚠️`);
    }
  }
}

/**
 * Convenience function for quick Docker environment validation
 */
export async function validateDockerEnvironment(logger?: Logger): Promise<DockerValidationResult> {
  const validator = new DockerEnvValidator(logger);
  return validator.validateEnvironment();
}
