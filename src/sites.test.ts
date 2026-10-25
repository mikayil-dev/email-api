import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { readManifestSites } from "./sites";

describe("readManifestSites", () => {
  test("adds static sites with a contact e-mail only", () => {
    const directory = mkdtempSync(join(tmpdir(), "sites-"));
    const write = (name: string, value: unknown): void =>
      writeFileSync(join(directory, name), JSON.stringify(value));
    write("a.de.json", {
      domain: "a.de",
      projectName: "A GmbH",
      contactEmail: "info@a.de",
      mode: "managed",
    });
    write("b.de.json", { domain: "b.de", contactEmail: null });
    write("app.de.json", {
      domain: "app.de",
      contactEmail: "x@app.de",
      mode: "app",
    });
    write("broken.json", "{");
    expect([...readManifestSites(directory)]).toEqual([
      ["https://a.de", { name: "A GmbH", toEmail: "info@a.de" }],
    ]);
  });

  test("returns nothing for a missing directory", () => {
    expect(readManifestSites("/nonexistent/sites").size).toBe(0);
  });
});
