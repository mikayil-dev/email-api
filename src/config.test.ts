import { describe, expect, test } from "bun:test";

import { parseConfig } from "./config";

const smtp = {
  host: "smtp.example.com",
  user: "forms@example.com",
  pass: "secret",
};

describe("parseConfig", () => {
  test("shares one SMTP configuration across primary and www origins", () => {
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
