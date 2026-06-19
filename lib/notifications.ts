import { createNotification } from "@/lib/firestore/notifications";
import * as email from "@/lib/sendgrid";
import { FieldValue } from "firebase-admin/firestore";
import type { NotificationType, UserRole } from "@/types";

interface NotifyParams {
  recipientUid: string;
  recipientRole: UserRole;
  title: string;
  body: string;
  type: NotificationType;
  metadata?: Record<string, unknown>;
}

async function notify(params: NotifyParams): Promise<void> {
  await createNotification({
    recipientUid: params.recipientUid,
    recipientRole: params.recipientRole,
    title: params.title,
    body: params.body,
    type: params.type,
    read: false,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    metadata: params.metadata ?? {},
  });
}

export async function notifyPaymentSubmitted(opts: {
  adminUid: string;
  adminEmail: string;
  customerName: string;
  amount: number;
  periodsCount: number;
  submissionId: string;
  customerId: string;
}): Promise<void> {
  const body = `${opts.customerName} submitted ${formatNaira(opts.amount)} for ${opts.periodsCount} period(s) — review required`;
  await Promise.all([
    notify({
      recipientUid: opts.adminUid,
      recipientRole: "admin",
      title: "New payment submission",
      body,
      type: "payment_submitted",
      metadata: { submissionId: opts.submissionId, customerId: opts.customerId, amount: opts.amount },
    }),
    email.sendPaymentSubmittedToAdmin(opts.adminEmail, opts.customerName, opts.amount, opts.periodsCount),
  ]);
}

export async function notifyPaymentConfirmed(opts: {
  customerUid: string;
  customerEmail: string;
  amount: number;
  periodsCount: number;
  submissionId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: "Payment confirmed",
      body: `Your payment of ${formatNaira(opts.amount)} has been confirmed. ${opts.periodsCount} day(s) ticked.`,
      type: "payment_confirmed",
      metadata: { submissionId: opts.submissionId, amount: opts.amount },
    }),
    email.sendPaymentConfirmedToCustomer(opts.customerEmail, opts.amount, opts.periodsCount),
  ]);
}

export async function notifyPaymentRejected(opts: {
  customerUid: string;
  customerEmail: string;
  amount: number;
  reason: string;
  submissionId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: "Payment not confirmed",
      body: `Your payment of ${formatNaira(opts.amount)} was not confirmed. Reason: ${opts.reason}`,
      type: "payment_rejected",
      metadata: { submissionId: opts.submissionId, amount: opts.amount },
    }),
    email.sendPaymentRejectedToCustomer(opts.customerEmail, opts.amount, opts.reason),
  ]);
}

export async function notifyWithdrawalRequested(opts: {
  adminUid: string;
  adminEmail: string;
  customerName: string;
  amount: number;
  withdrawalId: string;
  customerId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.adminUid,
      recipientRole: "admin",
      title: "Withdrawal request",
      body: `${opts.customerName} requested a withdrawal of ${formatNaira(opts.amount)}`,
      type: "withdrawal_request",
      metadata: { withdrawalId: opts.withdrawalId, customerId: opts.customerId, amount: opts.amount },
    }),
    email.sendWithdrawalRequestToAdmin(opts.adminEmail, opts.customerName, opts.amount),
  ]);
}

export async function notifyWithdrawalApproved(opts: {
  customerUid: string;
  customerEmail: string;
  amount: number;
  withdrawalId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: "Withdrawal approved",
      body: `Your withdrawal of ${formatNaira(opts.amount)} has been approved.`,
      type: "withdrawal_approved",
      metadata: { withdrawalId: opts.withdrawalId, amount: opts.amount },
    }),
    email.sendWithdrawalApprovedToCustomer(opts.customerEmail, opts.amount),
  ]);
}

export async function notifyWithdrawalRejected(opts: {
  customerUid: string;
  customerEmail: string;
  amount: number;
  reason: string;
  withdrawalId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: "Withdrawal declined",
      body: `Your withdrawal request of ${formatNaira(opts.amount)} was declined. Reason: ${opts.reason}`,
      type: "withdrawal_rejected",
      metadata: { withdrawalId: opts.withdrawalId, amount: opts.amount },
    }),
    email.sendWithdrawalRejectedToCustomer(opts.customerEmail, opts.amount, opts.reason),
  ]);
}

export async function notifyWithdrawalPaid(opts: {
  customerUid: string;
  customerEmail: string;
  amount: number;
  withdrawalId: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: "Withdrawal paid",
      body: `Your ${formatNaira(opts.amount)} withdrawal has been paid out.`,
      type: "withdrawal_paid",
      metadata: { withdrawalId: opts.withdrawalId, amount: opts.amount },
    }),
    email.sendWithdrawalPaidToCustomer(opts.customerEmail, opts.amount),
  ]);
}

export async function notifyWelcome(opts: {
  customerUid: string;
  customerEmail: string;
  customerName: string;
}): Promise<void> {
  await Promise.all([
    notify({
      recipientUid: opts.customerUid,
      recipientRole: "customer",
      title: `Welcome to Shaka Saves!`,
      body: "Your savings account is ready. Start by making your first contribution.",
      type: "system",
    }),
    email.sendWelcomeEmail(opts.customerEmail, opts.customerName),
  ]);
}

function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}
