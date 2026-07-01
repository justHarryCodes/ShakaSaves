import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) return { valid: false, reason: "Password must be at least 8 characters" };
  if (password.length > 128) return { valid: false, reason: "Password is too long" };
  if (!/[A-Z]/.test(password)) return { valid: false, reason: "Password must contain at least one uppercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, reason: "Password must contain at least one number" };
  return { valid: true };
}

export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}
