import { existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { DockerShaProjectConfig } from "@/types.js";

function normaliseBasename(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return basename(trimmed);
}

function getOrckaDirectory(projectContext: string): string {
  return resolve(projectContext, ".orcka");
}

export function ensureOrckaDirectory(projectContext: string): string {
  const directory = getOrckaDirectory(projectContext);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

function deriveTagsFileName(project: DockerShaProjectConfig): string {
  if (typeof project.write === "string") {
    const fromString = normaliseBasename(project.write);
    if (fromString) {
      return fromString;
    }
  }

  if (project.write && typeof project.write === "object") {
    const fromConfig = normaliseBasename(project.write.tags);
    if (fromConfig) {
      return fromConfig;
    }
  }

  const baseName = project.name?.trim() || "orcka";
  return `${baseName}.tags.hcl`;
}

function deriveComposeOverrideFileName(project?: DockerShaProjectConfig): string {
  if (project?.write && typeof project.write === "object") {
    const fromConfig = normaliseBasename(project.write.compose);
    if (fromConfig) {
      return fromConfig;
    }
  }

  return "docker-compose.orcka.override.yml";
}

export function resolveTagsOutputPath(projectContext: string, project: DockerShaProjectConfig): string {
  const directory = getOrckaDirectory(projectContext);
  return join(directory, deriveTagsFileName(project));
}

export function resolveComposeOverridePath(projectContext: string, project?: DockerShaProjectConfig): string {
  const directory = getOrckaDirectory(projectContext);
  const fileName = deriveComposeOverrideFileName(project);
  return join(directory, fileName);
}
