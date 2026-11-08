# Medico developer architecture

## 1. System overview

Medico is a pnpm/Turborepo monorepo with one PostgreSQL database hosted by Supabase. Browser clients do not connect to PostgreSQL or Supabase Storage directly. They call the Express API; the API uses `@repo/database` for the shared Drizzle schema and database connection.

```text
user-pwa ─────┐
hospital-web ─┼─ HTTP / JSON ──> apps/backend ── Drizzle ──> Supabase PostgreSQL
master-admin ─┘                         │
                                       └── Supabase Storage (private PDF bucket)
```

| Workspace | Runtime responsibility |
| --- | --- |
| `apps/backend` | HTTP validation, staff/admin authorization, audit transactions, Supabase Storage calls |
| `apps/hospital-web` | Hospital staff bed inventory and doctor management |
| `apps/master-admin` | Single-admin hospital review, platform audit, and capacity analytics |
| `apps/user-pwa` | Public hospital discovery, direct calling, doctor search, and department routing |
| `packages/db` (`@repo/database`) | Drizzle schema, PostgreSQL connection, and browser-safe shared TypeScript contracts |

The package directory remains `packages/db`; its workspace name and import contract are `@repo/database`. Backend code imports runtime Drizzle objects from `@repo/database`. Frontend code uses type-only imports from `@repo/database/contracts`; it never imports the server connection.

## 2. Database model and Supabase

`@repo/database` owns the schema for hospitals, bed inventory, doctors, staff access, admin roles, audit logs, and hospital documents. `DATABASE_URL` points to the common Supabase PostgreSQL database. All products read and write the same records through the backend.

The additive migration [`0002_hospital_documents.sql`](../packages/db/drizzle/0002_hospital_documents.sql) adds `hospital_documents`:

- Each row belongs to a hospital and stores a sanitized display filename, byte size, and private storage object path.
- The database enforces a positive size no larger than 10 MiB.
- Row-level security is enabled. Access is performed by the backend with the database connection, not by a public browser client.
- Existing migrations `0000` and `0001` cover the bed natural key and hospital staff access.

The Supabase Storage bucket defaults to `hospital-legal-documents`. On the first PDF upload, the backend creates it as private, with PDF content type and a 10 MiB object limit if it is missing. If the bucket already exists but is public, storage operations fail explicitly. The API enforces PDF MIME, the `%PDF-` signature, and the same 10 MiB limit regardless of bucket configuration. The service-role key must remain in the backend environment.

To keep SQL and Drizzle aligned, update both the schema under `packages/db/src/schema` and a new ordered SQL migration under `packages/db/drizzle` for future schema changes. Apply committed SQL migrations to the selected Supabase project before deploying API code that depends on them.

## 3. API conventions and data flow

The API base defaults to `http://localhost:5000/api`. JSON responses use:

```json
{ "success": true, "data": {} }
```

Errors use `{ "success": false, "error": "..." }` with an HTTP status. Clients display network and server errors instead of treating failures as successful empty data.

### Public routes

| Route | Behavior |
| --- | --- |
| `GET /api/hospitals` | Verified hospitals and their bed inventory; used for nearest-first discovery and freshness badges |
| `GET /api/hospitals/:id` | Verified hospital, beds, and available doctors; other statuses return not found |
| `GET /api/hospitals/:id/beds` | Bed inventory for verified hospitals |
| `GET /api/doctors?specialty=&hospitalId=&available=true` | Doctor directory limited to verified hospitals; includes hospital name and address |
| `POST /api/ai/triage` | Maps symptoms to department/specialty routing only; the request field is `gender` and responses include matching verified hospitals |
| `POST /api/hospitals/register` | Creates a pending hospital. Accepts JSON or multipart fields `name`, `address`, `latitude`, `longitude`, `hotlinePhone` and up to five `legalDocuments` PDF files |

Hospital registration uploads PDFs to Storage before committing hospital/document metadata in a database transaction. If the database transaction fails, already uploaded objects are removed. Cleanup failures are logged and surfaced for operators. A failed upload never returns a success-shaped registration response.

The AI route is a keyword-based department router, not a diagnostic model. Both API and UI disclaim that it does not give diagnoses or treatment.

### Master-admin routes

The admin routes are under `/api/admin` and return `Cache-Control: no-store`.

