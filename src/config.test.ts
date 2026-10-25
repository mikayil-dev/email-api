import { describe, expect, test } from "bun:test";

import { parseConfig, resolveOrigin } from "./config";

const smtp = {
  host: "smtp.example.com",
  user: "forms@example.com",
  pass: "secret",
};

describe("parseConfig", () => {
  test("shares one SMTP configuration across origins", () => {
    const config = parseConfig(
      {
        smtp,
        sites: {
          "https://example.com": {
            name: "Example",
            toEmail: "info@example.com",
          },
          "https://www.example.com": {
            name: "Example",
            toEmail: "info@example.com",
          },
        },
      },
      {},
    );
    expect(config.origins.size).toBe(2);
    expect(config.origins.get("https://example.com")?.smtp.fromEmail).toBe(
      "forms@example.com",
    );
  });

  test("keeps the legacy per-origin format working", () => {
    const config = parseConfig(
      {
        "https://legacy.example.com": {
          name: "Legacy",
          toEmail: "info@example.com",
          smtp,
        },
      },
      {},
    );
    expect(config.origins.get("https://legacy.example.com")?.name).toBe(
      "Legacy",
    );
  });

  test("allows a site to override the shared SMTP account", () => {
    const config = parseConfig(
      {
        smtp,
        sites: {
          "https://example.com": {
            name: "Example",
            toEmail: "info@example.com",
            smtp: {
              host: "other.example.com",
              user: "other@example.com",
              pass: "other-secret",
            },
          },
        },
      },
      {},
    );
    expect(config.origins.get("https://example.com")?.smtp.user).toBe(
      "other@example.com",
    );
  });

  test("adds manifest origins with the shared account; explicit entries win", () => {
    const config = parseConfig(
      {
        smtp,
        sites: {
          "https://own.de": {
            name: "Own",
            toEmail: "own@own.de",
            smtp: { ...smtp, user: "own@own.de" },
          },
        },
      },
      { SITES_DIR: "/srv/vps-caddy/sites" },
    );
    const manifests = new Map([
      ["https://a.de", { name: "A", toEmail: "info@a.de" }],
      ["https://own.de", { name: "Own", toEmail: "own@own.de" }],
    ]);
    expect(resolveOrigin(config, "https://a.de", manifests)?.smtp.user).toBe(
      "forms@example.com",
    );
    expect(resolveOrigin(config, "https://own.de", manifests)?.smtp.user).toBe(
      "own@own.de",
    );
    expect(resolveOrigin(config, "https://www.a.de", manifests)).toBeNull();
  });

  test("allows an empty sites map when manifests are read", () => {
    const config = parseConfig({ smtp }, { SITES_DIR: "/srv/vps-caddy/sites" });
    expect(config.origins.size).toBe(0);
    expect(() => parseConfig({ smtp }, {})).toThrow("at least one site origin");
  });

  test("rejects origins with paths", () => {
    expect(() =>
      parseConfig(
        {
          smtp,
          sites: {
            "https://example.com/path": {
              name: "Example",
              toEmail: "info@example.com",
            },
          },
        },
        {},
      ),
    ).toThrow("Origin must not contain a path");
  });
});
