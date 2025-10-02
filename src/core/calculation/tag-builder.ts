import { createHash } from "node:crypto";
import type { DockerBakeTarget, DockerShaCalculateOnConfig, DockerShaConfig } from "../../types.js";
import { formatTimestamp } from "../../utils/formatting/timestamp-formatter.js";
import type { Logger } from "../../utils/logging/logger.js";

export interface GeneratedService {
  name: string;
  varName: string;
  imageTag: string;           // Orcka calculated tag
  imageReference: string;     // Full reference with orcka tag
  composeTag?: string;        // Target tag from compose file
  composeReference?: string;  // Full reference with compose tag
}

interface GenerateServiceTagsOptions {
  config: DockerShaConfig;
  bakeTargets: Record<string, DockerBakeTarget>;
  servicesInOrder: string[];
  projectDir: string;
  logger: Logger;
  composeTagMap?: Map<string, string>; // NEW: Optional compose tag map
  buildHashInput: (
    bakeTarget: DockerBakeTarget,
    calculateOn: DockerShaCalculateOnConfig | undefined,
    resolvedTags: Map<string, string>,
    projectDir: string,
    logger: Logger,
    serviceName: string,
  ) => Promise<string>;
  currentTime?: Date;
}

interface GenerateServiceTagsResult {
  services: GeneratedService[];
  resolvedTags: Map<string, string>;
}

export async function generateServiceTags({
  config,
  bakeTargets,
  servicesInOrder,
  projectDir,
  logger,
  composeTagMap,
  buildHashInput,
  currentTime = new Date(),
}: GenerateServiceTagsOptions): Promise<GenerateServiceTagsResult> {
  const resolvedTags = new Map<string, string>();
  const services: GeneratedService[] = [];

  for (const serviceName of servicesInOrder) {
    const result = await processService({
      serviceName,
      config,
      bakeTargets,
      resolvedTags,
      currentTime,
      projectDir,
      logger,
      composeTagMap, // Pass compose tag map
      buildHashInput,
    });

    if (result) {
      services.push(result);
    }
  }

  return { services, resolvedTags };
}

interface ProcessServiceOptions {
  serviceName: string;
  config: DockerShaConfig;
  bakeTargets: Record<string, DockerBakeTarget>;
  resolvedTags: Map<string, string>;
  currentTime: Date;
  projectDir: string;
  logger: Logger;
  composeTagMap?: Map<string, string>; // NEW: Map of service name → compose tag
  buildHashInput: (
    bakeTarget: DockerBakeTarget,
    calculateOn: DockerShaCalculateOnConfig | undefined,
    resolvedTags: Map<string, string>,
    projectDir: string,
    logger: Logger,
    serviceName: string,
  ) => Promise<string>;
}

async function processService({
  serviceName,
  config,
  bakeTargets,
  resolvedTags,
  currentTime,
  projectDir,
  logger,
  composeTagMap,
  buildHashInput,
}: ProcessServiceOptions): Promise<GeneratedService | null> {
  const bakeTarget = bakeTargets[serviceName];
  if (!bakeTarget) return null;

  if (typeof bakeTarget !== "object" || bakeTarget === null) {
    logger.verbose(`Skipping non-target entry: ${serviceName}`);
    return null;
  }

  const shaTarget = config.targets[serviceName];

  if (shaTarget?.skip_calculate === true) {
    logger.verbose(`Skipping calculation for ${serviceName} (skip_calculate: true)`);
    return null;
  }

  logger.logServiceProcessing(serviceName, "Processing service");

  const hashInput = await buildHashInput(
    bakeTarget,
    shaTarget?.calculate_on,
    resolvedTags,
    projectDir,
    logger,
    serviceName,
  );

  const hash = createHash("sha1").update(hashInput).digest("hex");

  const tagVersion = generateTagVersion(currentTime, shaTarget?.calculate_on?.period, hash);

  const baseTag = bakeTarget.tags?.[0] ?? serviceName;
  const imageName = baseTag.split(":")[0];
  const fullImageTag = `${imageName}:${tagVersion}`;
  resolvedTags.set(serviceName, fullImageTag);

  const varName = generateHclVariableName(serviceName);

  const targetType = shaTarget?.calculate_on ? "configured" : "default";
  logger.logServiceProcessing(serviceName, `Generated (${targetType})`, `${varName} = "${tagVersion}"`);

  // Get compose tag if available
  const composeTag = composeTagMap?.get(serviceName);
  const composeReference = composeTag ? `${imageName}:${composeTag}` : undefined;

  return {
    name: serviceName,
    varName,
    imageTag: tagVersion,
    imageReference: fullImageTag,
    composeTag,
    composeReference,
  };
}

export function generateTagVersion(
  currentTime: Date,
  period: DockerShaCalculateOnConfig["period"],
  hash: string,
): string {
  const timestamp = period ? formatTimestamp(currentTime, period) : "";

  if (timestamp === "") {
    return hash;
  }

  const prefixLength = timestamp.length + 1; // include underscore
  const truncatedHash = hash.slice(prefixLength);
  return `${timestamp}_${truncatedHash}`;
}

export function generateHclVariableName(serviceName: string): string {
  return serviceName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase()
    .concat("_TAG_VER");
}
