import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { FUEL_STATUS_LABELS, isFuelStatus, type FuelStatus } from "../types/fuel.js";
import { getVehicleByPlateNumber } from "./vehicles.js";

type FuelInput = {
  vehiclePlateNumber?: string;
  tripId?: string | null;
  fuelType?: string;
  liters?: string | number;
  unitPrice?: string | number;
  refueledAt?: string;
  odometerKm?: string | number | null;
  notes?: string | null;
  status?: string;
};

type FuelSortField = "refueledAt" | "vehiclePlateNumber" | "tripId" | "fuelType" | "liters" | "totalCost" | "status";

interface FuelRecord {
  id: string;
  vehiclePlateNumber: string;
  tripId: string | null;
  fuelType: string;
  liters: number;
  unitPrice: number;
  totalCost: number;
  refueledAt: Date;
  odometerKm: number | null;
  notes: string | null;
  status: FuelStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidatedFuelPayload {
  vehiclePlateNumber: string;
  tripId: string | null;
  fuelType: string;
  liters: number;
  unitPrice: number;
  refueledAt: Date;
  odometerKm: number | null;
  notes: string | null;
  status: FuelStatus;
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

function serializeFuel(record: FuelRecord, tripLookup: Map<string, { id: string; source: string; destination: string; status: string }> ) {
  const vehicle = getVehicleByPlateNumber(record.vehiclePlateNumber);
  const trip = record.tripId ? tripLookup.get(record.tripId) ?? null : null;

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
    tripId: record.tripId,
    trip,
    fuelType: record.fuelType,
    liters: record.liters,
    unitPrice: record.unitPrice,
    totalCost: record.totalCost,
    refueledAt: formatDateOnly(record.refueledAt),
    odometerKm: record.odometerKm,
    notes: record.notes,
    status: record.status,
    statusLabel: FUEL_STATUS_LABELS[record.status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildSummary(records: FuelRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      summary.totalLiters += record.liters;
      summary.totalCost += record.totalCost;
      summary.recorded += record.status === "RECORDED" ? 1 : 0;
      summary.voided += record.status === "VOIDED" ? 1 : 0;
      return summary;
    },
    { total: 0, totalLiters: 0, totalCost: 0, recorded: 0, voided: 0 }
  );
}

function sortFuel(records: FuelRecord[], sortBy: FuelSortField, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    let result = 0;
    switch (sortBy) {
      case "refueledAt":
        result = left.refueledAt.getTime() - right.refueledAt.getTime();
        break;
      case "vehiclePlateNumber":
        result = compareText(left.vehiclePlateNumber, right.vehiclePlateNumber);
        break;
      case "tripId":
        result = compareText(left.tripId, right.tripId);
        break;
      case "fuelType":
        result = compareText(left.fuelType, right.fuelType);
        break;
      case "liters":
        result = left.liters - right.liters;
        break;
      case "totalCost":
        result = left.totalCost - right.totalCost;
        break;
      case "status":
        result = compareText(left.status, right.status);
        break;
    }

    if (result === 0) result = left.refueledAt.getTime() - right.refueledAt.getTime();
    return result * direction;
  });
}

function validatePayload(payload: FuelInput): { error: string } | { data: ValidatedFuelPayload } {
  const vehiclePlateNumber = normalizeText(payload.vehiclePlateNumber).toUpperCase();
  const tripId = normalizeText(payload.tripId);
  const fuelType = normalizeText(payload.fuelType);
  const notes = normalizeText(payload.notes);
  const liters = parseNumber(payload.liters);
  const unitPrice = parseNumber(payload.unitPrice);
  const odometerKm = parseNumber(payload.odometerKm ?? undefined);
  const status = normalizeText(payload.status);

  if (!vehiclePlateNumber) return { error: "Vehicle is required" };
  if (!fuelType || fuelType.length < 2) return { error: "Fuel type is required" };
  if (!payload.refueledAt) return { error: "Refueled date is required" };
  if (!Number.isFinite(liters) || liters <= 0) return { error: "Liters must be greater than zero" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Unit price must be zero or greater" };
  if (payload.odometerKm !== null && payload.odometerKm !== undefined && payload.odometerKm !== "" && (!Number.isFinite(odometerKm) || odometerKm < 0)) {
    return { error: "Odometer must be zero or greater" };
  }
  if (!status || !isFuelStatus(status)) return { error: "Status must be Recorded or Voided" };

  const refueledAt = new Date(payload.refueledAt);
  if (Number.isNaN(refueledAt.getTime())) return { error: "Refueled date is invalid" };

  return {
    data: {
      vehiclePlateNumber,
      tripId: tripId || null,
      fuelType,
      liters,
      unitPrice,
      refueledAt,
      odometerKm: Number.isFinite(odometerKm) ? odometerKm : null,
      notes: notes || null,
      status,
    },
  };
}

async function loadFuel(id: string) {
  return prisma.fuelRecord.findUnique({ where: { id } });
}

async function loadTripLookup(records: FuelRecord[]) {
  const tripIds = records.map((record) => record.tripId).filter((tripId): tripId is string => Boolean(tripId));
  if (tripIds.length === 0) return new Map<string, { id: string; source: string; destination: string; status: string }>();

  const trips = await prisma.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, source: true, destination: true, status: true } });
  return new Map(trips.map((trip) => [trip.id, trip]));
}

