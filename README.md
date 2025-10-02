# orcka

A TypeScript CLI that precalculates Docker tags by interpreting a `docker-sha.yml` manifest, validating it, and writing HCL variables that Docker Buildx Bake can consume. The tool focuses on deterministic hashing of project inputs (files, jq queries, time periods) and surfaces everything through a small set of commands.

## Install

```bash
pnpm add -D git+https://github.com/camsnz/orcka.git
# or install globally
pnpm add -g git+https://github.com/camsnz/orcka.git
```

After installation use the binary provided by pnpm/npm:

```bash
pnpm exec orcka --help
```

## Quick start

```yaml
# docker-sha.yml
project:
  name: demo
  context: .
  write: docker-sha.hcl
  bake:
    - docker-bake.hcl

targets:
  web:
    calculate_on:
      files:
        - package.json
        - pnpm-lock.yaml
      period:
        unit: days
        number: 7
```

```bash
# Calculate and write docker-sha.hcl
orcka calculate --file docker-sha.yml

# Validate the manifest (auto-discovers docker-sha.yml when omitted)
orcka validate --verbose

# Use the generated variables with buildx bake
docker buildx bake --file docker-bake.hcl --file docker-sha.hcl web
```

## Commands

| Command | Description |
| --- | --- |
| `orcka calculate [--file <path>] [--dotfile <path>] [--ascii] [--verbose] [--quiet]` | Calculates tag variables and writes the configured HCL file. Optional DOT and ASCII outputs visualise dependencies. |
| `orcka validate [--file <path>] [--verbose]` | Validates the manifest, resolves contexts, confirms referenced files exist, and prints warnings. |
| `orcka build [--file <path>] [--target <name>] [--extra-bake <file>] [--extra-compose <file>] [--skip-validation]` | (Preview) Glues `calculate`, environment validation, and a bake invocation. |
| `orcka modify --file <compose.yml> [--verbose]` | (Preview) Applies manifest-driven overrides to a docker-compose file. |

`calculate` and `validate` are production ready. `build` and `modify` are emerging features driven by the same manifest model.

## Manifest snapshot

```yaml
project:
  name: demo            # Optional display name
  context: .            # Working directory relative to docker-sha.yml
  write: docker-sha.hcl # Output file written by `calculate`
  bake:                 # Docker Bake files to read
    - docker-bake.hcl

targets:
  service-name:
    calculate_on:
      files: ["src/"]               # Content hashing
      jq: { filename: package.json, selector: ".dependencies" }
      period: { unit: days, number: 7 }
    resolves: ["other-service"]      # Dependency ordering
```

## Developer workflow

```bash
pnpm install
pnpm test              # Unit suite (includes coverage output)
pnpm test:e2e          # End-to-end tests
pnpm run test:coverage # HTML + summary coverage reports

# Comprehensive health assessment with actionable guidance
task health
```

Key docs:

- `AGENTS.md` – development playbook for contributors and LLM assistants
- `doc/FEATURES.md` – current feature matrix and roadmap
- `doc/REQUIREMENTS.md` – living requirements distilled from production usage
- `doc/CODE_HEALTH_SYSTEM.md` – how `task health` is assembled

# Test built binary
node bin/orcka.cjs calculate --file docker-sha.yml
```

## Documentation

- [Features Overview](doc/FEATURES.md) - Comprehensive feature list
- [Requirements](doc/REQUIREMENTS.md) - Original requirements document

# License
This project is licensed under the terms of the [MIT license](./LICENSE.md).
