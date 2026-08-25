import {
  chmod,
  chown,
  copyFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

interface LegacySite {
  name: string;
  toEmail: string;
  smtp: Record<string, unknown>;
}

export interface MigrationResult {
  config: {
    smtp: Record<string, unknown>;
    sites: Record<string, unknown>;
  };
  overrides: number;
  origins: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function configArgument(values: string[]): string {
  const index = values.indexOf("--config");
  const config = index >= 0 ? values[index + 1] : undefined;
  return config ? resolve(config) : fail("Expected --config <path>");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateLegacyConfig(raw: unknown): MigrationResult | null {
  if (!isObject(raw)) fail("Config must be a JSON object");
  if ("smtp" in raw && "sites" in raw) {
    return null;
  }

  const entries = Object.entries(raw);
  if (entries.length === 0) fail("Legacy configuration has no origins");
  const groups = new Map<
    string,
    { smtp: Record<string, unknown>; count: number }
  >();
  const legacySites: Array<[string, LegacySite, string]> = [];
  for (const [origin, value] of entries) {
    if (
      !isObject(value) ||
      typeof value.name !== "string" ||
      typeof value.toEmail !== "string" ||
      !isObject(value.smtp)
    ) {
      fail(`Invalid legacy site configuration: ${origin}`);
    }
    const smtpKey = canonical(value.smtp);
    const group = groups.get(smtpKey);
    groups.set(smtpKey, {
      smtp: value.smtp,
      count: (group?.count ?? 0) + 1,
    });
    legacySites.push([origin, value as unknown as LegacySite, smtpKey]);
  }

  const defaultEntry = [...groups.entries()].sort(
    ([leftKey, left], [rightKey, right]) =>
      right.count - left.count || leftKey.localeCompare(rightKey),
  )[0];
  if (!defaultEntry) fail("Could not select a default SMTP configuration");
  const [defaultKey, defaultGroup] = defaultEntry;
  const sites: Record<string, unknown> = {};
  let overrides = 0;
  for (const [origin, site, smtpKey] of legacySites) {
    sites[origin] = {
      name: site.name,
      toEmail: site.toEmail,
      ...(smtpKey === defaultKey ? {} : { smtp: site.smtp }),
    };
    if (smtpKey !== defaultKey) overrides += 1;
  }

  return {
    config: { smtp: defaultGroup.smtp, sites },
    overrides,
    origins: entries.length,
  };
}

async function main(): Promise<void> {
  const configPath = configArgument(process.argv.slice(2));
  const file = Bun.file(configPath);
  if (!(await file.exists())) fail(`Config file does not exist: ${configPath}`);
  const result = migrateLegacyConfig(await file.json());
  if (!result) {
    console.info("Configuration already uses the shared format");
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
    `Migrated ${result.origins} origins; ${result.overrides} use SMTP overrides. Backup: ${backup}`,
  );
}

if (import.meta.main) await main();
