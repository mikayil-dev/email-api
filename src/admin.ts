import { chmod, chown, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Arguments {
  config: string;
  name: string;
  email: string;
  origins: string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function decode(value: string, name: string): string {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    return decoded || fail(`${name} must not be empty`);
  } catch {
    return fail(`Invalid ${name} encoding`);
  }
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return fail(`Origin must be an HTTPS origin without a path: ${value}`);
  }
  return url.origin;
}

function parseArguments(values: string[]): Arguments {
  const configIndex = values.indexOf("--config");
  const nameIndex = values.indexOf("--name-b64");
  const emailIndex = values.indexOf("--email-b64");
  const origins = values
    .map((value, index) =>
      value === "--origin" ? values[index + 1] : undefined,
    )
    .filter((value): value is string => Boolean(value));
  if (
    configIndex < 0 ||
    nameIndex < 0 ||
    emailIndex < 0 ||
    origins.length === 0
  ) {
    return fail(
      "Expected --config, --name-b64, --email-b64, and at least one --origin",
    );
  }
  const config = values[configIndex + 1];
  const encodedName = values[nameIndex + 1];
  const encodedEmail = values[emailIndex + 1];
  if (!config || !encodedName || !encodedEmail)
    return fail("Missing argument value");
  const email = decode(encodedEmail, "email");
  if (!email.includes("@")) return fail("Invalid destination email");
  return {
    config: resolve(config),
    name: decode(encodedName, "name"),
    email,
    origins: origins.map(normalizeOrigin),
  };
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const file = Bun.file(args.config);
  if (!(await file.exists())) {
    return fail(`Config file does not exist: ${args.config}`);
  }
  const config: unknown = await file.json();
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return fail("Config must be a JSON object");
  }
  const value = config as Record<string, unknown>;
  if (!("smtp" in value) || !("sites" in value)) {
    return fail(
      "Central site registration requires the shared smtp/sites config format",
    );
  }
  if (
    typeof value.sites !== "object" ||
    value.sites === null ||
    Array.isArray(value.sites)
  ) {
    return fail("Config sites must be an object");
  }
  const sites = value.sites as Record<string, unknown>;
  for (const origin of args.origins) {
    const existing = sites[origin];
    const smtp =
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing) &&
      "smtp" in existing
        ? { smtp: (existing as Record<string, unknown>).smtp }
        : {};
    sites[origin] = { name: args.name, toEmail: args.email, ...smtp };
  }

  const temporary = `${args.config}.tmp-${process.pid}`;
  const metadata = await stat(args.config);
  const mode = metadata.mode & 0o777;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await chmod(temporary, mode);
  await chown(temporary, metadata.uid, metadata.gid);
  await rename(temporary, args.config);
  console.info(`Registered ${args.origins.join(", ")} -> ${args.email}`);
}

await main();
