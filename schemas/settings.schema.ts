import { z } from "zod";

export const bankAccountSchema = z.object({
  id: z.string().min(1),
  bankName: z.string().min(2).max(100),
  accountNumber: z.string().min(6).max(20),
  accountName: z.string().min(2).max(100),
});

export const updateSettingsSchema = z.object({
  accounts: z.array(bankAccountSchema).min(1, "At least one account is required"),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
