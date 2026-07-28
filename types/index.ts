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
  | "card_request"
  | "migration_approved"
  | "migration_rejected"
  | "system";

export interface Customer {
  id: string;
  uid: string;
  fullName: string;
  email?: string;
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

// Per-card breakdown inside a multi-card payment submission
export interface CardAllocation {
  cardId: string;
  cardName: string;
  amount: number;
  daysToMark: number;      // calculated: floor(amount / card.dailyAmount)
  daysOverride: number | null; // admin can override before confirming
}

export interface PaymentSubmission {
  id: string;
  customerId: string;
  customerName: string;
  // ── New multi-card fields ──
  totalAmount?: number;
  cardAllocations?: CardAllocation[];
  // ── Legacy single-card fields (kept for old submissions) ──
  amount?: number;
  periodsCount?: number;
  periods?: string[];
  frequency?: ContributionFrequency;
  proofImageUrl?: string;
  proofPublicId?: string;
  // ── Common ──
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
  // New fields (present on multi-card contributions)
  cardId?: string;
  cardName?: string;
  periodsMarked?: string[]; // all dates marked in this confirmation
  daysMarked?: number;
  // Legacy fields
  period?: string;
  frequency?: ContributionFrequency;
  // Common
  submissionId: string;
  amount: number;
  confirmedAt: Timestamp;
  confirmedBy: string;
  deletedAt: Timestamp | null;
}

export interface SavingsCard {
  id: string;
  customerId: string;
  customerName: string;
  // ── New multi-card fields ──
  cardName?: string;       // user-given name for the card
  dailyAmount?: number;    // per-day contribution for this card
  createdAt?: Timestamp;
  // ── Legacy single-card fields ──
  contributionAmount?: number;
  frequency?: ContributionFrequency;
  monthlyTarget?: number;
  cycleYear?: number;
  cycleMonth?: number;
  totalSlots?: number;
  cardImageUrl?: string;
  cardPublicId?: string;
  // ── Common ──
  tickedPeriods: string[]; // "YYYY-MM-DD" dates
  currentBalance: number;
  updatedAt: Timestamp;
  // ── Card category (savings plan name: "Regular", "FoodBank", "Project 1M", etc.) ──
  category?: string;
  // ── Migration metadata (only present on imported cards) ──
  migrated?: boolean;
  migrationCode?: string;
  migrationDailyMarking?: number;
  migrationTotalSavings?: number;
  migrationAmountWtd?: number;
}

export interface CardRequest {
  id: string;
  customerId: string;
  customerName: string;
  cardName: string;
  dailyAmount: number;
  firstPaymentAmount: number;
  daysToMark: number;
  proofImageUrl: string;
  proofPublicId: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  cardId: string | null;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Plan selection (absent → Regular / global account)
  planId?: string;
  planName?: string;   // savings plan name = category (e.g. "FoodBank")
  // When to start marking periods (chosen by user at request time)
  startFrom?: "today" | "january";
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

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface SavingsPlan {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  // Withdrawal condition — at most one should be set
  lockDays?: number;      // card locked for N days after creation (e.g. 365 for FoodBank)
  targetAmount?: number;  // card locked until currentBalance >= this amount (e.g. 1_000_000 for Project 1M)
  // Dedicated bank account for this plan (Regular uses global admin_settings accounts)
  bankAccount?: { bankName: string; accountNumber: string; accountName: string };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

export interface ContributionUpdateRequest {
  id: string;
  customerId: string;
  customerName: string;
  currentAmount: number;
  requestedAmount: number;
  status: "pending" | "approved" | "rejected";
  requestedAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export interface MigrationSubAccount {
  category: "Regular" | "FoodBank" | "Project 1M";
  customerName: string;
  dailyMarking: number;
  totalSavings: number;
  amountWtd: number;
  cardBal: number;
  adminCommission: number;
}

export interface MigrationImportRequest {
  id: string;
  migrationCode: string;
  customerId: string;
  customerName: string;
  uid: string;
  subAccounts: MigrationSubAccount[];
  status: "pending" | "approved" | "rejected";
  submittedAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export interface AdminSettings {
  accounts: BankAccount[];
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
