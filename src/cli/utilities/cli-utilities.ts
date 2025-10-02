/**
 * CLI utilities for orcka - banner, version, and usage display functions
 */

import { Clout } from "./clout";

// Build info - will be replaced during build
const BUILD_INFO = {
  buildDate: "${BUILD_DATE}",
  gitSha: "${GIT_SHA}",
  gitBranch: "${GIT_BRANCH}",
  repoUrl: "https://github.com/camsnz/orcka",
};

/**
 * Generate the orcka banner string
 */
const orckaBanner = () =>
  Clout.banner("Orca: orchestrate docker/compose/bake with advanced shasum-tag integration", {
    dividerChar: "-",
    align: "center",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
  });

/**
 * Display version information
 */
export function showVersion(): void {
  console.log(orckaBanner());
  console.log();
  console.log(Clout.keyValue("Version", BUILD_INFO.gitSha, { keyWidth: 10 }));
  console.log(Clout.keyValue("Built", BUILD_INFO.buildDate, { keyWidth: 10 }));
  console.log(Clout.keyValue("Branch", BUILD_INFO.gitBranch, { keyWidth: 10 }));
  console.log(Clout.keyValue("Source", BUILD_INFO.repoUrl, { keyWidth: 10 }));
}

/**
 * Display main usage information for the CLI tool
 */
export function showMainUsage(): void {
  console.log(orckaBanner());
  console.log(`
Usage: orcka [command] [options]

Commands:
  stat               Validate configuration, compute tags, and emit HCL
  write              Generate docker-sha.hcl and compose overrides
  modify             Modify docker-compose.yml with calculated tags
  build              Build docker images using calculated tags
  up                 Start services using docker compose
  down               Stop and remove services, networks, and volumes
  run                Assess, auto-build missing images, and start services
  workflow           Run stat, checks, bake, and compose up as a single pipeline

Global Options:
  --help, -h   Show this help message
  --version, -v Show version information

Examples:
  orcka stat                     # Run validation and tag generation
  orcka stat --file orcka.yml    # Stat a specific config file
  orcka write                    # Write docker-sha.hcl and compose overrides
  orcka build --target web       # Build specific target with calculated tags
  orcka up                       # Start all services
  orcka down --volumes           # Stop services and remove volumes
  orcka run                      # Smart run: assess, build if needed, start
  orcka workflow                 # Execute the cached-build workflow

For command-specific help, use: orcka [command] --help
`);
}

/**
 * Configuration for build info replacement during build process
 */
export const BUILD_INFO_CONFIG = BUILD_INFO;
