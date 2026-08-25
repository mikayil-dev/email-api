# AGENTS.md — email-api guidelines

This Bun/TypeScript service accepts contact-form submissions from explicitly
configured website origins and delivers them through SMTP.

## Required validation

```bash
bun run validate
```

Focused commands:

```bash
bun run format
bun run lint
bun run typecheck
bun run test
```

## Architecture

```text
src/config.ts          Shared and backward-compatible legacy config parsing
src/index.ts           HTTP routing, validation, CORS, logging, rate limits
src/mailer.ts          Pooled SMTP transport and message construction
src/rate-limiter.ts    Bounded-window in-memory limiter
src/admin.ts           Atomic, idempotent central site registration
origins.example.json   Recommended shared SMTP/sites configuration
```

## Configuration contract

The preferred production format contains one `smtp` object and a `sites` map.
Both the primary origin and its mandatory `www` origin must be registered. The
legacy format with SMTP nested under each origin remains readable only for safe
migration; do not add new functionality that writes legacy configuration.

`src/admin.ts` must preserve file permissions and update the configuration with
an atomic rename. It must never print SMTP settings or file contents.

## Security

- Never accept a visitor-controlled `From` address. Use the configured SMTP
  sender and set the visitor as `Reply-To`.
- CORS and the Origin header are not authentication or bot protection.
- Never log messages, passwords, or complete request bodies.
- Validate request sizes before SMTP work.
- Keep `TRUST_PROXY=false` unless Caddy or another trusted reverse proxy is the
  only network path to the service.
- Keep the Docker port bound to localhost.
- Preserve HTML escaping in `mailer.ts`.
- Do not expose internal errors in HTTP responses.

## Style

- TypeScript strict mode, no `any`, explicit exported return types.
- Double quotes, semicolons, two spaces, trailing commas.
- Use type-only imports where applicable.
- Prefix intentionally unused variables with `_`.
- Always await promises.
- Tests use `bun:test` and live beside their modules as `*.test.ts`.

## Deployment integration

The sibling `vps-caddy` CLI calls `bun run site:upsert` over the existing admin
SSH connection, then restarts the Compose service. Keep this command idempotent
and backward compatible at the CLI argument level.
