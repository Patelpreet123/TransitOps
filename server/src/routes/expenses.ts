import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { EXPENSE_CATEGORIES, EXPENSE_STATUS_LABELS, isExpenseCategory, isExpenseStatus, type ExpenseStatus } from "../types/expenses.js";
import { getVehicleByPlateNumber } from "./vehicles.js";

type ExpenseInput = {
  title?: string;
  category?: string;
  amount?: string | number;
  expenseDate?: string;
  vendor?: string | null;
  paymentMethod?: string;
  vehiclePlateNumber?: string | null;
  tripId?: string | null;
  notes?: string | null;
  status?: string;
};

type ExpenseSortField = "expenseDate" | "amount" | "status" | "category" | "title" | "paymentMethod";

interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: Date;
  vendor: string | null;
  paymentMethod: string;
  vehiclePlateNumber: string | null;
  tripId: string | null;
  notes: string | null;
  status: ExpenseStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidatedExpensePayload {
  title: string;
  category: string;
  amount: number;
  expenseDate: Date;
  vendor: string | null;
  paymentMethod: string;
  vehiclePlateNumber: string | null;
  tripId: string | null;
  notes: string | null;
  status: ExpenseStatus;
}

const router = Router();

function normalizeText(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return NaN;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function compareText(left: string | number | null | undefined, right: string | number | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function serializeExpense(record: ExpenseRecord, tripLookup: Map<string, { id: string; source: string; destination: string; status: string }>) {
  const vehicle = record.vehiclePlateNumber ? getVehicleByPlateNumber(record.vehiclePlateNumber) : null;
  const trip = record.tripId ? tripLookup.get(record.tripId) ?? null : null;

  return {
    id: record.id,
    title: record.title,
    category: record.category,
    amount: record.amount,
    expenseDate: formatDateOnly(record.expenseDate),
    vendor: record.vendor,
    paymentMethod: record.paymentMethod,
    vehiclePlateNumber: record.vehiclePlateNumber,
    vehicle: vehicle
      ? {
          plateNumber: vehicle.plateNumber,
          model: vehicle.model,
          depot: vehicle.depot,
          capacityKg: vehicle.capacityKg,
          lifecycleStatus: vehicle.lifecycleStatus,
        }
      : null,
    tripId: record.tripId,
    trip,
    notes: record.notes,
    status: record.status,
    statusLabel: EXPENSE_STATUS_LABELS[record.status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildSummary(records: ExpenseRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      summary.totalAmount += record.amount;
      if (record.status === "PENDING") summary.pending += 1;
      if (record.status === "APPROVED") summary.approved += 1;
      if (record.status === "PAID") summary.paid += 1;
      if (record.status === "REJECTED") summary.rejected += 1;
      return summary;
    },
    { total: 0, totalAmount: 0, pending: 0, approved: 0, paid: 0, rejected: 0 }
  );
}

function sortExpenses(records: ExpenseRecord[], sortBy: ExpenseSortField, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    let result = 0;
    switch (sortBy) {
      case "expenseDate":
        result = left.expenseDate.getTime() - right.expenseDate.getTime();
        break;
      case "amount":
        result = left.amount - right.amount;
        break;
      case "status":
        result = compareText(left.status, right.status);
        break;
      case "category":
        result = compareText(left.category, right.category);
        break;
      case "title":
        result = compareText(left.title, right.title);
        break;
      case "paymentMethod":
        result = compareText(left.paymentMethod, right.paymentMethod);
        break;
    }

    if (result === 0) result = left.expenseDate.getTime() - right.expenseDate.getTime();
    return result * direction;
  });
}

function validatePayload(payload: ExpenseInput): { error: string } | { data: ValidatedExpensePayload } {
  const title = normalizeText(payload.title);
  const category = normalizeText(payload.category);
  const vendor = normalizeText(payload.vendor);
  const paymentMethod = normalizeText(payload.paymentMethod);
  const vehiclePlateNumber = normalizeText(payload.vehiclePlateNumber).toUpperCase();
  const tripId = normalizeText(payload.tripId);
  const notes = normalizeText(payload.notes);
  const amount = parseNumber(payload.amount);
  const status = normalizeText(payload.status);

  if (!title || title.length < 3) return { error: "Title is required" };
  if (!category || !isExpenseCategory(category)) return { error: `Category must be one of: ${EXPENSE_CATEGORIES.join(", ")}` };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be greater than zero" };
  if (!payload.expenseDate) return { error: "Expense date is required" };
  if (!paymentMethod || paymentMethod.length < 2) return { error: "Payment method is required" };
  if (!status || !isExpenseStatus(status)) return { error: "Status must be Pending, Approved, Paid, or Rejected" };

  const expenseDate = new Date(payload.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) return { error: "Expense date is invalid" };

  if (vehiclePlateNumber) {
    const vehicle = getVehicleByPlateNumber(vehiclePlateNumber);
    if (!vehicle) return { error: "Vehicle not found" };
  }

  return {
    data: {
      title,
      category,
      amount,
      expenseDate,
      vendor: vendor || null,
      paymentMethod,
      vehiclePlateNumber: vehiclePlateNumber || null,
      tripId: tripId || null,
      notes: notes || null,
      status,
    },
  };
}

async function loadExpense(id: string) {
  return prisma.expenseRecord.findUnique({ where: { id } });
}

async function loadTripLookup(records: ExpenseRecord[]) {
  const tripIds = records.map((record) => record.tripId).filter((tripId): tripId is string => Boolean(tripId));
  if (tripIds.length === 0) return new Map<string, { id: string; source: string; destination: string; status: string }>();

  const trips = await prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, source: true, destination: true, status: true } });
  return new Map(trips.map((trip) => [trip.id, trip]));
}

