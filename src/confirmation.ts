import type { ContactFormKind } from "./mailer";

export interface ConfirmationEmail {
  subject: string;
  text: string;
  html: string;
}

const intros: Record<ContactFormKind, { subject: string; body: string[] }> = {
  contact: {
    subject: "Vielen Dank für Ihre Anfrage",
    body: [
      "vielen Dank für Ihre Nachricht über unsere Website. Wir haben sie erhalten und melden uns so bald wie möglich bei Ihnen.",
      "Möchten Sie noch etwas ergänzen? Dann antworten Sie einfach auf diese E-Mail.",
    ],
  },
  feedback: {
    subject: "Vielen Dank für Ihr Feedback",
    body: [
      "vielen Dank, dass Sie sich die Zeit für Ihr Feedback genommen haben. Wir lesen jede Rückmeldung persönlich.",
      "Falls Sie einer Veröffentlichung als Referenz zugestimmt haben, stimmen wir den Text vorher mit Ihnen ab. Ihre Einwilligung können Sie jederzeit widerrufen; eine kurze Antwort auf diese E-Mail genügt.",
    ],
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Automatic reply to the address a visitor entered. It never repeats what the
 * visitor typed (not even the name), so the form cannot be used to send
 * arbitrary text to a third party.
 */
export function buildConfirmationEmail(
  kind: ContactFormKind,
  siteName: string,
  origin: string,
): ConfirmationEmail {
  const { subject, body } = intros[kind];
  const host = new URL(origin).host;
  const notice = `Diese E-Mail wurde automatisch versendet, weil Ihre Adresse in einem Formular auf ${host} angegeben wurde. Falls Sie das nicht waren, können Sie diese E-Mail ignorieren.`;
  const paragraphs = ["Guten Tag,", ...body, `Freundliche Grüße\n${siteName}`];

  return {
    subject: `${subject} – ${siteName}`,
    text: `${paragraphs.join("\n\n")}\n\n--\n${notice}\n`,
    html: [
      ...paragraphs.map(
        (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
      ),
      `<hr><p style="color:#777;font-size:12px">${escapeHtml(notice)}</p>`,
    ].join("\n"),
  };
}
