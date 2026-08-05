import { z } from "zod";

/** Strict email: local@domain.tld, no spaces, requires the @ and a real TLD. */
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
/** Phone: optional leading +, 7-15 digits, spaces/dashes/parentheses allowed as separators. */
export const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,20}$/;

export function digitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export const emailSchema = z
  .string()
  .trim()
  .max(255)
  .regex(EMAIL_RE, "Enter a valid email address, e.g. you@example.com");

export const optionalEmailSchema = z.union([z.literal(""), emailSchema]);

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_RE, "Enter a valid phone number, e.g. +977 9812345678")
  .refine((value) => {
    const digits = digitCount(value);
    return digits >= 7 && digits <= 15;
  }, "Phone number must contain between 7 and 15 digits");

/** Returns an error message for a phone field, or null when valid. */
export function phoneError(value: string) {
  const result = phoneSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid phone number");
}

/** Returns an error message for an email field, or null when valid. Empty is allowed when optional. */
export function emailError(value: string, optional = false) {
  if (optional && value.trim() === "") return null;
  const result = emailSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid email address");
}
