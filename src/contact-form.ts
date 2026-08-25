import type { ContactFormData } from "./mailer";

function isStringWithin(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum
  );
}

export function validateContactFormData(
  body: unknown,
): body is ContactFormData {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false;
  }
  const value = body as Record<string, unknown>;
  return (
    isStringWithin(value.email, 3, 320) &&
    value.email.includes("@") &&
    isStringWithin(value.name, 1, 160) &&
    isStringWithin(value.message, 1, 10_000) &&
    (value.phone === undefined || isStringWithin(value.phone, 0, 80)) &&
    (value.website === undefined || typeof value.website === "string")
  );
}
