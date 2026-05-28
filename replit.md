# Pirate Proof

A mobile-first full-stack app that aggregates package delivery tracking from multiple carriers and controls a WiFi-enabled smart lock for a secure delivery box.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54 + React Native 0.81.5 (Expo Router file-based navigation)
- API: Express 5 on port 8080
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (via `@workspace/api-zod` generated from OpenAPI spec)
- Auth: JWT (`jsonwebtoken` + `bcryptjs`), token stored in AsyncStorage
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/db/src/schema/` — Drizzle ORM table definitions (users, deliveries, lock, pins, notifications, emailAccounts)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, deliveries, lock, pins, notifications, emailAccounts)
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware + `AuthRequest` type
- `artifacts/api-server/src/lib/mockTracking.ts` — mock carrier tracking simulation
- `artifacts/mobile/app/` — Expo Router screens (auth/login, auth/register, (tabs)/index, deliveries, lock, settings, delivery/[id])
- `artifacts/mobile/components/` — DeliveryCard, StatusBadge, StatCard, AddDeliverySheet, AddPinSheet
- `artifacts/mobile/context/AuthContext.tsx` — JWT auth state + AsyncStorage persistence
- `artifacts/mobile/constants/colors.ts` — dark navy design tokens (primary amber `#f5a623`)

## Architecture decisions

- Contract-first API: OpenAPI spec drives Zod validation on the server AND typed React Query hooks on the client
- JWT stored in AsyncStorage with `setAuthTokenGetter` injected into generated API client — no manual token threading
- Mock carrier tracking: deterministic hash of tracking number → status/location/ETA, no real carrier integration needed
- Lock state is per-user in DB (no real hardware); events log every lock/unlock with trigger source
- All routes in `artifacts/api-server/src/routes/index.ts` — health, auth, deliveries, lock, pins, notifications, emailAccounts

## Product

- **Auth**: Register/login with JWT; persistent sessions via AsyncStorage
- **Dashboard**: Live stats (active packages, delivered count), lock widget, recent packages list, pull-to-refresh sync
- **Deliveries**: Full package list with search + filter (All/Active/Delivered), add tracking, delete packages
- **Lock Control**: Lock/unlock smart box, manage access PINs (permanent/one-time/time-restricted/delivery), activity history
- **Settings**: Connect email accounts for auto-import of tracking numbers, profile info, sign out

## User preferences

- Dark slate/navy theme (`#0d1117` background, `#f5a623` amber primary)
- Always use `Inter` font family (400/500/600/700 weights)
- Mock carrier APIs — no real carrier integrations

## Gotchas

- API server dev script requires `PORT=8080` — it's in the `dev` npm script
- Run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after DB schema changes
- Run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Zod schema names from codegen: `RegisterBody`, `LoginBody`, `CreateDeliveryBody`, `ToggleLockBody`, `CreatePinBody`, `ConnectEmailAccountBody`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
