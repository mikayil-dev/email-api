import { describe, expect, test } from "bun:test";

import { buildConfirmationEmail } from "./confirmation";

describe("buildConfirmationEmail", () => {
  test("names the site and the form host", () => {
    const mail = buildConfirmationEmail(
      "contact",
      "M. Vidovic Services",
      "https://vidovic-services.de",
    );
    expect(mail.subject).toBe(
      "Vielen Dank für Ihre Anfrage – M. Vidovic Services",
    );
    expect(mail.text).toContain("auf vidovic-services.de angegeben");
    expect(mail.text).toContain("Freundliche Grüße\nM. Vidovic Services");
  });

  test("feedback mail mentions how to revoke the consent", () => {
    const mail = buildConfirmationEmail(
      "feedback",
      "Example",
      "https://example.com",
    );
    expect(mail.subject).toStartWith("Vielen Dank für Ihr Feedback");
    expect(mail.text).toContain("jederzeit widerrufen");
  });

  test("escapes the site name in HTML", () => {
    const mail = buildConfirmationEmail("contact", "A & <B>", "https://a.de");
    expect(mail.html).toContain("A &amp; &lt;B&gt;");
    expect(mail.html).not.toContain("<B>");
  });
});
