import { Timestamp } from "firebase-admin/firestore";

export type UserRole = "admin" | "customer";
export type ContributionFrequency = "daily" | "weekly" | "monthly";
export type PaymentStatus = "pending" | "confirmed" | "rejected";
export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";
export type NotificationType =
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_rejected"
  | "withdrawal_request"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "withdrawal_paid"
  | "system";

export interface Customer {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  monthlyTarget: number;
  minimumWithdrawalDays: number;
  currentBalance: number;
  pendingBalance: number;
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

export interface PaymentSubmission {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  periodsCount: number;
  periods: string[];
  frequency: ContributionFrequency;
  proofImageUrl: string;
  proofPublicId: string;
  status: PaymentStatus;
  submittedAt: Timestamp;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  rejectionReason: string | null;
  idempotencyKey: string;
  note: string | null;
}

export interface Contribution {
  id: string;
  customerId: string;
  submissionId: string;
  amount: number;
  period: string;
  frequency: ContributionFrequency;
  confirmedAt: Timestamp;
  confirmedBy: string;
  deletedAt: Timestamp | null;
}

export interface SavingsCard {
  id: string;
  customerId: string;
  customerName: string;
  contributionAmount: number;
  frequency: ContributionFrequency;
  monthlyTarget: number;
  cycleYear: number;
  cycleMonth: number;
  totalSlots: number;
  tickedPeriods: string[];
  currentBalance: number;
  cardImageUrl: string;
  cardPublicId: string;
  updatedAt: Timestamp;
}

export interface Withdrawal {
  id: string;
  customerId: string;
  amountRequested: number;
  requestedAt: Timestamp;
  status: WithdrawalStatus;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  rejectionReason: string | null;
  paidAt: Timestamp | null;
  note: string | null;
}

export interface Notification {
  id: string;
  recipientUid: string;
  recipientRole: UserRole;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: Timestamp;
  metadata: Record<string, unknown>;
}

export interface AdminSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  updatedAt: Timestamp;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  performedByRole: UserRole;
  targetId: string;
  targetCollection: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  timestamp: Timestamp;
  ipAddress: string;
}

export interface DecodedToken {
  uid: string;
  email?: string;
  role?: UserRole;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface CustomerListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  currentBalance: number;
  pendingBalance: number;
  status: "active" | "inactive";
  createdAt: Timestamp;
}
