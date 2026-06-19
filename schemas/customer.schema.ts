import { z } from "zod";

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  contributionAmount: z.number().positive(),
  contributionFrequency: z.enum(["daily", "weekly", "monthly"]),
  monthlyTarget: z.number().positive(),
  minimumWithdrawalDays: z.number().int().min(1).default(30),
  password: z.string().min(8),
});

export const updateCustomerSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
  contributionAmount: z.number().positive().optional(),
  contributionFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  monthlyTarget: z.number().positive().optional(),
  minimumWithdrawalDays: z.number().int().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const registerCustomerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  contributionAmount: z.number().positive(),
  contributionFrequency: z.enum(["daily", "weekly", "monthly"]),
  monthlyTarget: z.number().positive(),
  minimumWithdrawalDays: z.number().int().min(1).default(30),
  password: z.string().min(8).optional(), // optional for Google sign-up
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
