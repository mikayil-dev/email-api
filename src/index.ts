import { config } from "./config";
import { sendContactEmail } from "./mailer";
import type { ContactFormData } from "./mailer";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

function validateBody(body: unknown): body is ContactFormData {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === "string" &&
    typeof b.name === "string" &&
    typeof b.subject === "string" &&
    typeof b.message === "string" &&
    b.email.includes("@") &&
    b.name.length > 0 &&
    b.subject.length > 0 &&
    b.message.length > 0
  );
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin =
    origin && config.allowedOrigins.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };
}

function json(
  data: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const server = Bun.serve({
  port: config.port,

  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname !== "/api/send" || req.method !== "POST") {
      return json({ error: "Not found" }, 404, cors);
    }

    const apiKey = req.headers.get("X-API-Key");
    if (apiKey !== config.apiKey) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    const ip =
      req.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
      server.requestIP(req)?.address ??
      "unknown";

    if (isRateLimited(ip)) {
      return json({ error: "Too many requests" }, 429, cors);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    if (!validateBody(body)) {
      return json(
        { error: "Invalid body. Required: email, name, subject, message" },
        400,
        cors,
      );
    }

    try {
      await sendContactEmail(body);
      return json({ success: true }, 200, cors);
    } catch (err) {
      console.error("Failed to send email:", err);
      return json({ error: "Failed to send email" }, 500, cors);
    }
  },
});

console.info(`Email API running on http://localhost:${server.port}`);
