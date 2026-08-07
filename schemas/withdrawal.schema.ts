import { z } from "zod";

const cardSelectionSchema = z.object({
  cardId: z.string().min(1),
  cardName: z.string().min(1).max(100),
  amountFromCard: z.number().positive(),
});

export const requestWithdrawalSchema = z.object({
  /** At least one card must be selected. amountRequested is derived server-side
   *  from the sum of amountFromCard — any client-sent value is ignored. */
  cardSelections: z.array(cardSelectionSchema).min(1, "Select at least one card"),
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
