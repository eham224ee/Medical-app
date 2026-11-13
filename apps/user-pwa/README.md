# Emergency PWA

This app is the public-facing emergency patient experience. It helps people find nearby verified hospitals, browse doctor availability, and use a simple triage router to narrow likely departments or specialties before making a call.

## What it offers

- Hospital discovery sorted by distance from the user
- Verified hospital bed availability and freshness indicators
- Doctor directory for specialties and hospital filtering
- Lightweight triage suggestions for department routing
- Offline fallback for previously visited public data

## Local setup

Start the backend first, then run:

```sh
pnpm --filter user-pwa dev
pnpm --filter user-pwa build
```

The app runs on port `5173` and defaults to `http://localhost:5000/api` for API requests. If the backend is hosted elsewhere, override the origin before starting Vite:

```sh
VITE_API_BASE_URL=http://localhost:5000/api pnpm --filter user-pwa dev
```

## User experience notes

The app requests low-power geolocation and falls back to Dhaka coordinates when location access is unavailable. Hospitals are sorted using a client-side distance calculation and freshness hints are shown next to bed data.

The triage form submits symptom information to the backend routing endpoint and displays a recommended department or specialty. It is designed as a routing helper, not a diagnosis tool, and the UI surfaces that limitation clearly.

## Offline behavior

The service worker caches the app shell and public GET responses for the emergency feed, hospital details, and doctor listings. It does not cache authenticated requests or the AI triage POST endpoint. This keeps the public experience responsive while avoiding storage of sensitive or staff-scoped data.

## Related docs

- [../../README.md](../../README.md) — repo overview and project quick start
- [../../docs/architecture.md](../../docs/architecture.md) — broader architecture and environment decisions
- [../../apps/backend/README.md](../../apps/backend/README.md) — backend endpoints and security model
