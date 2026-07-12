export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  REJECTED: "Rejected",
};

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Tolls",
  "Parking",
  "Repairs",
  "Meals",
  "Permits",
  "Insurance",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseStatus(value: string): value is ExpenseStatus {
  return EXPENSE_STATUSES.includes(value as ExpenseStatus);
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}