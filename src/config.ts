import { readFileSync } from "node:fs";

import { readManifestSites, type ManifestSite } from "./sites";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export interface OriginConfig {
  name: string;
  toEmail: string;
  smtp: SmtpConfig;
}

export interface AppConfig {
  port: number;
  trustProxy: boolean;
  rateLimit: number;
  rateWindowMs: number;
  recipientRateLimit: number;
  /** Explicit origins of the config file; they win over manifests. */
  origins: Map<string, OriginConfig>;
  /** Account of every origin without its own; null in the legacy format. */
  sharedSmtp: SmtpConfig | null;
  /** vps-caddy site manifests that add origins (SITES_DIR). */
  sitesDir: string | null;
}

interface SmtpConfigJson {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  fromEmail?: string;
  fromName?: string;
}

interface SiteConfigJson {
  name: string;
  toEmail: string;
  smtp?: SmtpConfigJson;
}

interface LegacyOriginConfigJson extends SiteConfigJson {
  smtp: SmtpConfigJson;
}

interface SharedConfigJson {
  smtp: SmtpConfigJson;
  sites?: Record<string, SiteConfigJson>;
}

type LegacyConfigJson = Record<string, LegacyOriginConfigJson>;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid origin URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Origin must use HTTP or HTTPS: ${value}`);
  }
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `Origin must not contain a path, credentials, query, or hash: ${value}`,
    );
  }
  return url.origin;
}

function parseSmtp(value: unknown, context: string): SmtpConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Missing or invalid SMTP config for ${context}`);
  }
  const smtp = value as Partial<SmtpConfigJson>;
  if (
    typeof smtp.host !== "string" ||
    !smtp.host ||
    typeof smtp.user !== "string" ||
    !smtp.user ||
    typeof smtp.pass !== "string" ||
    !smtp.pass
  ) {
    throw new Error(
      `Missing required SMTP fields (host, user, pass) for ${context}`,
    );
  }
  const port = smtp.port ?? 587;
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid SMTP port for ${context}`);
  }
  return {
    host: smtp.host,
    port,
    secure: smtp.secure ?? port === 465,
    user: smtp.user,
    pass: smtp.pass,
    fromEmail: smtp.fromEmail ?? smtp.user,
    fromName: smtp.fromName ?? "Website contact forms",
  };
}

function parseSite(value: unknown, origin: string): SiteConfigJson {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid site config for origin: ${origin}`);
  }
  const site = value as Partial<SiteConfigJson>;
  if (typeof site.name !== "string" || !site.name.trim()) {
    throw new Error(`Missing or invalid name for origin: ${origin}`);
  }
  if (typeof site.toEmail !== "string" || !site.toEmail.includes("@")) {
    throw new Error(`Missing or invalid toEmail for origin: ${origin}`);
  }
  return { name: site.name.trim(), toEmail: site.toEmail.trim() };
}

function isSharedConfig(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SharedConfigJson {
  return "smtp" in value;
}

export function parseConfig(
  value: unknown,
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Config file must be a JSON object");
  }
  const json = value as Record<string, unknown>;
  const origins = new Map<string, OriginConfig>();
  const sitesDir = environment.SITES_DIR || null;
  let sharedSmtp: SmtpConfig | null = null;

  if (isSharedConfig(json)) {
    sharedSmtp = parseSmtp(json.smtp, "shared configuration");
    const sites = json.sites ?? {};
    if (typeof sites !== "object" || sites === null || Array.isArray(sites)) {
      throw new Error("Shared config sites must be an object");
    }
    for (const [rawOrigin, rawSite] of Object.entries(sites)) {
      const origin = normalizeOrigin(rawOrigin);
      const site = parseSite(rawSite, origin);
      const smtp = rawSite.smtp ? parseSmtp(rawSite.smtp, origin) : sharedSmtp;
      if (origins.has(origin)) {
        throw new Error(`Duplicate normalized origin: ${origin}`);
      }
      origins.set(origin, { ...site, smtp });
    }
  } else {
    for (const [rawOrigin, rawConfig] of Object.entries(
      json as LegacyConfigJson,
    )) {
      const origin = normalizeOrigin(rawOrigin);
      const site = parseSite(rawConfig, origin);
      const smtp = parseSmtp(rawConfig.smtp, origin);
      if (origins.has(origin)) {
        throw new Error(`Duplicate normalized origin: ${origin}`);
      }
      origins.set(origin, { ...site, smtp });
    }
  }

  if (origins.size === 0 && !(sitesDir && sharedSmtp)) {
    throw new Error(
      "Config file must contain at least one site origin, or SITES_DIR with a shared smtp",
    );
  }

  return {
    port: parsePositiveInteger(environment.PORT, 3000, "PORT"),
    trustProxy: parseBoolean(environment.TRUST_PROXY, false),
    rateLimit: parsePositiveInteger(environment.RATE_LIMIT, 5, "RATE_LIMIT"),
    recipientRateLimit: parsePositiveInteger(
      environment.RECIPIENT_RATE_LIMIT,
      20,
      "RECIPIENT_RATE_LIMIT",
    ),
    rateWindowMs: parsePositiveInteger(
      environment.RATE_WINDOW_MS,
      60_000,
      "RATE_WINDOW_MS",
    ),
    origins,
    sharedSmtp,
    sitesDir,
  };
}

export function loadConfig(
  configPath: string,
  environment = process.env,
): AppConfig {
  let fileContent: string;
  try {
    fileContent = readFileSync(configPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read config file at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(fileContent);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }
  return parseConfig(json, environment);
}

const configPath = process.env.CONFIG_FILE;
if (!configPath) {
  throw new Error("Missing required environment variable: CONFIG_FILE");
}

export const config = loadConfig(configPath);

const MANIFEST_TTL_MS = 60_000;
let manifestCache = { loadedAt: 0, sites: new Map<string, ManifestSite>() };

/** Manifest origins, re-read at most once a minute so new sites need no restart. */
export function manifestSites(
  appConfig: AppConfig = config,
  now = Date.now(),
): Map<string, ManifestSite> {
  if (!appConfig.sitesDir || !appConfig.sharedSmtp) return new Map();
  if (now - manifestCache.loadedAt >= MANIFEST_TTL_MS) {
    manifestCache = {
      loadedAt: now,
      sites: readManifestSites(appConfig.sitesDir),
    };
  }
  return manifestCache.sites;
}

export function resolveOrigin(
  appConfig: AppConfig,
  origin: string,
  sites: Map<string, ManifestSite>,
): OriginConfig | null {
  const explicit = appConfig.origins.get(origin);
  if (explicit) return explicit;
  const site = sites.get(origin);
  return site && appConfig.sharedSmtp
    ? { ...site, smtp: appConfig.sharedSmtp }
    : null;
}

export function originCount(): number {
  const all = new Set([...config.origins.keys(), ...manifestSites().keys()]);
  return all.size;
}

export function getOriginConfig(origin: string | null): OriginConfig | null {
  if (!origin) return null;
  try {
    return resolveOrigin(config, normalizeOrigin(origin), manifestSites());
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | null): boolean {
  return getOriginConfig(origin) !== null;
}
