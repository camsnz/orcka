import { execSync } from "node:child_process";

export function runComposeUp({
  composeFiles,
  quiet,
  services,
  detached,
}: {
  composeFiles: string[];
  quiet: boolean;
  services?: string[];
  detached?: boolean;
}): void {
  if (composeFiles.length === 0) {
    throw new Error("At least one compose file must be provided");
  }

  const stdio = quiet ? "pipe" : "inherit";
  const fileArgs = composeFiles.map((file) => `--file ${file}`).join(" ");
  const detachedFlag = detached ? " -d" : "";
  const servicesArgs = services && services.length > 0 ? ` ${services.join(" ")}` : "";

  execSync(`docker compose ${fileArgs} up${detachedFlag}${servicesArgs}`, {
    stdio,
    env: process.env,
  });
}
