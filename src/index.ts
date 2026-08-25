import { config, getOriginConfig, isAllowedOrigin } from "./config";
import { validateContactFormData } from "./contact-form";
import { sendContactEmail } from "./mailer";
import { RateLimiter } from "./rate-limiter";

const MAX_BODY_BYTES = 32_768;
const rateLimiter = new RateLimiter(config.rateLimit, config.rateWindowMs);

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  data: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function log(
  level: "info" | "warn" | "error",
  message: string,
  meta: Record<string, unknown> = {},
): void {
  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

function requestIp(req: Request, serverIp: string): string {
  if (!config.trustProxy) return serverIp;
  return req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || serverIp;
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (url.pathname === "/healthz" && req.method === "GET") {
      return json({ status: "ok", sites: config.origins.size }, 200);
    }
    if (url.pathname !== "/api/send") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    const serverIp = server.requestIP(req)?.address ?? "unknown";
    const ip = requestIp(req, serverIp);
    const originConfig = getOriginConfig(origin);
    if (!originConfig) {
      log("warn", "Forbidden origin", { ip, origin });
      return json({ error: "Forbidden" }, 403, cors);
    }
    if (rateLimiter.isLimited(ip)) {
      log("warn", "Rate limited", { ip });
      return json({ error: "Too many requests" }, 429, cors);
    }

    const contentLength = Number(req.headers.get("Content-Length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, cors);
    }

    let body: unknown;
    try {
      const text = await req.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
        return json({ error: "Request too large" }, 413, cors);
      }
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }
    if (!validateContactFormData(body)) {
      return json(
        { error: "Invalid body. Required: email, name, message" },
        400,
        cors,
      );
    }
    if (body.website) {
      log("info", "Discarded honeypot submission", { ip, origin });
      return json({ success: true }, 200, cors);
    }

    try {
      await sendContactEmail(body, originConfig);
      log("info", "Email sent", { ip, origin });
      return json({ success: true }, 200, cors);
    } catch (error) {
      log("error", "Failed to send email", {
        ip,
        origin,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ error: "Failed to send email" }, 500, cors);
    }
  },
});

log("info", "Server started", {
  port: server.port,
  sites: config.origins.size,
  trustProxy: config.trustProxy,
});
