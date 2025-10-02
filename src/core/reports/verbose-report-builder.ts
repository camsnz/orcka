import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ContextResolver } from "@/core/config/context-resolver.js";
import { parseBakeConfigs } from "@/core/validation/docker-sha-validator.js";
import type { DockerShaConfig } from "@/types.js";
import { resolveTagsOutputPath } from "@/utils/orcka-output-paths.js";

export interface VerboseConfigInfo {
  dockerShaFile: string;
  projectContext: string;
  bakeFiles: Array<{ path: string; exists: boolean }>;
  outputFile?: { path: string; exists: boolean };
  targets: Array<{
    name: string;
    contextOf: string;
    resolvedContext: string;
    dockerfile?: { path: string; exists: boolean };
    bakeFile?: { path: string; exists: boolean };
    bakeTarget?: string;
    files: Array<{ path: string; exists: boolean }>;
    jqFiles: Array<{
      file: { path: string; exists: boolean };
      selector: string;
    }>;
  }>;
}

interface BuildVerboseReportOptions {
  dockerShaFilePath: string;
  config: DockerShaConfig;
}

export async function buildVerboseReport({
  dockerShaFilePath,
  config,
}: BuildVerboseReportOptions): Promise<VerboseConfigInfo> {
  const contextResolver = new ContextResolver(dockerShaFilePath, config);
  const dockerShaFile = resolve(dockerShaFilePath);
  const projectContext = contextResolver.getOrckaContext();

  const bakeConfigs = config.project?.bake
    ? await parseBakeConfigs(config, dockerShaFilePath)
    : new Map<string, { target?: Record<string, { dockerfile?: string }> }>();
  contextResolver.setBakeConfigs(bakeConfigs);

  const bakeFiles: VerboseConfigInfo["bakeFiles"] =
    config.project?.bake?.map((bakeFile) => {
      const resolvedBakeFile = resolve(projectContext, bakeFile);
      return {
        path: resolvedBakeFile,
        exists: existsSync(resolvedBakeFile),
      };
    }) ?? [];

  const projectConfig = config.project ?? { name: "orcka", bake: [] };
  const outputFilePath = resolveTagsOutputPath(projectContext, projectConfig);
  const outputFile: VerboseConfigInfo["outputFile"] = {
    path: outputFilePath,
    exists: existsSync(outputFilePath),
  };

  const targets: VerboseConfigInfo["targets"] = [];
  for (const [targetName, targetConfig] of Object.entries(config.targets || {})) {
    const contextOf = targetConfig.context_of ?? "orcka";
    const resolvedContext = contextResolver.resolveTargetContext(targetName, targetConfig);

    let bakeFileInfo: { path: string; exists: boolean } | undefined;
    let bakeTarget: string | undefined;
    let originalBakeFilePath: string | undefined;

    for (const [bakeFilePath, bakeConfig] of bakeConfigs.entries()) {
      if (bakeConfig.target?.[targetName]) {
        const resolvedBakeFilePath = resolve(projectContext, bakeFilePath);
        bakeFileInfo = {
          path: resolvedBakeFilePath,
          exists: existsSync(resolvedBakeFilePath),
        };
        bakeTarget = targetName;
        originalBakeFilePath = bakeFilePath;
        break;
      }
    }

    let dockerfileInfo: { path: string; exists: boolean } | undefined;
    if (bakeFileInfo && originalBakeFilePath) {
      const bakeConfig = bakeConfigs.get(originalBakeFilePath);
      const dockerfilePath = bakeConfig?.target?.[targetName]?.dockerfile;
      if (dockerfilePath) {
        const resolvedDockerfile = resolve(resolvedContext, dockerfilePath);
        dockerfileInfo = {
          path: resolvedDockerfile,
          exists: existsSync(resolvedDockerfile),
        };
      }
    }

    const files: Array<{ path: string; exists: boolean }> = [];
    if (targetConfig.calculate_on?.files) {
      for (const file of targetConfig.calculate_on.files) {
        const resolvedFile = contextResolver.resolveFilePath(targetName, targetConfig, file);
        files.push({ path: resolvedFile, exists: existsSync(resolvedFile) });
      }
    }

    const jqFiles: Array<{
      file: { path: string; exists: boolean };
      selector: string;
    }> = [];
    if (targetConfig.calculate_on?.jq) {
      const jqConfig = targetConfig.calculate_on.jq;
      const resolvedJqFile = contextResolver.resolveFilePath(targetName, targetConfig, jqConfig.filename);
      jqFiles.push({
        file: {
          path: resolvedJqFile,
          exists: existsSync(resolvedJqFile),
        },
        selector: jqConfig.selector,
      });
    }

    targets.push({
      name: targetName,
      contextOf,
      resolvedContext,
      dockerfile: dockerfileInfo,
      bakeFile: bakeFileInfo,
      bakeTarget,
      files,
      jqFiles,
    });
  }

  return {
    dockerShaFile,
    projectContext,
    bakeFiles,
    outputFile,
    targets,
  };
}