router.use(requireAuth, requireRoles("FLEET_MANAGER", "FINANCIAL_ANALYST"));

router.get("/", async (req: AuthenticatedRequest, res) => {
  const search = normalizeText(getQueryParam(req.query.search as string | undefined)).toLowerCase();
  const statusFilter = normalizeText(getQueryParam(req.query.status as string | undefined));
  const sortBy = (normalizeText(getQueryParam(req.query.sortBy as string | undefined)) || "refueledAt") as FuelSortField;
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const records = (await prisma.fuelRecord.findMany({ orderBy: { createdAt: "desc" } })) as FuelRecord[];
  const filtered = records.filter((record) => {
    const matchesStatus = !statusFilter || statusFilter === "all" || record.status === statusFilter;
    const matchesSearch =
      !search ||
      [record.vehiclePlateNumber, record.tripId ?? "", record.fuelType, record.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search);
    return matchesStatus && matchesSearch;
  });

  const tripLookup = await loadTripLookup(filtered);

  res.json({
    fuel: sortFuel(filtered, sortBy, sortOrder).map((record) => serializeFuel(record, tripLookup)),
    summary: buildSummary(filtered),
  });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = validatePayload(req.body as FuelInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const vehicle = getVehicleByPlateNumber(parsed.data.vehiclePlateNumber);
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (vehicle.lifecycleStatus === "RETIRED") {
    res.status(409).json({ error: "Retired vehicles cannot be refueled" });
    return;
  }

  if (parsed.data.tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: parsed.data.tripId }, select: { id: true, vehiclePlateNumber: true } });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    if (trip.vehiclePlateNumber !== parsed.data.vehiclePlateNumber) {
      res.status(409).json({ error: "Fuel record trip must match the selected vehicle" });
      return;
    }
  }

  const created = await prisma.fuelRecord.create({
    data: {
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      tripId: parsed.data.tripId || null,
      fuelType: parsed.data.fuelType,
      liters: parsed.data.liters,
      unitPrice: parsed.data.unitPrice,
      totalCost: parsed.data.liters * parsed.data.unitPrice,
      refueledAt: parsed.data.refueledAt,
      odometerKm: parsed.data.odometerKm,
      notes: parsed.data.notes,
      status: parsed.data.status,
    },
  });

  const tripLookup = await loadTripLookup([created as FuelRecord]);
  res.status(201).json({ fuel: serializeFuel(created as FuelRecord, tripLookup) });
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  const fuelId = getQueryParam(req.params.id);
  if (!fuelId) {
    res.status(400).json({ error: "Fuel id is required" });
    return;
  }

  const existing = await loadFuel(fuelId);
  if (!existing) {
    res.status(404).json({ error: "Fuel record not found" });
    return;
  }

  const parsed = validatePayload(req.body as FuelInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const vehicle = getVehicleByPlateNumber(parsed.data.vehiclePlateNumber);
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (parsed.data.tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: parsed.data.tripId }, select: { id: true, vehiclePlateNumber: true } });
    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    if (trip.vehiclePlateNumber !== parsed.data.vehiclePlateNumber) {
      res.status(409).json({ error: "Fuel record trip must match the selected vehicle" });
      return;
    }
  }

  const updated = await prisma.fuelRecord.update({
    where: { id: fuelId },
    data: {
      vehiclePlateNumber: parsed.data.vehiclePlateNumber,
      tripId: parsed.data.tripId || null,
      fuelType: parsed.data.fuelType,
      liters: parsed.data.liters,
      unitPrice: parsed.data.unitPrice,
      totalCost: parsed.data.liters * parsed.data.unitPrice,
      refueledAt: parsed.data.refueledAt,
      odometerKm: parsed.data.odometerKm,
      notes: parsed.data.notes,
      status: parsed.data.status,
    },
  });

  const tripLookup = await loadTripLookup([updated as FuelRecord]);
  res.json({ fuel: serializeFuel(updated as FuelRecord, tripLookup) });
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const fuelId = getQueryParam(req.params.id);
  if (!fuelId) {
    res.status(400).json({ error: "Fuel id is required" });
    return;
  }

  const existing = await loadFuel(fuelId);
  if (!existing) {
    res.status(404).json({ error: "Fuel record not found" });
    return;
  }

  await prisma.fuelRecord.delete({ where: { id: fuelId } });
  res.json({ message: "Fuel record deleted" });
});

export default router;