router.use(requireAuth, requireRoles("FLEET_MANAGER", "FINANCIAL_ANALYST"));

router.get("/", async (req: AuthenticatedRequest, res) => {
  const search = normalizeText(getQueryParam(req.query.search as string | undefined)).toLowerCase();
  const statusFilter = normalizeText(getQueryParam(req.query.status as string | undefined));
  const sortBy = (normalizeText(getQueryParam(req.query.sortBy as string | undefined)) || "expenseDate") as ExpenseSortField;
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const records = (await prisma.expenseRecord.findMany({ orderBy: { createdAt: "desc" } })) as ExpenseRecord[];
  const filtered = records.filter((record) => {
    const matchesStatus = !statusFilter || statusFilter === "all" || record.status === statusFilter;
    const matchesSearch =
      !search ||
      [record.title, record.category, record.vendor ?? "", record.paymentMethod, record.vehiclePlateNumber ?? "", record.tripId ?? "", record.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search);
    return matchesStatus && matchesSearch;
  });

  const tripLookup = await loadTripLookup(filtered);

  res.json({
    expenses: sortExpenses(filtered, sortBy, sortOrder).map((record) => serializeExpense(record, tripLookup)),
    summary: buildSummary(filtered),
  });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = validatePayload(req.body as ExpenseInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (parsed.data.tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: parsed.data.tripId }, select: { id: true, vehiclePlateNumber: true } });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    if (parsed.data.vehiclePlateNumber && trip.vehiclePlateNumber !== parsed.data.vehiclePlateNumber) {
      res.status(409).json({ error: "Expense trip must match the selected vehicle" });
      return;
    }
  }

  const created = await prisma.expenseRecord.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      expenseDate: parsed.data.expenseDate,
      vendor: parsed.data.vendor,
      paymentMethod: parsed.data.paymentMethod,
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      tripId: parsed.data.tripId,
      notes: parsed.data.notes,
      status: parsed.data.status,
    },
  });

  const tripLookup = await loadTripLookup([created as ExpenseRecord]);
  res.status(201).json({ expense: serializeExpense(created as ExpenseRecord, tripLookup) });
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  const expenseId = getQueryParam(req.params.id);
  if (!expenseId) {
    res.status(400).json({ error: "Expense id is required" });
    return;
  }

  const existing = await loadExpense(expenseId);
  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const parsed = validatePayload(req.body as ExpenseInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (parsed.data.tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: parsed.data.tripId }, select: { id: true, vehiclePlateNumber: true } });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    if (parsed.data.vehiclePlateNumber && trip.vehiclePlateNumber !== parsed.data.vehiclePlateNumber) {
      res.status(409).json({ error: "Expense trip must match the selected vehicle" });
      return;
    }
  }

  const updated = await prisma.expenseRecord.update({
    where: { id: expenseId },
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      expenseDate: parsed.data.expenseDate,
      vendor: parsed.data.vendor,
      paymentMethod: parsed.data.paymentMethod,
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      tripId: parsed.data.tripId,
      notes: parsed.data.notes,
      status: parsed.data.status,
    },
  });

  const tripLookup = await loadTripLookup([updated as ExpenseRecord]);
  res.json({ expense: serializeExpense(updated as ExpenseRecord, tripLookup) });
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const expenseId = getQueryParam(req.params.id);
  if (!expenseId) {
    res.status(400).json({ error: "Expense id is required" });
    return;
  }

  const existing = await loadExpense(expenseId);
  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  await prisma.expenseRecord.delete({ where: { id: expenseId } });
  res.json({ message: "Expense deleted" });
});

export default router;