# Backend API

This service is the shared API layer for Medico. It owns database access, authentication, validation, audit records, and Supabase Storage for legally required hospital documents.

## At a glance

- Runtime: Express + TypeScript
- Database: Supabase PostgreSQL via Drizzle
- Storage: Supabase Storage for private legal-document uploads
- Entry points: public emergency APIs, authenticated hospital staff APIs, and master-admin APIs

## Local development

Set `DATABASE_URL` to a real Supabase PostgreSQL connection string before starting the server. Copy [`.env.example`](./.env.example) to `apps/backend/.env` and replace every placeholder.

The API loads `apps/backend/.env` first, then falls back to `packages/db/.env`. Explicit process variables always win. The server listens on `PORT` and defaults to `5000`.

```sh
pnpm install
pnpm --filter backend dev
pnpm --filter backend check-types
```

From the root of the monorepo, keep the shared schema aligned with:

```sh
pnpm exec drizzle-kit push --config packages/db/drizzle.config.ts
```

For a fresh database, apply the SQL migrations in `packages/db/drizzle` in order. Later migrations add staff access, hospital document metadata, and password-column changes.

## Authentication and security model

### Hospital staff auth

Bed and doctor writes require an authenticated hospital context. The API validates `x-staff-password` against salted scrypt hashes stored in `staff_access` for the route's hospital ID. The actor identity comes from the matching database record and not from request-provided data.

Password rules and requirements:

- Staff passwords must be strong enough for the app's validation rules.
- Demo credentials are for local testing only.
- Production deployments should rotate credentials and keep the same database-integrated authentication flow.

### Master-admin auth

The single admin account is configured with `MASTER_ADMIN_USERNAME`, `MASTER_ADMIN_PASSWORD`, and `MASTER_ADMIN_SESSION_SECRET`. The API issues an eight-hour `HttpOnly`, `SameSite=Strict` cookie and keeps the secret server-side.

This is an MVP single-admin model. Keep it behind HTTPS, use a strong secret, and treat in-memory login throttling as a local-only safeguard rather than a production-grade multi-instance security control.

### Storage and document handling

Hospital registration accepts either JSON payloads or `multipart/form-data` with up to five `legalDocuments` PDF files, each capped at 10 MB. Files are uploaded to the private `hospital-legal-documents` bucket in Supabase Storage. If the bucket does not exist, the backend creates it as private. Existing public buckets are rejected.

Signed document URLs for admin previews expire after five minutes, and uploads are rejected if the PDF content is invalid or exceeds the configured size limits.

## Route summary

Public routes:

- `GET /api/health` — database readiness check
- `GET /api/hospitals` — verified hospitals and current availability
- `GET /api/hospitals/:id` — verified hospital detail view
- `GET /api/hospitals/:id/beds` — bed inventory read access
- `GET /api/doctors` — doctor directory filtering
- `POST /api/ai/triage` — department/specialty routing support; not medical diagnosis
- `POST /api/hospitals/register` — create a pending hospital registration

Hospital staff routes:

- `POST /api/hospitals/:id/session` — authenticate a staff session for a specific hospital
- `GET /api/hospitals/:id/audit-logs` — recent hospital audit events
- `PATCH /api/hospitals/:id/beds` — update inventory by category and department
- `POST /api/hospitals/:id/doctors` — create or update doctor records

Master-admin routes:

- `POST /api/admin/session` — sign in to the single admin account
- `GET /api/admin/session` — validate the current session
- `DELETE /api/admin/session` — sign out
- `GET /api/admin/hospitals` — view pending registrations and document metadata
- `PATCH /api/admin/hospitals/:id/verification` — approve or reject a pending hospital
- `GET /api/admin/audit-logs` — view recent global activity
- `GET /api/admin/analytics` — view aggregate capacity metrics
- `GET /api/admin/hospitals/:id/documents/:documentId/url` — generate a short-lived document preview URL

## Operational notes

- Bed updates accept `category`, `department`, `operation`, and `count`; `totalCount` is required when creating a new inventory record.
- API responses follow a standard envelope: `{ "success": true, "data": ... }` or `{ "success": false, "error": ... }`.
- The backend enables audit logging for hospital updates and admin verification decisions.
- Database connectivity failures are surfaced through the health route and startup checks.

## Related docs

- [../../README.md](../../README.md) — repo overview and monorepo quick start
- [../../docs/architecture.md](../../docs/architecture.md) — deeper architecture and environment information
- [../hospital-web/README.md](../hospital-web/README.md) — hospital operations UI
- [../master-admin/README.md](../master-admin/README.md) — admin verification dashboard
- [../user-pwa/README.md](../user-pwa/README.md) — public emergency discovery app
