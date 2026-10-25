import {
  chmod,
  chown,
  copyFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import { readManifestSites, type ManifestSite } from "./sites";

interface SharedConfig {
  smtp: unknown;
  sites: Record<string, unknown>;
}

export interface SlimResult {
  config: SharedConfig;
  removed: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function option(values: string[], name: string): string {
  const index = values.indexOf(name);
  const value = index >= 0 ? values[index + 1] : undefined;
  return value ? resolve(value) : fail(`Expected ${name} <path>`);
}

/**
 * Drops what the site manifests already provide: `www` origins of configured
 * sites (www redirects to the primary domain, so it never sends) and entries
 * that match their manifest exactly. Entries with their own SMTP account or a
 * different name or recipient stay as explicit overrides.
 */
export function slimConfig(
  raw: unknown,
  manifests: Map<string, ManifestSite>,
): SlimResult {
  if (!isObject(raw) || !("smtp" in raw) || !isObject(raw.sites)) {
    return fail("Expected the shared smtp/sites config format");
  }
  const sites: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [origin, site] of Object.entries(raw.sites)) {
    const url = new URL(origin);
    const primary = url.hostname.startsWith("www.")
      ? `${url.protocol}//${url.hostname.slice(4)}`
      : null;
    const manifest = manifests.get(origin);
    const redundantWww =
      primary !== null && (primary in raw.sites || manifests.has(primary));
    const sameAsManifest =
      manifest !== undefined &&
      isObject(site) &&
      !("smtp" in site) &&
      site.name === manifest.name &&
      site.toEmail === manifest.toEmail;
    if (redundantWww || sameAsManifest) {
      removed.push(origin);
    } else {
      sites[origin] = site;
    }
  }
  return { config: { ...raw, smtp: raw.smtp, sites }, removed };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configPath = option(args, "--config");
  const manifests = readManifestSites(option(args, "--sites"));
  const file = Bun.file(configPath);
  if (!(await file.exists())) fail(`Config file does not exist: ${configPath}`);
  const result = slimConfig(await file.json(), manifests);
  if (result.removed.length === 0) {
    console.info("Nothing to remove");
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
    `Removed ${result.removed.length} origins. Backup: ${backup}\n${result.removed.join("\n")}`,
  );
}

if (import.meta.main) await main();
