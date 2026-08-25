import nodemailer from "nodemailer";

import type { Transporter } from "nodemailer";
import type { OriginConfig, SmtpConfig } from "./config";

export interface ContactFormData {
  email: string;
  name: string;
  message: string;
  phone?: string;
  website?: string;
}

const transports = new Map<string, Transporter>();

function transportKey(smtp: SmtpConfig): string {
  return `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.user}`;
}

function getTransport(smtp: SmtpConfig): Transporter {
  const key = transportKey(smtp);
  const existing = transports.get(key);
  if (existing) return existing;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  transports.set(key, transport);
  return transport;
}

export async function sendContactEmail(
  data: ContactFormData,
  originConfig: OriginConfig,
): Promise<void> {
  const { email, name, message, phone } = data;
  const { toEmail, smtp } = originConfig;
  const originName = originConfig.name;

  await getTransport(smtp).sendMail({
    from: { name: smtp.fromName, address: smtp.fromEmail },
    replyTo: { name, address: email },
    to: toEmail,
    subject: `[Contact] ${originName} — ${name}`,
    text: `From: ${name} <${email}>${phone ? ` <${phone}>` : ""}\n\nVia ${originName}\n\n${message}`,
    html: `
      <p><strong>From:</strong> ${escapeHtml(name)} — ${escapeHtml(email)}${phone ? ` — ${escapeHtml(phone)}` : ""}</p>
      <p><strong>Via:</strong> ${escapeHtml(originName)}</p>
      <hr>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `.trim(),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
