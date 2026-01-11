# email-api

Minimal email API for contact form submissions from static websites. Specialized for some of my and my friends smaller websites.
Supports multiple origins with separate SMTP configurations.

## Setup

```bash
bun install
cp origins.example.json origins.json
# Edit origins.json with your SMTP credentials
```

## Configuration

Configuration is loaded from a JSON file specified by the `CONFIG_FILE` environment variable.

### Environment Variables

| Variable      | Description                                        |
| ------------- | -------------------------------------------------- |
| `CONFIG_FILE` | **Required.** Path to the origins JSON config file |
| `PORT`        | Server port (default: 3000)                        |

### Origins Config File

The config file maps origin domains to their SMTP settings:

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
  },
  "https://another-site.com": {
    "toEmail": "hello@another-site.com",
    "smtp": {
      "host": "smtp.another-provider.com",
      "port": 465,
      "secure": true,
      "user": "noreply@another-site.com",
      "pass": "another-smtp-password"
    }
  }
}
```

| Field         | Description                                          |
| ------------- | ---------------------------------------------------- |
| `toEmail`     | Recipient email address for contact form submissions |
| `smtp.host`   | SMTP server hostname                                 |
| `smtp.port`   | SMTP port (default: 587)                             |
| `smtp.secure` | Use TLS (default: false, set true for port 465)      |
| `smtp.user`   | SMTP username                                        |
| `smtp.pass`   | SMTP password                                        |

## Run

### Development

```bash
CONFIG_FILE=./origins.json bun run dev
```

### Production

```bash
CONFIG_FILE=/path/to/origins.json bun run start
```

### Docker Compose

```yaml
services:
  email-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - CONFIG_FILE=/config/origins.json
    volumes:
      - ./origins.json:/config/origins.json:ro
```

## API

### `POST /api/send`

Send a contact form email. The request's `Origin` header determines which SMTP config is used.

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "email": "visitor@example.com",
  "name": "John Doe",
  "subject": "Hello",
  "message": "I'd like to get in touch..."
}
```

**Response:**

```json
{ "success": true }
```

**Error Responses:**

- `403 Forbidden` - Origin not in config file
- `400 Bad Request` - Invalid JSON or missing fields
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - SMTP failure

## Usage from Static Site

```javascript
async function sendContactForm(data) {
  const response = await fetch("https://your-api.com/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error);
  }

  return response.json();
}

// Example
sendContactForm({
  email: "visitor@example.com",
  name: "John Doe",
  subject: "Hello",
  message: "I'd like to get in touch...",
});
```

## Security

- **CORS**: Only origins defined in the config file are allowed
- **Rate Limiting**: 5 requests per minute per IP address
- **No API Key**: Authentication relies on CORS origin validation
