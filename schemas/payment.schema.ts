import { z } from "zod";

export const submitPaymentSchema = z.object({
  periods: z.array(z.string()).min(1, "Select at least one period"),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  note: z.string().max(500).optional().nullable(),
});

export const rejectPaymentSchema = z.object({
  rejectionReason: z.string().min(5).max(500),
});

export const paymentFilterSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected"]).optional(),
  customerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
