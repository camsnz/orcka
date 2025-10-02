# Orcka Ledger Portal (React + TypeScript)

This Vite project renders the front-end for the Orcka demo stack. It exposes a
small dashboard that queries the companion Java and Python APIs and displays
build metadata collected by Orcka.

## Available scripts

```bash
pnpm install       # install dependencies
pnpm dev           # run the development server (defaults to http://localhost:5173)
pnpm build         # type-check and compile assets to dist/
pnpm preview       # serve the production build locally
```

### API configuration

The app reads the following build-time environment variables:

- `VITE_AUDIT_ENGINE_URL` (defaults to `http://localhost:8080/info`)
- `VITE_INVOICE_API_URL` (defaults to `http://localhost:8000/info`)

When running through Docker Compose these values are injected automatically so
that the static bundle talks to `http://audit-engine:8080/info` and
`http://invoice-api:8000/info` respectively.

### Development proxy

`fetch` calls use the fully qualified URLs above. If you prefer to avoid CORS
while iterating locally, set the variables in a `.env.local` file so that they
point at `http://localhost` ports.
