# AGENTS.md - Coding Agent Guidelines

## Project Overview

Minimal email API service built with Bun for handling contact form submissions from static websites. Uses nodemailer for SMTP transport.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **HTTP**: Bun.serve (native)
- **Email**: nodemailer
- **Linting**: ESLint 9 with typescript-eslint
- **Formatting**: Prettier

## Commands

```bash
# Development (hot reload)
bun run dev

# Production
bun run start

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Run a single file
bun src/index.ts
```

No test framework is configured yet. When adding tests, use `bun:test`:

```bash
# Future test commands
bun test                    # Run all tests
bun test src/mailer.test.ts # Run single test file
bun test --watch            # Watch mode
```

## Project Structure

```
src/
├── index.ts    # HTTP server, routing, middleware (CORS, auth, rate limiting)
├── config.ts   # Environment variable validation and typed config
└── mailer.ts   # Nodemailer transport and email sending logic
```

## Code Style

### Formatting (Prettier)

- 2 spaces, no tabs
- Semicolons required
- Double quotes for strings
- Trailing commas everywhere
- Always use parentheses for arrow function params

### TypeScript

- Strict mode enabled
- Use `type` imports: `import type { Foo } from "./bar"`
- No `any` - use `unknown` and narrow with type guards
- Prefer `const` assertions for config objects: `as const`
- Function overloads for polymorphic functions (see `config.ts`)

### ESLint Rules

- `eqeqeq: always` - No `==` or `!=`, use `===` and `!==`
- `prefer-const` - Use `const` unless reassignment is needed
- `no-var` - Never use `var`
- `no-console` - Use `console.warn`, `console.error`, or `console.info` only
- `@typescript-eslint/no-floating-promises` - Always await or void promises
- `@typescript-eslint/no-unused-vars` - Prefix unused vars with `_`

### Naming Conventions

- **Files**: lowercase with hyphens (`rate-limiter.ts`)
- **Functions**: camelCase (`sendContactEmail`)
- **Types/Interfaces**: PascalCase (`ContactFormData`)
- **Constants**: SCREAMING_SNAKE_CASE (`RATE_LIMIT`)
- **Private/unused params**: prefix with `_` (`_unused`)

### Imports Order

1. Node.js builtins / Bun APIs
2. External packages (nodemailer, etc.)
3. Internal modules (relative imports)
4. Type-only imports last

```typescript
import { something } from "node:fs";
import nodemailer from "nodemailer";
import { config } from "./config";
import type { ContactFormData } from "./mailer";
```

## Error Handling

- Throw `Error` with descriptive messages for unrecoverable errors
- Use early returns for validation failures
- Log errors with `console.error` before returning error responses
- Never expose internal error details to clients

```typescript
// Good
if (!validateBody(body)) {
  return json({ error: "Invalid body" }, 400, cors);
}

// Bad - exposes internals
catch (err) {
  return json({ error: err.message }, 500);
}
```

## Environment Variables

All required env vars are validated at startup in `config.ts`. The app crashes fast if any are missing.

Required variables (see `.env.example`):
- `API_KEY` - Authentication for API requests
- `ALLOWED_ORIGINS` - Comma-separated CORS whitelist
- `TO_EMAIL` - Recipient for contact form emails
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - SMTP credentials

## HTTP Patterns

### Response Helper

Use the `json()` helper for all responses:

```typescript
function json(data: unknown, status: number, headers?: HeadersInit): Response
```

### CORS

CORS headers are computed per-request based on `ALLOWED_ORIGINS`. Always include them in responses.

### Authentication

API key via `X-API-Key` header. Check before processing any request.

### Rate Limiting

In-memory per-IP rate limiting. 5 requests per minute per IP. Resets after the window expires.

## Security Considerations

- Never log sensitive data (API keys, passwords, email content)
- Always escape HTML in email bodies to prevent XSS
- Validate all input with type guards before use
- Use `replyTo` instead of `from` for visitor emails (SPF/DKIM compliance)

## Adding New Features

1. Create new module in `src/`
2. Export types and functions explicitly
3. Import in `index.ts` and wire up
4. Run `bun run typecheck && bun run lint` before committing

## Common Gotchas

- Bun auto-loads `.env` files - no dotenv needed
- `Bun.serve` returns a server object with `requestIP()` method
- nodemailer's `sendMail` returns a promise - always await it
- Type guards must return `body is T` for TypeScript narrowing
