# SportStream Backend

Backend API for a licensed global sports streaming platform (Uganda + international). NestJS modular monolith, PostgreSQL/Prisma, Redis, JWT auth with rotating refresh tokens.

**This is Stage 1 of an incremental build.** It contains: full project scaffold, complete Prisma schema for the entire platform, and a fully working Authentication + Users module. It does **not** yet contain the sports catalogue, events, rights, streaming, payments, or other modules described in the full spec — those are subsequent stages.

## What actually works right now

- User registration (email or phone) with argon2 password hashing
- Login with timing-safe invalid-credential handling
- Short-lived access JWTs (15m default) + rotating opaque refresh tokens (30d default), stored hashed in `Session`
- Refresh-token rotation with reuse detection groundwork (old token is revoked on use)
- Logout (single session) and logout-all (all sessions)
- `GET/PATCH /users/me`, soft-delete account (anonymize + revoke sessions)
- Global validation, structured error responses, rate limiting (`@nestjs/throttler`), Helmet security headers
- Swagger docs at `/api/v1/docs`
- Health-check-ready structure (add `@nestjs/terminus` in the next stage for `/health`)
- Full Prisma schema for all 30+ entities in the spec (sports catalogue, events, rights, streams, video library, subscriptions, payments, notifications, favorites, audit log, etc.) — **not yet wired to controllers/services beyond User/Session**

## What is intentionally NOT built yet (next stages)

Sports catalogue CRUD + sync jobs, event management & live scoring, broadcasting rights enforcement, stream lifecycle + provider webhooks, playback authorization, video library, subscriptions & entitlements, payment provider adapters (MTN MoMo / Airtel Money / card), notifications, favorites/watch history endpoints, admin module, analytics. Provider interfaces (`IVideoProvider`, `IPaymentProvider`, etc.) are referenced in the architecture but not yet implemented as code — they arrive with their respective modules so they can be tested against real adapter contracts rather than guessed in advance.

## Setup

```bash
cp .env.example .env
# edit .env: set DB_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET to strong random values
docker compose up -d postgres redis
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

API base: `http://localhost:3000/api/v1`
Swagger: `http://localhost:3000/api/v1/docs`

> **Note on this delivery environment:** I could not run `npx prisma migrate dev` or `prisma validate` inside this sandbox because it has no network access to `binaries.prisma.sh` (Prisma's engine-binary host isn't on the sandbox's egress allowlist). The schema is hand-reviewed for relation consistency, but **run `npx prisma validate` and `npx prisma migrate dev` yourself** as the first step before trusting it further — I want to be upfront that "written carefully" isn't the same as "verified by the Prisma compiler" here.

## Example requests

Register:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"a-strong-password-1","fullName":"Jane Doe"}'
```

Login:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"a-strong-password-1"}'
```

Get current user:
```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

Refresh:
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

## Architecture

See the folder structure under `src/` — `common/` (cross-cutting concerns), `config/` (env loading + Joi validation), `database/` (PrismaService as a global module), `modules/*` (one per domain), `providers/` (adapter interfaces, populated as each integration module lands).

Design principles carried through the whole schema (see `prisma/schema.prisma` comments):
- Sport-specific scoring/periods/participants are modeled generically (`EventPeriod`, `SportStatistic`, JSON `metadata`) rather than assuming football's two-teams-and-goals shape.
- `BroadcastRights` + `RightsTerritory` are designed to be checked independently at stream-publish time and playback-request time — this enforcement logic lands with the Rights and Playback modules.
- Payment and video providers are meant to sit behind adapter interfaces so new providers are additive, not invasive.

## Backup & restore (Postgres)

```bash
# Backup
docker exec sportstream_postgres pg_dump -U sportstream sportstream > backup.sql

# Restore
cat backup.sql | docker exec -i sportstream_postgres psql -U sportstream sportstream
```
For production, use managed automated snapshots (e.g. your cloud provider's RDS/Cloud SQL backups) with point-in-time recovery rather than relying solely on manual dumps.

## Monitoring guidance (for later stages)

- Add `@nestjs/terminus` for `/health` (DB + Redis liveness/readiness)
- Structured JSON logs (swap `Logger` for `pino` or `winston` in production)
- Emit metrics for: auth failures/min, stream startup time, playback authorization latency, payment webhook processing lag
- Alert on: refresh-token reuse (possible token theft), repeated payment webhook signature failures, rights-check denials spiking (possible mis-licensed content being requested)

## Credentials / integrations still required before production

None are wired yet in this stage — auth uses only local password hashing and self-issued JWTs, no third-party dependency. When later stages add payments, video, sports-data, and notifications, you'll need real sandbox/production credentials for whichever providers you choose (e.g. MTN MoMo API key, Airtel Money client credentials, a video platform's API token, a sports-data provider key, Africa's Talking API key). None of these are invented or assumed here.
