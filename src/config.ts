function getEnv(key: string, required = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: Number(getEnv("PORT")) || 3000,
  apiKey: getEnv("API_KEY", true),
  allowedOrigins: getEnv("ALLOWED_ORIGINS", true)
    ?.split(",")
    .map((o) => o.trim()),
  toEmail: getEnv("TO_EMAIL", true),

  smtp: {
    host: getEnv("SMTP_HOST", true),
    port: Number(getEnv("SMTP_PORT")) || 587,
    secure: getEnv("SMTP_SECURE") === "true",
    user: getEnv("SMTP_USER", true),
    pass: getEnv("SMTP_PASS", true),
  },
} as const;
