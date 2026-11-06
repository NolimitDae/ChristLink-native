# Christ Link backend (NestJS on Railway)

Replaces server.js + Supabase. Architecture and the API contract: `../docs/BACKEND.md`. **Rule one: match
server.js** — same paths, methods, request bodies and response fields (reference: NolimitDae/ChristLink1
`server.js`), so the website can switch by changing only its login and upload code.

## Run locally
```bash
docker compose up -d            # Postgres 17 on :5433, Redis 7 on :6380
cp .env.example .env            # local values already point at docker compose
npm install
npx prisma migrate deploy       # apply migrations
npx prisma generate             # client in prisma/generated (gitignored)
npm run start:dev               # API on :4000
ROLE=worker npm run start:dev   # worker (BullMQ processors) in a second terminal
```
Without `RESEND_API_KEY` sign-in codes are printed in the API log.

Checks: `npm run typecheck && npm test && npm run test:e2e && npm run build`. The e2e tests need docker compose
running; they migrate and use the `christlink_test` database (created by `docker/init.sql` on a fresh volume) and
Redis db 1.

## Deploy (Railway)
Both services (`ChristLink-API`, `ChristLink-Worker`) build the same Dockerfile from `railway.toml` and run
`node dist/src/main`. The worker service sets **`ROLE=worker`**: it runs the BullMQ processors and a tiny HTTP
server that only answers `GET /health` and `/api/health`, so the shared healthcheck passes. `preDeployCommand`
(`prisma migrate deploy`) runs for both; Prisma's advisory lock makes that safe.

Railway no longer reads `railway.toml` for newly created services, so set these in each service's settings
(they are set on staging): builder **Dockerfile** (`Dockerfile`, root directory `/backend`), start command
`node dist/src/main`, healthcheck `/api/health`, pre-deploy `npx prisma migrate deploy` (API). Reference
`DATABASE_URL=${{Postgres.DATABASE_URL}}` and `REDIS_URL=${{Redis.REDIS_URL}}` directly on each service — a
shared variable that itself references another service resolves to empty.

| Environment | Railway project | Branch | URL |
|---|---|---|---|
| staging | ChristLink Staging | `claude/railway-launch` | https://christlink-api-staging.up.railway.app |
| production | ChristLink | `master` | https://christlink-api-production.up.railway.app |

## Database
- Tables and columns keep the production Supabase names (snake_case). `auth.users` became `public.users`.
- `prisma/schema.prisma` is pulled from the database. To change the schema: write a new
  `prisma/migrations/<timestamp>_<name>/migration.sql`, apply it locally (`npx prisma migrate deploy`), run
  `npx prisma db pull && npx prisma generate`, then check for drift:
  `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`
  (needs `SHADOW_DATABASE_URL`) must print an empty migration. Never edit an applied migration.
- Supabase RPCs/views that were dropped and must be ported to TypeScript: `docs/RPC-PORTING.md`.

## Folder conventions
```
src/
  main.ts             entry; ROLE=worker → worker.ts, otherwise the API
  bootstrap.ts        API setup (prefix, CORS, body limit, pipes) — also used by e2e tests
  app.module.ts       API root: imports CoreModule + every feature module
  core.module.ts      global: config, Prisma, Redis, BullMQ queues, JWT, Email/Storage/Notifications services
  worker.ts           worker root + health server; processors in src/worker/
  common/             guards, decorators, exception filter
  modules/<name>/     one folder per feature: <name>.module.ts, <name>.controller.ts, <name>.service.ts
```
Add a feature: create `src/modules/<name>/` with module, controller and service, then add the module to
`AppModule.imports`. Controllers use paths without `/api` (the global prefix adds it): `@Controller('prayers')`
→ `/api/prayers`. Do not install packages; everything needed is already in package.json.

## Auth, guards and decorators (`src/common/auth.decorators.ts`)
- Every route requires `Authorization: Bearer <accessToken>` by default (global `JwtAuthGuard`, HS256).
- `@Public()` — no token. `@OptionalAuth()` — user attached if a valid token is sent.
- `@CurrentUser() user: AuthUser` (`{ id, email }`) or `@CurrentUser('id') userId: string`.
- `@Admin()` — signed in and `profiles.role = 'admin'`, else 403 `Admin access required.`
- Auth routes (`src/modules/auth`): signin, signup, verify-otp, refresh (rotation + reuse detection), signout, and
  `GET /api/auth/me`.

## Errors
Every error response is `{ "error": "Human readable message" }` with a 4xx/5xx status (global
`HttpExceptionFilter`). Throw Nest exceptions with the server.js message: `throw new BadRequestException('Email is
required.')`. Validation errors are joined into one message; 5xx never leak internal text (it is logged).

## Request bodies
The global `ValidationPipe` uses `whitelist: true` (unknown fields stripped) for DTO **classes**. Routes that
accept server.js's loose bodies type `@Body()` with a plain interface or inline type instead — the pipe skips
those, so validate and pick fields by hand in the service (trust boundary). Prefer DTO classes for new shapes.

## Rate limits
`@nestjs/throttler` with Redis storage (shared across instances), keyed by the real client IP (`trust proxy` = 1).
Defaults: 10/s, 50/10 s, 200/min. Override per route: `@Throttle({ long: { limit: 10, ttl: 15 * 60_000 } })`
(auth routes use server.js's 10 per 15 min). `@SkipThrottle()` to opt out.

## Shared services (inject anywhere; CoreModule is global)
- `PrismaService` — `this.prisma.events.findMany(...)`; raw SQL via `$queryRaw` for kept SQL functions.
- `@InjectRedis() redis: Redis` (from `src/redis.ts`).
- `StorageService` (Cloudflare R2):
  - `putDataUrl('avatars', userId, body.dataUrl)` → public URL under `R2_PUBLIC_URL`. Validates type
    (jpeg/png/webp/heic by default, `{ allowed }` to change), size (`{ maxBytes }`, default 5 MB) and magic bytes;
    throws 400/413 with server.js messages.
  - `putPrivate('private/id-docs/<userId>/<uuid>.jpg', buffer, type)`; `signedGetUrl(key, 300)`.
- `NotificationsService.create(userId, type, title, body, data)` — inserts a `notifications` row and queues the
  push. Use the `type` names in `src/worker/push.processor.ts` `CATEGORY` so user toggles apply.
- `EmailService.send({ to, subject, html, text })` sends now; or queue it:
  `@InjectQueue(QUEUE_EMAIL) q: Queue` → `q.add('email', { to, subject, html, text })`.

## Worker and jobs
Queues (same Redis): `push`, `email`, `jobs` (`src/queues/queues.ts`). Processors live in `src/worker/` and are
registered in `WorkerModule` (`src/worker.ts`). Push honors `user_settings.notification_prefs` and quiet hours,
sends to Expo in batches of 100 and deletes `DeviceNotRegistered` tokens. Repeatable jobs: add an entry to
`REPEATABLE_JOBS` in `src/worker/jobs.ts` (`name`, cron `pattern` in UTC, `run(prisma, moduleRef)`); the worker
registers it on start and removes schedulers whose entry was deleted.
