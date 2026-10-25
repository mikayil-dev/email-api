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
src/sites.ts           Reads vps-caddy site manifests (SITES_DIR) as origins
src/sender.ts          Lists senders, switches the shared SMTP account
src/slim-config.ts     Drops origins the manifests provide, and www origins
origins.example.json   Recommended shared SMTP/sites configuration
```

## Configuration contract

Allowed origins come from the vps-caddy site manifests (`SITES_DIR`, every
static site with a `contactEmail`, primary domain only) plus the explicit
`sites` map of `origins.json`, which wins. There is no registration step and no
`www` origin: `www` always redirects to the primary domain. The production
format contains one `smtp` object; the legacy format with SMTP nested under
each origin remains readable only for safe migration; do not add new
functionality that writes legacy configuration.

Tools that rewrite `origins.json` must preserve file permissions, back it up,
update it with an atomic rename, and never print SMTP settings or file contents.

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

The app is registered in `vps-caddy` as `sites/email.pikcode.de.json` (mode
`app`, port 3411, directory `/srv/email-api`). The deploy workflow pushes the
image and then runs `vps-app-update` through this repository's restricted
deploy key (`DEPLOY_SSH_*`); it has no other server access. The manifest
format of `vps-caddy/sites/*.json` (`domain`, `contactEmail`, `projectName`,
`mode`) is the contract `src/sites.ts` reads; keep both sides in step.
