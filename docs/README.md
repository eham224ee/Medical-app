# Medico documentation

This folder is the central documentation index for the monorepo. Start here when you want a quick orientation, then move to the app-specific guide for the workflow you need.

## Documentation map

- [architecture.md](./architecture.md) — system overview, database model, API contracts, environment setup, and frontend responsibilities.
- [../README.md](../README.md) — repository overview and monorepo quick start.
- [../apps/backend/README.md](../apps/backend/README.md) — backend API runbook and route summary.
- [../apps/hospital-web/README.md](../apps/hospital-web/README.md) — hospital operations dashboard workflow.
- [../apps/master-admin/README.md](../apps/master-admin/README.md) — master-admin verification and audit experience.
- [../apps/user-pwa/README.md](../apps/user-pwa/README.md) — public emergency finder and offline PWA behavior.

## Recommended reading order

1. Read the repository-level quick start in [../README.md](../README.md).
2. Review [architecture.md](./architecture.md) before changing data flow, schema, or environment configuration.
3. Use the app-specific README for local development and feature-specific workflows.

## Core concepts

- The API is the only server-side entry point for database and storage access.
- All client apps are thin frontends that talk to the backend over HTTP.
- The shared Drizzle schema is defined in `packages/db` and applied through SQL migrations.
- Supabase Storage is used for hospital legal documents and access is controlled through backend-signed URLs.

## Common commands

```sh
pnpm install
pnpm build
pnpm check-types
pnpm --filter backend dev
pnpm --filter hospital-web dev
pnpm --filter master-admin dev
pnpm --filter user-pwa dev
```

Use the app-specific READMEs for exact setup details, environment variables, and demo credentials.
