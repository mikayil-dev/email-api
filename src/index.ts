import { config, getOriginConfig, isAllowedOrigin } from "./config";
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
    typeof b.message === "string" &&
    ((b.phone && typeof b.phone === "string" && b.phone.length > 0) ||
      !b.phone) &&
    b.email.includes("@") &&
    b.name.length > 0 &&
    b.message.length > 0
  );
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.info(output);
  }
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

    const ip =
      req.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
      server.requestIP(req)?.address ??
      "unknown";

    if (url.pathname !== "/api/send" || req.method !== "POST") {
      log("warn", "Not found", { ip, path: url.pathname, method: req.method });
      return json({ error: "Not found" }, 404, cors);
    }

    const originConfig = getOriginConfig(origin);
    if (!originConfig) {
      log("warn", "Forbidden origin", { ip, origin });
      return json({ error: "Forbidden" }, 403, cors);
    }

    if (isRateLimited(ip)) {
      log("warn", "Rate limited", { ip });
      return json({ error: "Too many requests" }, 429, cors);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log("warn", "Invalid JSON", { ip });
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    if (!validateBody(body)) {
      log("warn", "Invalid body", { ip });
      return json(
        { error: "Invalid body. Required: email, name, message" },
        400,
        cors,
      );
    }

    try {
      await sendContactEmail(body, originConfig);
      log("info", "Email sent", { ip, origin });
      return json({ success: true }, 200, cors);
    } catch (err) {
      log("error", "Failed to send email", {
        ip,
        origin,
        error: err instanceof Error ? err.message : String(err),
      });
      return json({ error: "Failed to send email" }, 500, cors);
    }
  },
});

log("info", "Server started", { port: server.port });
