import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function resolveDockerConfigPath(): string {
  const customConfig = process.env.DOCKER_CONFIG;
  if (customConfig && customConfig.length > 0) {
    return customConfig;
  }

  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(homeDir, ".docker", "config.json");
}

function loadAuthMap(): Record<string, unknown> {
  try {
    const configPath = resolveDockerConfigPath();
    if (!existsSync(configPath)) {
      return {};
    }

    const contents = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(contents) as { auths?: Record<string, unknown> };
    return parsed.auths ?? {};
  } catch {
    return {};
  }
}

function registryHasAuth(registryName: string, auths: Record<string, unknown>): boolean {
  const candidates = [
    registryName,
    `https://${registryName}`,
    `https://${registryName}/v1/`,
    `https://${registryName}/v2/`,
  ];

  return candidates.some((candidate) => candidate in auths);
}

export function gatherRegistryInfo(): Array<{
  name: string;
  authenticated: boolean;
}> {
  try {
    const raw = execSync("docker info --format {{json .RegistryConfig.IndexConfigs}}", { encoding: "utf-8" });

    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const auths = loadAuthMap();

    return Object.keys(parsed)
      .sort()
      .map((name) => ({
        name,
        authenticated: registryHasAuth(name, auths),
      }));
  } catch {
    return [];
  }
}
