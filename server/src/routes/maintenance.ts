import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { MAINTENANCE_STATUS_LABELS, isMaintenanceStatus, type MaintenanceStatus } from "../types/maintenance.js";
import { getVehicleByPlateNumber, setVehicleMaintenanceState, updateVehicleByPlateNumber } from "./vehicles.js";

type MaintenanceInput = {
  vehiclePlateNumber?: string;
  serviceType?: string;
  scheduledDate?: string;
  completionDate?: string | null;
  cost?: string | number;
  notes?: string | null;
  status?: string;
};

type MaintenanceSortField = "scheduledDate" | "completionDate" | "cost" | "status" | "vehiclePlateNumber" | "serviceType";

interface MaintenanceRecord {
  id: string;
  vehiclePlateNumber: string;
  serviceType: string;
  scheduledDate: Date;
  completionDate: Date | null;
  cost: number;
  notes: string | null;
  status: MaintenanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidatedMaintenancePayload {
  vehiclePlateNumber: string;
  serviceType: string;
  scheduledDate: Date;
  completionDate: Date | null;
  cost: number;
  notes: string | null;
  status: MaintenanceStatus;
}

const router = Router();

function normalizeText(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | number | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function compareText(left: string | number | null | undefined, right: string | number | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function serializeMaintenance(record: MaintenanceRecord) {
  const vehicle = getVehicleByPlateNumber(record.vehiclePlateNumber);
  return {
    id: record.id,
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
    serviceType: record.serviceType,
    scheduledDate: formatDateOnly(record.scheduledDate),
    completionDate: record.completionDate ? formatDateOnly(record.completionDate) : null,
    cost: record.cost,
    notes: record.notes,
    status: record.status,
    statusLabel: MAINTENANCE_STATUS_LABELS[record.status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildSummary(records: MaintenanceRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === "SCHEDULED") summary.scheduled += 1;
      if (record.status === "IN_PROGRESS") summary.inProgress += 1;
      if (record.status === "COMPLETED") summary.completed += 1;
      if (record.status === "CANCELLED") summary.cancelled += 1;
      summary.totalCost += record.cost;
      return summary;
    },
    { total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, totalCost: 0 }
  );
}

function sortMaintenance(records: MaintenanceRecord[], sortBy: MaintenanceSortField, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    let result = 0;

    switch (sortBy) {
      case "scheduledDate":
        result = left.scheduledDate.getTime() - right.scheduledDate.getTime();
        break;
      case "completionDate":
        result = (left.completionDate?.getTime() ?? 0) - (right.completionDate?.getTime() ?? 0);
        break;
      case "cost":
        result = left.cost - right.cost;
        break;
      case "status":
        result = compareText(left.status, right.status);
        break;
      case "vehiclePlateNumber":
        result = compareText(left.vehiclePlateNumber, right.vehiclePlateNumber);
        break;
      case "serviceType":
        result = compareText(left.serviceType, right.serviceType);
        break;
    }

    if (result === 0) {
      result = left.scheduledDate.getTime() - right.scheduledDate.getTime();
    }

    return result * direction;
  });
}

function validatePayload(payload: MaintenanceInput): { error: string } | { data: ValidatedMaintenancePayload } {
  const vehiclePlateNumber = normalizeText(payload.vehiclePlateNumber).toUpperCase();
  const serviceType = normalizeText(payload.serviceType);
  const notes = normalizeText(payload.notes);
  const cost = parseNumber(payload.cost);
  const status = normalizeText(payload.status);

  if (!vehiclePlateNumber) return { error: "Vehicle is required" };
  if (!serviceType || serviceType.length < 2) return { error: "Service type is required" };
  if (!payload.scheduledDate) return { error: "Scheduled date is required" };
  if (!Number.isFinite(cost) || cost < 0) return { error: "Cost must be zero or greater" };
  if (!status || !isMaintenanceStatus(status)) return { error: "Status must be Scheduled, In Progress, Completed, or Cancelled" };

  const scheduledDate = new Date(payload.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) return { error: "Scheduled date is invalid" };

  let completionDate: Date | null = null;
  if (payload.completionDate) {
    completionDate = new Date(payload.completionDate);
    if (Number.isNaN(completionDate.getTime())) return { error: "Completion date is invalid" };
  }

  if (status === "COMPLETED" && !completionDate) {
    return { error: "Completion date is required when maintenance is completed" };
  }

  if (completionDate && completionDate.getTime() < scheduledDate.getTime()) {
    return { error: "Completion date must be on or after scheduled date" };
  }

  return { data: { vehiclePlateNumber, serviceType, scheduledDate, completionDate, cost, notes: notes || null, status } };
}

async function recalculateVehicleState(vehiclePlateNumber: string) {
  const activeMaintenance = await prisma.maintenanceRecord.findFirst({
    where: {
      vehiclePlateNumber,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
  });

  if (activeMaintenance) {
    setVehicleMaintenanceState(vehiclePlateNumber, true);
    return;
  }

  const vehicle = getVehicleByPlateNumber(vehiclePlateNumber);
  if (vehicle && vehicle.lifecycleStatus !== "RETIRED") {
    updateVehicleByPlateNumber(vehiclePlateNumber, {
      lifecycleStatus: "ACTIVE",
      status: vehicle.assignedDriver ? "assigned" : "available",
    });
  }
}

async function loadMaintenance(id: string) {
  return prisma.maintenanceRecord.findUnique({ where: { id } });
}

router.use(requireAuth, requireRoles("FLEET_MANAGER"));

router.get("/", async (req: AuthenticatedRequest, res) => {
  const search = normalizeText(getQueryParam(req.query.search as string | undefined));
  const statusFilter = normalizeText(getQueryParam(req.query.status as string | undefined));
  const sortBy = (normalizeText(getQueryParam(req.query.sortBy as string | undefined)) || "scheduledDate") as MaintenanceSortField;
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const records = await prisma.maintenanceRecord.findMany({ orderBy: { createdAt: "desc" } });

  const filtered = records.filter((record) => {
    const matchesStatus = !statusFilter || statusFilter === "all" || record.status === statusFilter;
    const matchesSearch =
      !search ||
      [record.vehiclePlateNumber, record.serviceType, record.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

    return matchesStatus && matchesSearch;
  }) as MaintenanceRecord[];

  res.json({
    maintenance: sortMaintenance(filtered, sortBy, sortOrder).map(serializeMaintenance),
    summary: buildSummary(filtered),
  });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = validatePayload(req.body as MaintenanceInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const vehicle = getVehicleByPlateNumber(parsed.data.vehiclePlateNumber);
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  const existingActive = await prisma.maintenanceRecord.findFirst({
    where: {
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
  });

  if (existingActive && parsed.data.status !== "CANCELLED") {
    res.status(409).json({ error: "Vehicle already has active maintenance" });
    return;
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceRecord.create({
      data: {
        vehiclePlateNumber: parsed.data.vehiclePlateNumber,
        serviceType: parsed.data.serviceType,
        scheduledDate: parsed.data.scheduledDate,
        completionDate: parsed.data.completionDate,
        cost: parsed.data.cost,
        notes: parsed.data.notes,
        status: parsed.data.status,
      },
    });

    if (parsed.data.status === "SCHEDULED" || parsed.data.status === "IN_PROGRESS") {
      setVehicleMaintenanceState(parsed.data.vehiclePlateNumber, true);
    }

    if (parsed.data.status === "COMPLETED") {
      await recalculateVehicleState(parsed.data.vehiclePlateNumber);
    }

    return created;
  });

  const created = await loadMaintenance(record.id);
  res.status(201).json({ maintenance: serializeMaintenance(created as MaintenanceRecord) });
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  const maintenanceId = getQueryParam(req.params.id);
  if (!maintenanceId) {
    res.status(400).json({ error: "Maintenance id is required" });
    return;
  }

  const existing = await loadMaintenance(maintenanceId);
  if (!existing) {
    res.status(404).json({ error: "Maintenance not found" });
    return;
  }

  const parsed = validatePayload(req.body as MaintenanceInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (parsed.data.vehiclePlateNumber !== existing.vehiclePlateNumber) {
    const vehicle = getVehicleByPlateNumber(parsed.data.vehiclePlateNumber);
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
  }

  const activeConflict = await prisma.maintenanceRecord.findFirst({
    where: {
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      id: { not: maintenanceId },
    },
  });

  if (activeConflict && parsed.data.status !== "CANCELLED") {
    res.status(409).json({ error: "Vehicle already has active maintenance" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.maintenanceRecord.update({
      where: { id: maintenanceId },
      data: {
        vehiclePlateNumber: parsed.data.vehiclePlateNumber,
        serviceType: parsed.data.serviceType,
        scheduledDate: parsed.data.scheduledDate,
        completionDate: parsed.data.completionDate,
        cost: parsed.data.cost,
        notes: parsed.data.notes,
        status: parsed.data.status,
      },
    });

    await recalculateVehicleState(existing.vehiclePlateNumber);
    if (existing.vehiclePlateNumber !== parsed.data.vehiclePlateNumber) {
      await recalculateVehicleState(parsed.data.vehiclePlateNumber);
    }

    if (parsed.data.status === "COMPLETED") {
      setVehicleMaintenanceState(parsed.data.vehiclePlateNumber, false);
    }

    return saved;
  });

  const record = await loadMaintenance(updated.id);
  res.json({ maintenance: serializeMaintenance(record as MaintenanceRecord) });
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const maintenanceId = getQueryParam(req.params.id);
  if (!maintenanceId) {
    res.status(400).json({ error: "Maintenance id is required" });
    return;
  }

  const existing = await loadMaintenance(maintenanceId);
  if (!existing) {
    res.status(404).json({ error: "Maintenance not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRecord.delete({ where: { id: maintenanceId } });
    await recalculateVehicleState(existing.vehiclePlateNumber);
  });

  res.json({ message: "Maintenance deleted" });
});

export default router;