# Medico

Medico is an emergency-capacity platform for Bangladesh that helps patients find the nearest verified hospital, lets hospital staff manage beds and doctors, and gives a single master admin a verification and audit workflow.

The monorepo is organized as a Turborepo workspace with a shared PostgreSQL schema via `@repo/database` and a single backend API that all frontends call.

## Product overview

- Public emergency discovery: the PWA shows nearby verified hospitals, bed availability, doctor search, and triage routing.
- Hospital operations: staff can update inventory, doctor availability, and audit logs after login.
- Central verification: the master admin approves or rejects new hospital registrations and reviews system activity.
- Shared data layer: all workloads read and write the same Supabase-backed database through the API layer.

## Workspace map

| Workspace           | Purpose                                                       | Local port |
| ------------------- | ------------------------------------------------------------- | ---------- |
| `apps/backend`      | Express API, auth, storage, and shared database access        | 5000       |
| `apps/hospital-web` | Hospital staff bed and doctor management dashboard            | 5175       |
| `apps/master-admin` | Global verification queue, audit feed, and analytics          | 5174       |
| `apps/user-pwa`     | Public emergency hospital finder and triage flow              | 5173       |
| `packages/db`       | Shared Drizzle schema, SQL migrations, and database contracts | N/A        |
| `docs`              | Architecture and operational documentation                    | N/A        |

## Quick start

1. Install dependencies:

```sh
pnpm install
```

2. Configure backend environment values in `apps/backend/.env`.

- Copy `apps/backend/.env.example` as a starting point.
- Set `DATABASE_URL` to a real Supabase PostgreSQL connection.
- Add `MASTER_ADMIN_*` credentials and the Supabase Storage settings required by the backend.

3. Sync the database schema:

```sh
pnpm exec drizzle-kit push --config packages/db/drizzle.config.ts
```

If needed, apply the migration files in `packages/db/drizzle` in order.

4. Start the services:

```sh
pnpm --filter backend dev
pnpm --filter user-pwa dev
pnpm --filter master-admin dev
pnpm --filter hospital-web dev
```

The default public API origin is `http://localhost:5000/api`. Override it in client environments with `VITE_API_BASE_URL` when needed.

## Documentation

This repository is organized around a small set of linked guides:

- [docs/README.md](./docs/README.md) — documentation index and map
- [docs/architecture.md](./docs/architecture.md) — monorepo architecture, API contracts, and environment model
- [apps/backend/README.md](./apps/backend/README.md) — backend setup, auth, routes, and storage
- [apps/hospital-web/README.md](./apps/hospital-web/README.md) — hospital operations workflow and demo credentials
- [apps/master-admin/README.md](./apps/master-admin/README.md) — verification workflow and admin dashboard
- [apps/user-pwa/README.md](./apps/user-pwa/README.md) — patient-facing emergency app and offline behavior

## Build and validation

Run the complete workspace build with:

```sh
pnpm build
```

For type checking across the monorepo:

```sh
pnpm check-types
```

For additional operational detail, including database migration notes, Supabase Storage rules, and security boundaries, see the architecture guide.
