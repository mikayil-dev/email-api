# email-api

Minimal email API for contact form submissions from static websites.

## Setup

```bash
bun install
cp .env.example .env
# Edit .env with your SMTP credentials
```

## Configuration

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `API_KEY` | Secret key for authenticating requests |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `TO_EMAIL` | Recipient email address |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_SECURE` | Use TLS (true for port 465) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |

## Run

```bash
bun run dev    # Development with hot reload
bun run start  # Production
```

## API

### `POST /api/send`

Send a contact form email.

**Headers:**
```
Content-Type: application/json
X-API-Key: your-api-key
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

## Usage from Static Site

```javascript
async function sendContactForm(data) {
  const response = await fetch("https://your-api.com/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "your-api-key",
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

## Rate Limiting

5 requests per minute per IP address.
