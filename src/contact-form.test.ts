import { describe, expect, test } from "bun:test";

import { validateContactFormData } from "./contact-form";

describe("validateContactFormData", () => {
  test("accepts the legacy website payload with an empty optional phone", () => {
    expect(
      validateContactFormData({
        name: "Example Visitor",
        email: "visitor@example.com",
        phone: "",
        message: "Please contact me.",
        website: "",
        privacy: "on",
        subject: "Kontaktanfrage über Website",
      }),
    ).toBe(true);
  });

  test("still rejects missing required fields", () => {
    expect(
      validateContactFormData({
        name: "Example Visitor",
        email: "visitor@example.com",
        phone: "",
      }),
    ).toBe(false);
  });
});
