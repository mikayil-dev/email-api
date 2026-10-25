import { describe, expect, test } from "bun:test";

import { slimConfig } from "./slim-config";

const smtp = { host: "smtp.example.com", user: "forms@example.com", pass: "x" };
const site = { name: "Example", toEmail: "info@example.com" };

describe("slimConfig", () => {
  test("drops www origins and entries the manifests provide", () => {
    const manifests = new Map([["https://example.com", site]]);
    const result = slimConfig(
      {
        smtp,
        sites: {
          "https://example.com": site,
          "https://www.example.com": site,
          "https://other.de": { name: "Other", toEmail: "a@other.de" },
          "https://www.other.de": { name: "Other", toEmail: "a@other.de" },
          "https://www.lonely.de": { name: "Lonely", toEmail: "a@lonely.de" },
        },
      },
      manifests,
    );
    expect(result.removed).toEqual([
      "https://example.com",
      "https://www.example.com",
      "https://www.other.de",
    ]);
    expect(Object.keys(result.config.sites)).toEqual([
      "https://other.de",
      "https://www.lonely.de",
    ]);
  });

  test("keeps entries that differ from their manifest", () => {
    const manifests = new Map([["https://example.com", site]]);
    const own = { ...site, smtp };
    const renamed = { ...site, name: "Example GmbH" };
    for (const entry of [own, renamed]) {
      const result = slimConfig(
        { smtp, sites: { "https://example.com": entry } },
        manifests,
      );
      expect(result.removed).toEqual([]);
    }
  });
});
