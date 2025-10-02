import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DockerBakeTarget, DockerShaCalculateOnConfig } from "@/types.js";
import type { Logger } from "@/utils/logging/logger.js";

/**
 * Builds the string input for hashing based on various criteria.
 */
export async function buildHashInput(
  bakeTarget: DockerBakeTarget,
  calculateOn: DockerShaCalculateOnConfig | undefined,
  resolvedTags: Map<string, string>,
  projectDir: string,
  logger: Logger,
  serviceName: string,
): Promise<string> {
  const hashParts: string[] = [];

  // 1. Dockerfile content
  if (bakeTarget.dockerfile) {
    try {
      const dockerfilePath = join(bakeTarget.context ?? ".", bakeTarget.dockerfile);
      const dockerfileContent = readFileSync(join(projectDir, dockerfilePath), "utf-8");
      hashParts.push(`dockerfile:${dockerfileContent}`);
      logger.logServiceProcessing(serviceName, "Added dockerfile content to hash");
    } catch {
      hashParts.push(`dockerfile-path:${bakeTarget.dockerfile}`);
      logger.logServiceProcessing(serviceName, "Added dockerfile path to hash (content not readable)");
    }
  }

  // 2. Build args
  if (bakeTarget.args) {
    const sortedArgs = Object.keys(bakeTarget.args).sort();
    for (const key of sortedArgs) {
      hashParts.push(`arg:${key}=${bakeTarget.args[key]}`);
    }
  }

  // 3. Resolved dependency tags
  if (bakeTarget.depends_on) {
    const sortedDeps = [...bakeTarget.depends_on].sort();
    for (const dep of sortedDeps) {
      const resolvedTag = resolvedTags.get(dep);
      if (resolvedTag) {
        hashParts.push(`dep:${dep}=${resolvedTag}`);
      }
    }
  }

  // 4. Context TAG_VER values (if contexts reference other targets)
  if (bakeTarget.contexts && typeof bakeTarget.contexts === "object") {
    const sortedContexts = Object.keys(bakeTarget.contexts).sort();
    for (const contextKey of sortedContexts) {
      const contextValue = bakeTarget.contexts[contextKey];
      // Check if the context value references another target's TAG_VER
      const resolvedContextTag = resolvedTags.get(contextValue);
      if (resolvedContextTag) {
        hashParts.push(`context:${contextKey}=${resolvedContextTag}`);
        logger.logServiceProcessing(serviceName, `Added context dependency: ${contextKey}=${resolvedContextTag}`);
      } else {
        // Include the context value itself in the hash
        hashParts.push(`context:${contextKey}=${contextValue}`);
      }
    }
  }

  // 5. `calculate_on` criteria from docker-sha.yml
  if (calculateOn) {
    // Files
    if (calculateOn.files) {
      for (const filePath of calculateOn.files) {
        try {
          const fileContent = readFileSync(join(projectDir, filePath), "utf-8");
          hashParts.push(`file:${filePath}:${fileContent}`);
        } catch {
          hashParts.push(`file-path:${filePath}`);
        }
      }
    }

    // JQ
    if (calculateOn.jq) {
      try {
        const jqFileContent = readFileSync(join(projectDir, calculateOn.jq.filename), "utf-8");
        hashParts.push(`jq:${calculateOn.jq.filename}:${calculateOn.jq.selector}:${jqFileContent}`);
      } catch {
        hashParts.push(`jq-path:${calculateOn.jq.filename}:${calculateOn.jq.selector}`);
      }
    }

    // Period
    if (calculateOn.period) {
      if (typeof calculateOn.period === "string") {
        hashParts.push(`period:${calculateOn.period}`);
      } else if (typeof calculateOn.period === "object" && "unit" in calculateOn.period) {
        const periodNumber = "number" in calculateOn.period ? calculateOn.period.number : "";
        hashParts.push(`period:${calculateOn.period.unit}:${periodNumber}`);
      }
    }

    // Always
    if (calculateOn.always) {
      hashParts.push("always:true");
    }
  }

  return hashParts.join("\n");
}
