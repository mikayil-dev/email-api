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

## Which sites may send

Two sources, both read at runtime:

1. **Site manifests of vps-caddy** (`SITES_DIR`, mounted read-only from
   `/srv/vps-caddy/sites`). Every static site whose manifest has a
   `contactEmail` may send from `https://<domain>`; the subject names its
   `projectName`. A new site therefore works as soon as its first deployment has
   applied the Caddy configuration (the server checkout follows `main`). The
   manifests are re-read once a minute, so no restart and no registration is
   needed. `www` origins are not allowed and not needed: every `www` hostname
   redirects to its primary domain before a form is shown.
2. **`origins.json`** (`CONFIG_FILE`, secret, only on the server): the shared
   SMTP account plus explicit entries that win over manifests, for sites with an
   own SMTP account (the HM sites) or without a manifest.

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
      "toEmail": "info@example.com",
      "smtp": { "host": "…", "user": "…", "pass": "…" }
    }
  }
}
```

`sites` may be empty when `SITES_DIR` is set. The previous per-origin SMTP format
(no top-level `smtp`) remains readable but ignores manifests; convert it without
copying credentials by hand:

```bash
bun run config:migrate -- --config origins.json
```

Drop explicit entries that the manifests already provide, and all `www`
origins of configured sites (a backup is written first):

```bash
bun run config:slim -- --config origins.json --sites ../vps-caddy/sites
```

## Contact-form sender

Show which sender and recipient every origin uses (no passwords are printed):

```bash
bun run smtp:sender -- --config origins.json --sites /srv/vps-caddy/sites
```

Switch the shared sender for all sites that have no own SMTP account. Sites
passed with `--keep` stay on the previous shared account as an override (a
site known only from its manifest gets an explicit entry). The password is read from stdin, the file is
backed up first and written atomically:

```bash
printf '%s' "$SMTP_PASS" | bun run smtp:sender -- --config origins.json --sites /srv/vps-caddy/sites \
  --host mail.your-server.de --user formular@example.com \
  --from-name "Website-Kontaktformular" \
  --keep https://example-owner-site.de
```

Restart the service afterwards (`docker compose restart email-api`).

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

`GET /healthz` returns service status and the number of allowed origins.

## Runtime environment

| Variable               |  Default | Description                                                                   |
| ---------------------- | -------: | ----------------------------------------------------------------------------- |
| `CONFIG_FILE`          | required | JSON configuration path                                                       |
| `SITES_DIR`            |     none | Directory of vps-caddy site manifests that add origins                        |
| `PORT`                 |   `3000` | HTTP port                                                                     |
| `TRUST_PROXY`          |  `false` | Trust the first Caddy-provided `X-Forwarded-For` value                        |
| `RATE_LIMIT`           |      `5` | Requests allowed per IP/window                                                |
| `RECIPIENT_RATE_LIMIT` |     `20` | Valid submissions per recipient mailbox/window, shared across origins and IPs |
| `RATE_WINDOW_MS`       |  `60000` | Rate-limit window                                                             |

Set `TRUST_PROXY=true` only when the service is reachable exclusively through a
trusted reverse proxy. The Docker Compose configuration binds to localhost and
enables this mode for Caddy.

## Deployment

A push to `main` builds and pushes the image to GHCR. The deploy key of this
repository may only run `vps-app-update email.pikcode.de` on the VPS (pull and
restart the app in `/srv/email-api`, see vps-caddy README, "Apps"). The
Compose file on the server is not replaced by deployments; change it there
when `docker-compose.yml` changes. The production `origins.json` file is never
fetched or replaced.

## Security boundary

- SMTP passwords stay only in the mounted production configuration.
- The visitor address is `Reply-To`, never the SMTP envelope sender.
- Origins are allowlisted and CORS headers are emitted only for those origins.
- Origin/CORS checks are not authentication; rate limiting and the honeypot are
  the abuse controls. Add a server-verified challenge if a site attracts abuse.
- Bodies and individual fields have explicit size limits.
- The 32 KiB body limit is enforced by Bun and during streaming, even without a
  Content-Length header. Oversized streams are cancelled before JSON parsing.
- Each recipient mailbox has a shared submission budget (20/minute by default),
  so rotating IPs or switching origins does not bypass it.
  Honeypot and invalid submissions do not consume this mailbox budget. Limits
  are in-memory, reset on restart, and apply per process; they are not a CAPTCHA
  or protection against a determined distributed denial of service.
- Rate-limit maps hold at most 10,000 keys each and reject new keys when full
  until entries expire. Env variants and origins.json backups are ignored by
  Git and excluded from Docker builds. This does not remove previously tracked secrets.
- Logs exclude message bodies and SMTP credentials.
