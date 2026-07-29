import { z } from "zod";

export const requestWithdrawalSchema = z.object({
  amountRequested: z.number().positive(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(100),
  bankName: z.string().min(1).max(100),
  note: z.string().max(500).optional().nullable(),
});

export const rejectWithdrawalSchema = z.object({
  rejectionReason: z.string().min(5).max(500),
});

export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;
