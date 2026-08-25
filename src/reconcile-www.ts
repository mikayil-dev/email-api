import { isIP } from "node:net";
import {
  chmod,
  chown,
  copyFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

interface SharedConfig {
  smtp: unknown;
  sites: Record<string, unknown>;
}

export interface ReconcileResult {
  config: SharedConfig;
  added: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configArgument(values: string[]): string {
  const index = values.indexOf("--config");
  const config = index >= 0 ? values[index + 1] : undefined;
  return config ? resolve(config) : fail("Expected --config <path>");
}

function wwwOrigin(origin: string): string | null {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.hostname === "localhost" ||
    url.hostname.startsWith("www.") ||
    isIP(url.hostname) !== 0
  ) {
    return null;
  }
  url.hostname = `www.${url.hostname}`;
  return url.origin;
}

export function reconcileWwwOrigins(raw: unknown): ReconcileResult {
  if (!isObject(raw) || !("smtp" in raw) || !isObject(raw.sites)) {
    fail("Expected the shared smtp/sites config format");
  }
  const sites = { ...raw.sites };
  const added: string[] = [];
  for (const [origin, site] of Object.entries(raw.sites)) {
    const counterpart = wwwOrigin(origin);
    if (!counterpart || counterpart in sites) continue;
    sites[counterpart] = site;
    added.push(counterpart);
  }
  return { config: { smtp: raw.smtp, sites }, added };
}

async function main(): Promise<void> {
  const configPath = configArgument(process.argv.slice(2));
  const file = Bun.file(configPath);
  if (!(await file.exists())) fail(`Config file does not exist: ${configPath}`);
  const result = reconcileWwwOrigins(await file.json());
  if (result.added.length === 0) {
    console.info("All configured sites already have matching www origins");
    return;
  }

  const metadata = await stat(configPath);
  const mode = metadata.mode & 0o777;
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backup = `${configPath}.backup-${timestamp}`;
  const temporary = `${configPath}.tmp-${process.pid}`;
  await copyFile(configPath, backup);
  await chmod(backup, mode);
  await chown(backup, metadata.uid, metadata.gid);
  await writeFile(temporary, `${JSON.stringify(result.config, null, 2)}\n`, {
    mode,
  });
  await chmod(temporary, mode);
  await chown(temporary, metadata.uid, metadata.gid);
  await rename(temporary, configPath);
  console.info(
    `Added ${result.added.length} www origins. Backup: ${backup}\n${result.added.join("\n")}`,
  );
}

if (import.meta.main) await main();
