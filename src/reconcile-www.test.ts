import { describe, expect, test } from "bun:test";

import { reconcileWwwOrigins } from "./reconcile-www";

describe("reconcileWwwOrigins", () => {
  test("adds www for domains and subdomains while preserving site settings", () => {
    const one = { name: "One", toEmail: "one@example.com" };
    const two = {
      name: "Two",
      toEmail: "two@example.com",
      smtp: { user: "two" },
    };
    const result = reconcileWwwOrigins({
      smtp: { user: "default" },
      sites: {
        "https://example.com": one,
        "https://project.example.com": two,
        "http://localhost:4321": one,
      },
    });

    expect(result.added).toEqual([
      "https://www.example.com",
      "https://www.project.example.com",
    ]);
    expect(result.config.sites["https://www.example.com"]).toEqual(one);
    expect(result.config.sites["https://www.project.example.com"]).toEqual(two);
    expect(result.config.sites["http://www.localhost:4321"]).toBeUndefined();
  });

  test("is idempotent", () => {
    const site = { name: "Example", toEmail: "info@example.com" };
    const result = reconcileWwwOrigins({
      smtp: {},
      sites: {
        "https://example.com": site,
        "https://www.example.com": site,
      },
    });
    expect(result.added).toEqual([]);
  });
});
