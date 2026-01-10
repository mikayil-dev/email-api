import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "./config";

const transporter: Transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export interface ContactFormData {
  email: string;
  name: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(data: ContactFormData): Promise<void> {
  const { email, name, subject, message } = data;

  await transporter.sendMail({
    from: `"${name}" <${config.smtp.user}>`,
    replyTo: email,
    to: config.toEmail,
    subject: `[Contact Form] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `
      <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
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
