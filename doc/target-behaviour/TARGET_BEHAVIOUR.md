# Target Behaviour (Legacy Scripts)

The shell scripts in this folder predate the current TypeScript CLI. They describe how a bespoke CI pipeline used to:

1. Validate Docker/Buildx versions.
2. Precalculate hash-based tags.
3. Call Buildx Bake with the generated variables.
4. Print dependency trees for debugging.

Today the same workflow is handled by:

```bash
orcka validate --verbose
orcka calculate --file docker-sha.yml [--dotfile graph.dot] [--ascii]
docker buildx bake --file docker-bake.hcl --file docker-sha.hcl <targets>
```

The scripts remain for historical reference only. When updating Orcka, prefer to extend the CLI rather than change these legacy helpers. If you need additional behaviour (e.g., richer compose orchestration), add it through the `build`/`modify` preview commands and document the change in `doc/FEATURES.md`.
