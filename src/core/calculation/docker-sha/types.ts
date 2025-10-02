import type { DockerBakeTarget, DockerShaProjectConfig } from "@/types.js";

export interface CalculateDockerShaOptions {
  inputFile: string;
  dotFile?: string;
  ascii?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  writeOutput?: boolean;
  serviceFilter?: Set<string> | string[];
}

export interface GeneratedServiceResult {
  name: string;
  varName: string;
  imageTag: string;           // Orcka calculated tag
  imageReference: string;     // Full reference with orcka tag
  composeTag?: string;        // Target tag from compose file
  composeReference?: string;  // Full reference with compose tag
}

export interface CalculateDockerShaResult {
  success: boolean;
  outputFile: string;
  projectContext: string;
  project: DockerShaProjectConfig;
  servicesCalculated: number;
  generatedServices: GeneratedServiceResult[];
  resolvedTags: Record<string, string>;
  composeFiles: string[];
  bakeTargets: Record<string, DockerBakeTarget>;
  errors?: string[];
}
