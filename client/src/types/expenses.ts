import type { ExpenseRecord, ExpenseSummary } from "../lib/api";

export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export const EXPENSE_CATEGORIES = ["Fuel", "Tolls", "Parking", "Repairs", "Meals", "Permits", "Insurance", "Other"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpensePayload {
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  expenseDate: string;
  vendor: string | null;
  paymentMethod: string;
  vehiclePlateNumber: string | null;
  tripId: string | null;
  notes: string | null;
  status: ExpenseStatus;
}

export interface ExpensesResponse {
  expenses: ExpenseRecord[];
  summary: ExpenseSummary;
}