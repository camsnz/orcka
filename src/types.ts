/**
 * Docker SHA configuration schema interfaces
 */
export interface DockerShaProjectConfig {
  name: string;
  context?: string; // Optional, defaults to docker-sha.yml location
  write?:
    | string
    | {
        tags?: string;
        compose?: string;
        bake?: string;
        dir?: string;
      };
  bake: string[];
  compose?: string[];
  buildtime?: {
    apply_compose_tags?: boolean;
  };
  runtime?: {
    background?: boolean;
  };
}

export interface DockerShaConfig {
  project?: DockerShaProjectConfig;
  targets: Record<string, DockerShaTarget>;
}

export interface DockerShaCalculateOnConfig {
  files?: string[];
  jq?: { filename: string; selector: string };
  period?:
    | "hourly"
    | "weekly"
    | "monthly"
    | "yearly"
    | {
        unit: "months" | "weeks" | "days" | "hours" | "minutes" | "seconds";
        number: number;
      }
    | { unit: "none" };
  date?: string;
  always?: boolean;
}

export interface DockerShaTarget {
  calculate_on: DockerShaCalculateOnConfig;
  context?: string; // Optional, defaults to orcka context
  context_of?: "dockerfile" | "orcka" | "target" | "bake"; // Defaults to "orcka"
  skip_calculate?: boolean; // Optional, defaults to false. When true, calculation is skipped
}

/**
 * Docker Bake configuration interfaces
 */
export interface DockerBakeConfig {
  target?: Record<string, DockerBakeTarget>;
  group?: Record<string, { targets: string[] }>;
  variable?: Record<string, Record<string, unknown>>;
}

export interface DockerBakeTarget {
  context?: string;
  contexts?: Record<string, string>;
  dockerfile?: string;
  args?: Record<string, string>;
  labels?: Record<string, string>;
  platforms?: string[];
  tags?: string[];
  target?: string;
  inherits?: string | string[];
  depends_on?: string[];
  "cache-from"?: string[];
  "cache-to"?: string[];
  output?: string[];
  ssh?: string;
  secret?: string[];
}

/**
 * Validation result interfaces
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  config?: DockerShaConfig;
}

export interface ValidationError {
  type: "schema" | "file" | "dependency";
  target?: string;
  field?: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  type: "performance" | "compatibility" | "best-practice";
  target?: string;
  field?: string;
  message: string;
  suggestion?: string;
}
