import { describe, expect, test } from "bun:test";

import { parseConfig } from "./config";
import { migrateLegacyConfig } from "./migrate-config";

const primarySmtp = {
  host: "smtp.example.com",
  user: "primary@example.com",
  pass: "primary-secret",
};
const secondarySmtp = {
  host: "smtp.example.com",
  user: "secondary@example.com",
  pass: "secondary-secret",
};

describe("migrateLegacyConfig", () => {
  test("deduplicates the common account and preserves SMTP overrides", () => {
    const result = migrateLegacyConfig({
      "https://one.example.com": {
        name: "One",
        toEmail: "one@example.com",
        smtp: primarySmtp,
      },
      "https://www.one.example.com": {
        name: "One",
        toEmail: "one@example.com",
        smtp: primarySmtp,
      },
      "https://two.example.com": {
        name: "Two",
        toEmail: "two@example.com",
        smtp: secondarySmtp,
      },
    });

    expect(result?.origins).toBe(3);
    expect(result?.overrides).toBe(1);
    const parsed = parseConfig(result?.config, {});
    expect(parsed.origins.get("https://one.example.com")?.smtp.user).toBe(
      "primary@example.com",
    );
    expect(parsed.origins.get("https://two.example.com")?.smtp.user).toBe(
      "secondary@example.com",
    );
  });
});
