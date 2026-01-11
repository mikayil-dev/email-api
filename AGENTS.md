# AGENTS.md - Coding Agent Guidelines

## Project Overview

Minimal email API service built with Bun for handling contact form submissions from static websites. Supports multiple origins with separate SMTP configurations per domain. Uses nodemailer for SMTP transport.

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
CONFIG_FILE=./origins.json bun run dev

# Production
CONFIG_FILE=/path/to/origins.json bun run start

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Run a single file
CONFIG_FILE=./origins.json bun src/index.ts
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
├── index.ts    # HTTP server, routing, middleware (CORS, rate limiting)
├── config.ts   # JSON config file loading and validation, per-origin config lookup
└── mailer.ts   # Nodemailer transport and email sending logic (per-origin SMTP)
```

## Configuration

The app uses a JSON config file instead of environment variables for origin/SMTP settings.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONFIG_FILE` | Yes | Path to the origins JSON config file |
| `PORT` | No | Server port (default: 3000) |

### Origins Config File (`origins.json`)

Maps origin domains to their SMTP settings. See `origins.example.json` for reference:

```json
{
  "https://example.com": {
    "toEmail": "contact@example.com",
    "smtp": {
      "host": "smtp.example.com",
      "port": 587,
      "secure": false,
      "user": "smtp-user@example.com",
      "pass": "your-smtp-password"
    }
  }
}
```

### Config Types (from `config.ts`)

```typescript
interface SmtpConfig {
  host: string;
  port: number;      // default: 587
  secure: boolean;   // default: false
  user: string;
  pass: string;
}

interface OriginConfig {
  toEmail: string;
  smtp: SmtpConfig;
}
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
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { config, getOriginConfig } from "./config";
import type { OriginConfig } from "./config";
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

## HTTP Patterns

### Response Helper

Use the `json()` helper for all responses:

```typescript
function json(data: unknown, status: number, headers?: HeadersInit): Response
```

### CORS

CORS is determined by origins in the config file. Only configured origins receive proper CORS headers.

### Origin-Based Config Resolution

Each request's `Origin` header determines which SMTP config is used:

```typescript
const originConfig = getOriginConfig(origin);
if (!originConfig) {
  return json({ error: "Forbidden" }, 403, cors);
}
await sendContactEmail(body, originConfig);
```

### Rate Limiting

In-memory per-IP rate limiting. 5 requests per minute per IP. Resets after the window expires.

## Security Considerations

- Never log sensitive data (passwords, email content)
- Always escape HTML in email bodies to prevent XSS
- Validate all input with type guards before use
- Use `replyTo` instead of `from` for visitor emails (SPF/DKIM compliance)
- CORS origin validation acts as access control (no API key needed)

## Adding New Features

1. Create new module in `src/`
2. Export types and functions explicitly
3. Import in `index.ts` and wire up
4. Run `bun run typecheck && bun run lint` before committing

## Common Gotchas

- Config is loaded from JSON file at startup, not from `.env`
- `CONFIG_FILE` env var must be set or app won't start
- `Bun.serve` returns a server object with `requestIP()` method
- nodemailer's `sendMail` returns a promise - always await it
- Type guards must return `body is T` for TypeScript narrowing
- SMTP transporter is created per-request (different origins may have different SMTP servers)
