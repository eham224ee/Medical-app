# Hospital operations panel

This app is the hospital staff dashboard for updating beds, doctor availability, and operational status records. It is meant to be used by staff inside a managed browser session and communicates with the shared backend API.

## Purpose

- Maintain bed inventory by category and department
- Add and update doctors and their availability
- Review recent audit entries tied to the hospital
- Stay aligned with the shared Medico data model and backend validations

## Local run

Start the backend first with a configured `DATABASE_URL` and the database migrations applied, then run:

```sh
pnpm --filter hospital-web dev
pnpm --filter hospital-web build
```

By default the UI calls the API at `http://localhost:5000/api`. To point to a different backend URL, set `VITE_API_BASE_URL` before starting Vite, for example:

```sh
VITE_API_BASE_URL=http://localhost:5000/api pnpm --filter hospital-web dev
```

## Auth flow

Staff sign in with their hospital ID and password. The hospital ID is stored in local storage for convenience, while the password stays in the current browser session and is validated against the backend's salted scrypt hash in `staff_access`.

The app sends staff-only requests to the backend using the hospital-scoped session and the verified actor record from the database.

## Core actions

- `PATCH /api/hospitals/:id/beds` updates inventory counts and department totals.
- `POST /api/hospitals/:id/doctors` creates or updates doctor records.
- `GET /api/hospitals/:id/audit-logs` displays recent operational change history.

Bed updates require a valid category, department, operation (`set`, `increment`, or `decrement`), and a numeric count. The app depends on the backend to enforce validation and audit logging.

## Demo workspace

Apply the migrations under `packages/db/drizzle` in order, then seed the configured database with:

```sh
pnpm --filter @repo/database seed:demo
```

This adds synthetic hospitals, beds, doctors, and hashed staff passwords for testing.

| Hospital                            | Hospital ID                            | Demo password     |
| ----------------------------------- | -------------------------------------- | ----------------- |
| Central City Medical Center (DEMO)  | `d0000000-0000-4000-8000-000000000001` | `DemoAccess!2026` |
| Riverside Emergency Hospital (DEMO) | `d0000000-0000-4000-8000-000000000002` | `DemoAccess!2026` |

These are fictional records and public demo credentials. Do not use them for real patient or production data.

## Related docs

- [../../README.md](../../README.md) — monorepo overview and quick start
- [../../docs/architecture.md](../../docs/architecture.md) — system-level design and environment requirements
- [../../apps/backend/README.md](../../apps/backend/README.md) — backend auth, routes, and storage rules
