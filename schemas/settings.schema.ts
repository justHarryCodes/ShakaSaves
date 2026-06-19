import { z } from "zod";

export const updateSettingsSchema = z.object({
  bankName: z.string().min(2).max(100),
  accountNumber: z.string().min(6).max(20),
  accountName: z.string().min(2).max(100),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
