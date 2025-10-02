# Orcka Example Plain App

This directory hosts a three-service demonstration stack that showcases how
Orcka orchestrates multi-language Docker builds.

## Services

| Service          | Language / Stack          | Port | Path                               |
| ---------------- | ------------------------- | ---- | ---------------------------------- |
| ledger-portal    | React + TypeScript (Vite) | 4173 | `typescript-react-web`             |
| audit-engine     | Java 21 + SparkJava       | 8080 | `java-gradle-api`                  |
| invoice-api      | Python 3.11 + FastAPI     | 8000 | `python-fast-api`                  |

Each backend exposes `/info` returning static metadata (service name, build
technology, build timestamp, git SHA, semantic version and dependency list).
The front-end queries both endpoints and renders the responses.

## Local commands

```bash
pnpm install         # install orcka CLI (from project root)
pnpm run build       # run orcka build wrapper (delegates to docker buildx bake)
pnpm run up          # start the stack via docker-compose
pnpm run down        # stop the stack
```

Alternatively you can work directly with Docker Compose:

```bash
docker compose up --build
# visit http://localhost:4173
```

### Docker Compose images

`docker-compose.yml` assigns local tags (`orcka/<service>:local`) so you can
experiment safely. The accompanying `docker-bake.hcl` mirrors the same services
and is referenced by `docker-orcka.yaml` to produce deterministic tags via Orcka.

### Build metadata

Each Dockerfile accepts `BUILD_TIME`, `GIT_SHA`, and `SERVICE_VERSION` build
arguments. Orcka populates these automatically when `docker-bake.sha.hcl` is
regenerated. During local development the compose file falls back to
human-readable defaults.
