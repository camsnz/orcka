import { execSync } from "node:child_process";

function runDockerCommand(command: string): boolean {
  try {
    execSync(command, { stdio: "pipe", encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

function getDockerCommandOutput(command: string): string | null {
  try {
    return execSync(command, { stdio: "pipe", encoding: "utf-8" });
  } catch {
    return null;
  }
}

// Internal types (not exported - TypeScript infers return types)
interface ImageAvailability {
  image: string;
  running: boolean;
  local: boolean;
  remote: boolean;
}

interface DockerAvailability {
  available: boolean;
  error?: string;
}

export function checkDockerAvailable(): DockerAvailability {
  try {
    execSync("docker info", {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 3000,
    });
    return { available: true };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Docker daemon unavailable",
    };
  }
}

export function checkImageAvailability(images: string[]): ImageAvailability[] {
  return images.map((image) => {
    // Check if image is running as a container
    const psOutput = getDockerCommandOutput(`docker ps --filter ancestor=${image} --format '{{.ID}}'`);
    const running = psOutput !== null && psOutput.trim().length > 0;

    // Check if image exists locally
    const local = runDockerCommand(`docker image inspect ${image}`);

    // Check if image exists on remote registry
    const remote = runDockerCommand(`docker manifest inspect ${image}`);

    return {
      image,
      running,
      local,
      remote,
    };
  });
}
