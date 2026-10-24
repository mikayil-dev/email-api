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
  smtp: Record<string, unknown>;
  sites: Record<string, unknown>;
}

export interface SenderRow {
  origin: string;
  fromEmail: string;
  toEmail: string;
  override: boolean;
}

export interface SenderChange {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  keepOrigins: string[];
}

interface Arguments {
  config: string;
  change: Omit<SenderChange, "pass"> | null;
}

function fail(message: string): never {
  throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sharedConfig(raw: unknown): SharedConfig {
  if (!isObject(raw) || !isObject(raw.smtp) || !isObject(raw.sites)) {
    return fail("Expected the shared smtp/sites config format");
  }
  return { ...raw, smtp: raw.smtp, sites: raw.sites };
}

function senderOf(smtp: Record<string, unknown>): string {
  const from = smtp.fromEmail ?? smtp.user;
  return typeof from === "string" ? from : "(unknown)";
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search) {
    return fail(`Origin must be an HTTPS origin without a path: ${value}`);
  }
  return url.origin;
}

/** Lists which sender and recipient every origin uses, without secrets. */
export function listSenders(raw: unknown): SenderRow[] {
  const config = sharedConfig(raw);
  return Object.entries(config.sites).map(([origin, site]) => {
    const override = isObject(site) && isObject(site.smtp);
    const smtp = override
      ? (site.smtp as Record<string, unknown>)
      : config.smtp;
    const toEmail =
      isObject(site) && typeof site.toEmail === "string"
        ? site.toEmail
        : "(unknown)";
    return { origin, fromEmail: senderOf(smtp), toEmail, override };
  });
}

/**
 * Replaces the shared SMTP account. Origins in `keepOrigins` (and their www
 * counterparts) that use the shared account keep the previous one as an
 * override, so only the remaining sites switch to the new sender.
 */
export function switchSharedSender(
  raw: unknown,
  change: SenderChange,
): { config: SharedConfig; kept: string[] } {
  const config = sharedConfig(raw);
  const previous = config.smtp;
  const keep = new Set<string>();
  for (const origin of change.keepOrigins) {
    const url = new URL(origin);
    keep.add(url.origin);
    if (!url.hostname.startsWith("www.")) {
      url.hostname = `www.${url.hostname}`;
      keep.add(url.origin);
    }
  }
  const sites = { ...config.sites };
  const kept: string[] = [];
  for (const [origin, site] of Object.entries(sites)) {
    if (!keep.has(origin) || !isObject(site) || isObject(site.smtp)) continue;
    sites[origin] = { ...site, smtp: previous };
    kept.push(origin);
  }
  const smtp = {
    host: change.host,
    port: change.port,
    secure: change.port === 465,
    user: change.user,
    pass: change.pass,
    fromEmail: change.fromEmail,
    fromName: change.fromName,
  };
  return { config: { ...config, smtp, sites }, kept };
}

function option(values: string[], name: string): string | undefined {
  const index = values.indexOf(name);
  if (index < 0) return undefined;
  return values[index + 1] ?? fail(`Missing value for ${name}`);
}

function parseArguments(values: string[]): Arguments {
  const config = option(values, "--config") ?? fail("Expected --config");
  const user = option(values, "--user");
  if (!user) return { config: resolve(config), change: null };
  const port = Number(option(values, "--port") ?? "587");
  if (!Number.isInteger(port) || port <= 0) fail("Invalid --port");
  const keepOrigins = values
    .map((value, index) => (value === "--keep" ? values[index + 1] : undefined))
    .filter((value): value is string => Boolean(value))
    .map(normalizeOrigin);
  return {
    config: resolve(config),
    change: {
      host: option(values, "--host") ?? fail("Expected --host"),
      port,
      user,
      fromEmail: option(values, "--from-email") ?? user,
      fromName: option(values, "--from-name") ?? "Website-Kontaktformular",
      keepOrigins,
    },
  };
}

async function readPassword(): Promise<string> {
  const pass = (await Bun.stdin.text()).replace(/\r?\n$/, "");
  return pass || fail("Pass the SMTP password on stdin");
}

function printSenders(raw: unknown): void {
  for (const row of listSenders(raw)) {
    const marker = row.override ? " (eigenes Konto)" : "";
    console.info(`${row.origin}: ${row.fromEmail}${marker} -> ${row.toEmail}`);
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const file = Bun.file(args.config);
  if (!(await file.exists()))
    fail(`Config file does not exist: ${args.config}`);
  const raw: unknown = await file.json();
  if (!args.change) {
    printSenders(raw);
    return;
  }

  const result = switchSharedSender(raw, {
    ...args.change,
    pass: await readPassword(),
  });
  const metadata = await stat(args.config);
  const mode = metadata.mode & 0o777;
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backup = `${args.config}.backup-${timestamp}`;
  const temporary = `${args.config}.tmp-${process.pid}`;
  await copyFile(args.config, backup);
  await chmod(backup, mode);
  await chown(backup, metadata.uid, metadata.gid);
  await writeFile(temporary, `${JSON.stringify(result.config, null, 2)}\n`, {
    mode,
  });
  await chmod(temporary, mode);
  await chown(temporary, metadata.uid, metadata.gid);
  await rename(temporary, args.config);
  console.info(`Backup: ${backup}`);
  printSenders(result.config);
}

if (import.meta.main) await main();
