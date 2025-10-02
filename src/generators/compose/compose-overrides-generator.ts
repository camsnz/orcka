import { stringify } from "yaml";

export function generateComposeOverridesYaml(services: string[], pullPolicy: string): string {
  const sortedServices = [...services].sort();
  const doc = {
    services: Object.fromEntries(sortedServices.map((serviceName) => [serviceName, { pull_policy: pullPolicy }])),
  };

  return stringify(doc, { indent: 2 });
}