| Route | Access and effect |
| --- | --- |
| `POST /api/admin/session` | Checks the configured single-admin username/password and issues an eight-hour signed session cookie |
| `GET /api/admin/session` | Returns the current configured admin identity when the cookie is valid |
| `DELETE /api/admin/session` | Clears the admin cookie |
| `GET /api/admin/hospitals` | Returns pending registrations and legal-document metadata |
| `PATCH /api/admin/hospitals/:id/verification` | Changes only `PENDING` hospitals to `VERIFIED` or `REJECTED`; writes a global-visible audit row in the same transaction |
| `GET /api/admin/audit-logs?limit=50` | Latest global audit activity joined to hospital names |
| `GET /api/admin/analytics` | Verified hospital count, available ICU/general beds, and time for the aggregate database query |
| `GET /api/admin/hospitals/:id/documents/:documentId/url` | Creates a five-minute signed URL after verifying the admin session and document/hospital relationship |

Admin sessions use an HttpOnly, SameSite=Strict cookie, eight-hour expiry, HMAC-SHA-256 signing, and a minimum 32-character `MASTER_ADMIN_SESSION_SECRET`. The login endpoint applies a per-process failed-login throttle. This is intentionally a single-admin MVP: configure TLS, use strong credentials, and replace the in-memory throttle and environment credential model before multi-instance or public production deployment.

The admin Vite app runs independently on port 5174. It does not embed credentials or service keys. Cross-origin cookie requests use `credentials: include`; the backend CORS allowlist is configured by `CORS_ORIGINS`. A separate port is not a security control.

## 4. Client applications

### Hospital operations (`apps/hospital-web`)

Staff validate their hospital-specific PIN, then update bed inventory and doctor listings. `x-staff-pin` is sent only to the backend. The API verifies salted scrypt hashes from `staff_access`; actors are taken from the matched database record. Bed and doctor updates append audit entries transactionally.

### Master admin (`apps/master-admin`)

The standalone Vite app is served at `/master-medico-admin`. Its sign-in calls the admin session API; after sign-in the panel has three sections:

- Verification queue: submitted address, coordinates, hotline, registration time, and legal-document links. Document previews are short-lived signed URLs. Approve/reject actions immediately update the queue.
- System audit: polls the newest 50 events every 30 seconds while visible.
- Analytics: polls every 60 seconds while visible and shows verified hospitals, available ICU/general beds, and measured aggregate-query duration.

The admin app uses React, TypeScript, Vite, Tailwind, and Lucide React. Its API client keeps the session cookie browser-managed and shows explicit server/network errors.

### Emergency PWA (`apps/user-pwa`)

The public PWA requests browser geolocation with low-accuracy settings and falls back to Dhaka coordinates (`23.8103, 90.4125`). Hospitals are sorted by a client-side Haversine distance. Bed update confidence is based on the newest bed timestamp:

- Green: updated within 15 minutes.
- Yellow: 15–60 minutes old.
- Gray: more than one hour old or no usable update time, with “Stale data — tap to call hospital directly.”

Hospital detail views show the category/department bed matrix, currently available doctors, schedules, and `tel:` links. The directory uses verified, available doctors without distance filtering. The triage form sends `symptoms`, integer `age`, and `gender` to the backend and renders only returned department routing.

The service worker is implemented without a PWA framework dependency. It:

- Caches the app shell and static assets for offline reloads after the first online visit.
- Uses stale-while-revalidate for public GETs to hospitals, hospital details, and doctors.
- Never caches admin requests, authenticated/staff requests, or the AI POST.
- Leaves the previously cached public response available when offline; the UI still labels its freshness and shows network errors.

The PWA polls hospital availability every 60 seconds only while the page is visible and the browser is online. Location acquisition is low-power and may use a recent browser position.

## 5. Environment and local development

Copy [`apps/backend/.env.example`](../apps/backend/.env.example) to `apps/backend/.env` and set values privately. The API loads its own `.env`, then falls back to `packages/db/.env` for the existing database configuration. Never commit `.env` files.

Required backend settings:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Shared Supabase PostgreSQL connection string |
| `MASTER_ADMIN_USERNAME` | Single MVP admin username |
| `MASTER_ADMIN_PASSWORD` | Single MVP admin password |
| `MASTER_ADMIN_SESSION_SECRET` | HMAC signing secret, at least 32 characters |
| `SUPABASE_URL` | Project URL used by backend Storage REST calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Storage credential |
| `SUPABASE_LEGAL_DOCUMENTS_BUCKET` | Optional bucket override; defaults to `hospital-legal-documents` |
| `CORS_ORIGINS` | Comma-separated exact browser origins allowed to call the API |

Client builds can set `VITE_API_BASE_URL` to override the default API base. Vite variables are public and must never contain a database or Supabase service key.

Run each app with `pnpm --filter <workspace> dev`; build all workspaces with `pnpm build`. The apps use ports 5173 (PWA), 5174 (master admin), and 5175 (hospital operations) so they can run together; the backend runs on 5000. Add deployed browser origins to `CORS_ORIGINS`.
