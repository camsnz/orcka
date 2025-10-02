import type { DockerShaConfig, DockerShaTarget } from "../../../types.js";

const defaultProject: NonNullable<DockerShaConfig["project"]> = {
  name: "my-app",
  write: "generated.hcl",
  bake: ["docker-bake.hcl"],
};

const defaultTarget: DockerShaTarget = {
  calculate_on: { always: true },
};

export const createProject = (
  overrides: Partial<NonNullable<DockerShaConfig["project"]>> = {},
): NonNullable<DockerShaConfig["project"]> => ({
  ...defaultProject,
  ...overrides,
});

export const createTarget = (overrides: Partial<DockerShaTarget> = {}): DockerShaTarget => ({
  ...defaultTarget,
  ...overrides,
});

export const createConfig = (overrides: Partial<DockerShaConfig> = {}): DockerShaConfig => ({
  project: createProject(overrides.project ?? {}),
  targets: overrides.targets ?? {},
});
