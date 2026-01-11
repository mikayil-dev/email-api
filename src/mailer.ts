import nodemailer from "nodemailer";
import type { OriginConfig } from "./config";

export interface ContactFormData {
  email: string;
  name: string;
  message: string;
  phone?: string;
}

export async function sendContactEmail(
  data: ContactFormData,
  originConfig: OriginConfig,
): Promise<void> {
  const { email, name, message, phone } = data;
  const { toEmail, smtp } = originConfig;
  const originName = originConfig.name;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: `"${name}" <${smtp.user}>`,
    to: toEmail,
    subject: `[Contact|Kontakt] - ${originName} - ${name}`,
    text: `From: ${name} <${email}> ${phone ? `<${phone}>` : ""}\n\n${message}`,
    html: `
      <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)} ${phone ? `&lt;${escapeHtml(phone)}` : ""}&gt;</p>
      <hr>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `.trim(),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
