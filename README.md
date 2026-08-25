# email-api

Small contact-form delivery service for static websites. It uses a controlled
SMTP identity, routes each allowed website origin to its destination mailbox,
and sets the visitor as `Reply-To`.

## Commands

```bash
bun install
bun run dev
bun run validate
bun run start
```

Production requires `CONFIG_FILE`. Development can use the example:

```bash
cp origins.example.json origins.json
CONFIG_FILE=origins.json bun run dev
```

## Shared configuration

The recommended format keeps one SMTP secret and only repeats public per-site
routing data:

```json
{
  "smtp": {
    "host": "mail.your-server.de",
    "port": 587,
    "secure": false,
    "user": "forms@example.com",
    "pass": "secret",
    "fromEmail": "forms@example.com",
    "fromName": "Website contact forms"
  },
  "sites": {
    "https://example.com": {
      "name": "Example Site",
      "toEmail": "info@example.com"
    },
    "https://www.example.com": {
      "name": "Example Site",
      "toEmail": "info@example.com"
    }
  }
}
```

The previous per-origin SMTP format remains supported so the running service can
be upgraded before its production configuration is migrated. Central
registration requires the shared format.

Sites may contain an optional `smtp` object when an existing origin must keep a
different sending account. Convert a legacy file without exposing or manually
copying credentials:

```bash
bun run config:migrate -- --config origins.json
```

The migration selects the most-used account as the shared default, keeps other
accounts as per-site overrides, and creates a timestamped backup first. Both the
migration and central registration preserve the file's owner, group, and mode
when replacing it atomically.

Reconcile mandatory `www` origins for an already migrated configuration with:

```bash
bun run origins:reconcile-www -- --config origins.json
```

The command copies each primary site's complete routing configuration, skips
localhost and IP origins, creates a backup, and is safe to run repeatedly.

## Register or update a site

The central `vps-caddy` command invokes this idempotent command from the
deployed Docker image, so the VPS does not need a separate Bun installation or
an up-to-date source checkout. To run it directly from a source checkout:

```bash
bun run site:upsert -- \
  --config origins.json \
  --name-b64 RXhhbXBsZSBTaXRl \
  --email-b64 aW5mb0BleGFtcGxlLmNvbQ== \
  --origin https://example.com \
  --origin https://www.example.com
```

Names and addresses are base64 encoded only to pass them safely through SSH;
base64 is not encryption. The configuration file remains secret and must not be
committed.

## HTTP API

`POST /api/send` accepts JSON:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.net",
  "phone": "+49 123 456",
  "message": "Hello"
}
```

`name`, `email`, and `message` are required. `phone` is optional. A successful
request returns `{ "success": true }`.

`GET /healthz` returns service status and the number of configured origins.

## Runtime environment

| Variable         |  Default | Description                                            |
| ---------------- | -------: | ------------------------------------------------------ |
| `CONFIG_FILE`    | required | JSON configuration path                                |
| `PORT`           |   `3000` | HTTP port                                              |
| `TRUST_PROXY`    |  `false` | Trust the first Caddy-provided `X-Forwarded-For` value |
| `RATE_LIMIT`     |      `5` | Requests allowed per IP/window                         |
| `RATE_WINDOW_MS` |  `60000` | Rate-limit window                                      |

Set `TRUST_PROXY=true` only when the service is reachable exclusively through a
trusted reverse proxy. The Docker Compose configuration binds to localhost and
enables this mode for Caddy.

The deployment workflow validates and installs the Compose file from the exact
Git revision being deployed before it restarts the service. The production
`origins.json` file is never fetched or replaced.

## Security boundary

- SMTP passwords stay only in the mounted production configuration.
- The visitor address is `Reply-To`, never the SMTP envelope sender.
- Origins are allowlisted and CORS headers are emitted only for those origins.
- Origin/CORS checks are not authentication; rate limiting and the honeypot are
  the abuse controls. Add a server-verified challenge if a site attracts abuse.
- Bodies and individual fields have explicit size limits.
- Logs exclude message bodies and SMTP credentials.
