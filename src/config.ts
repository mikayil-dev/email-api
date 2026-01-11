import { readFileSync } from "node:fs";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface OriginConfig {
  name: string;
  toEmail: string;
  smtp: SmtpConfig;
}

export interface AppConfig {
  port: number;
  origins: Map<string, OriginConfig>;
}

interface OriginConfigJson {
  name: string;
  toEmail: string;
  smtp: {
    host: string;
    port?: number;
    secure?: boolean;
    user: string;
    pass: string;
  };
}

type ConfigFileJson = Record<string, OriginConfigJson>;

function loadConfig(): AppConfig {
  const configPath = process.env.CONFIG_FILE;
  if (!configPath) {
    throw new Error("Missing required environment variable: CONFIG_FILE");
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read config file at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(fileContent);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("Config file must be a JSON object");
  }

  const configJson = json as ConfigFileJson;
  const origins = new Map<string, OriginConfig>();

  for (const [origin, originConfig] of Object.entries(configJson)) {
    if (!originConfig.toEmail || typeof originConfig.toEmail !== "string") {
      throw new Error(`Missing or invalid toEmail for origin: ${origin}`);
    }
    if (!originConfig.smtp || typeof originConfig.smtp !== "object") {
      throw new Error(`Missing or invalid smtp config for origin: ${origin}`);
    }

    const { smtp } = originConfig;
    if (!smtp.host || !smtp.user || !smtp.pass) {
      throw new Error(
        `Missing required smtp fields (host, user, pass) for origin: ${origin}`,
      );
    }

    origins.set(origin, {
      name: originConfig.name,
      toEmail: originConfig.toEmail,
      smtp: {
        host: smtp.host,
        port: smtp.port ?? 587,
        secure: smtp.secure ?? false,
        user: smtp.user,
        pass: smtp.pass,
      },
    });
  }

  if (origins.size === 0) {
    throw new Error("Config file must contain at least one origin");
  }

  return {
    port: Number(process.env.PORT) || 3000,
    origins,
  };
}

export const config = loadConfig();

export function getOriginConfig(origin: string | null): OriginConfig | null {
  if (!origin) return null;
  return config.origins.get(origin) ?? null;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return config.origins.has(origin);
}
