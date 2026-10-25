import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ManifestSite {
  name: string;
  toEmail: string;
}

/**
 * Reads the site manifests of vps-caddy (`sites/<domain>.json`). Every static
 * site with a `contactEmail` may send contact forms from `https://<domain>`;
 * its `www` hostname redirects there, so it never sends itself.
 */
export function readManifestSites(
  directory: string,
): Map<string, ManifestSite> {
  const sites = new Map<string, ManifestSite>();
  let files: string[];
  try {
    files = readdirSync(directory).filter((file) => file.endsWith(".json"));
  } catch {
    return sites;
  }
  for (const file of files.sort()) {
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(join(directory, file), "utf-8"));
    } catch {
      continue;
    }
    if (typeof manifest !== "object" || manifest === null) continue;
    const { domain, contactEmail, projectName, mode } = manifest as Record<
      string,
      unknown
    >;
    if (
      mode === "app" ||
      typeof domain !== "string" ||
      !/^[a-z0-9.-]+$/.test(domain) ||
      typeof contactEmail !== "string" ||
      !contactEmail.includes("@")
    ) {
      continue;
    }
    sites.set(`https://${domain}`, {
      name:
        typeof projectName === "string" && projectName.trim()
          ? projectName.trim()
          : domain,
      toEmail: contactEmail.trim(),
    });
  }
  return sites;
}
