import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { DRIVER_STATUS_LABELS, type DriverStatus } from "../types/drivers.js";
import { TRIP_STATUS_LABELS, isTripStatus, type TripStatus } from "../types/trips.js";
import { getVehicleByPlateNumber, type VehicleLifecycleStatus } from "./vehicles.js";

type TripInput = {
  vehiclePlateNumber?: string;
  driverId?: string;
  source?: string;
  destination?: string;
  cargoDescription?: string;
  cargoWeightKg?: string | number;
  distanceKm?: string | number;
  startDate?: string;
  endDate?: string;
  status?: string;
};

type TripSortField = "startDate" | "endDate" | "status" | "source" | "destination" | "vehicle" | "driver" | "cargoWeightKg" | "distanceKm";

interface ValidatedTripPayload {
  vehiclePlateNumber: string;
  driverId: string;
  source: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: number;
  distanceKm: number;
  startDate: Date;
  endDate: Date;
  status: TripStatus;
}

interface DriverLookupResult {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: DriverStatus;
  assignedVehicle: string | null;
}

interface EnrichedTripPayload extends ValidatedTripPayload {
  vehicle: NonNullable<ReturnType<typeof getVehicleByPlateNumber>>;
  driver: DriverLookupResult;
}

interface TripRecord {
  id: string;
  vehiclePlateNumber: string;
  driverId: string;
  source: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: number;
  distanceKm: number;
  startDate: Date;
  endDate: Date;
  status: TripStatus;
  createdAt: Date;
  updatedAt: Date;
  driver: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    status: DriverStatus;
    assignedVehicle: string | null;
  };
}

const router = Router();

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function parseNumber(value: string | number | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function isFutureDate(value: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value.getTime() >= today.getTime();
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function compareText(left: string | number | null | undefined, right: string | number | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function serializeTrip(trip: TripRecord) {
  const vehicle = getVehicleByPlateNumber(trip.vehiclePlateNumber);

  return {
    id: trip.id,
    vehiclePlateNumber: trip.vehiclePlateNumber,
    vehicle: vehicle
      ? {
          plateNumber: vehicle.plateNumber,
          model: vehicle.model,
          depot: vehicle.depot,
          capacityKg: vehicle.capacityKg,
          lifecycleStatus: vehicle.lifecycleStatus,
        }
      : null,
    driver: {
      id: trip.driver.id,
      fullName: trip.driver.fullName,
      email: trip.driver.email,
      phone: trip.driver.phone,
      status: trip.driver.status,
      statusLabel: DRIVER_STATUS_LABELS[trip.driver.status],
      assignedVehicle: trip.driver.assignedVehicle,
    },
    source: trip.source,
    destination: trip.destination,
    cargoDescription: trip.cargoDescription,
    cargoWeightKg: trip.cargoWeightKg,
    distanceKm: trip.distanceKm,
    startDate: formatDateOnly(trip.startDate),
    endDate: formatDateOnly(trip.endDate),
    status: trip.status,
    statusLabel: TRIP_STATUS_LABELS[trip.status],
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

function buildSummary(trips: TripRecord[]) {
  return trips.reduce(
    (summary, trip) => {
      summary.total += 1;
      if (trip.status === "SCHEDULED") summary.scheduled += 1;
      if (trip.status === "ACTIVE") summary.active += 1;
      if (trip.status === "COMPLETED") summary.completed += 1;
      if (trip.status === "CANCELLED") summary.cancelled += 1;
      summary.totalCargoKg += trip.cargoWeightKg;
      summary.totalDistanceKm += trip.distanceKm;
      return summary;
    },
    {
      total: 0,
      scheduled: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      totalCargoKg: 0,
      totalDistanceKm: 0,
    }
  );
}

function sortTrips(trips: TripRecord[], sortBy: TripSortField, sortOrder: "asc" | "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...trips].sort((left, right) => {
    let result = 0;

    switch (sortBy) {
      case "startDate":
        result = left.startDate.getTime() - right.startDate.getTime();
        break;
      case "endDate":
        result = left.endDate.getTime() - right.endDate.getTime();
        break;
      case "status":
        result = compareText(left.status, right.status);
        break;
      case "source":
        result = compareText(left.source, right.source);
        break;
      case "destination":
        result = compareText(left.destination, right.destination);
        break;
      case "vehicle":
        result = compareText(left.vehiclePlateNumber, right.vehiclePlateNumber);
        break;
      case "driver":
        result = compareText(left.driver.fullName, right.driver.fullName);
        break;
      case "cargoWeightKg":
        result = left.cargoWeightKg - right.cargoWeightKg;
        break;
      case "distanceKm":
        result = left.distanceKm - right.distanceKm;
        break;
    }

    if (result === 0) {
      result = left.startDate.getTime() - right.startDate.getTime();
    }

    return result * direction;
  });
}

function validateBasicPayload(payload: TripInput): { error: string } | { data: ValidatedTripPayload } {
  const vehiclePlateNumber = normalizeText(payload.vehiclePlateNumber).toUpperCase();
  const driverId = normalizeText(payload.driverId);
  const source = normalizeText(payload.source);
  const destination = normalizeText(payload.destination);
  const cargoDescription = normalizeText(payload.cargoDescription);
  const cargoWeightKg = parseNumber(payload.cargoWeightKg);
  const distanceKm = parseNumber(payload.distanceKm);
  const status = normalizeText(payload.status);

  if (!vehiclePlateNumber) return { error: "Vehicle is required" };
  if (!driverId) return { error: "Driver is required" };
  if (source.length < 2) return { error: "Source must be at least 2 characters" };
  if (destination.length < 2) return { error: "Destination must be at least 2 characters" };
  if (cargoDescription.length < 3) return { error: "Cargo description must be at least 3 characters" };
  if (!Number.isFinite(cargoWeightKg) || cargoWeightKg <= 0) return { error: "Cargo weight must be greater than zero" };
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return { error: "Distance must be greater than zero" };
  if (!payload.startDate) return { error: "Start date is required" };
  if (!payload.endDate) return { error: "End date is required" };

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Trip dates are invalid" };
  }

  if (endDate.getTime() < startDate.getTime()) {
    return { error: "End date must be on or after start date" };
  }

  if (!status || !isTripStatus(status)) {
    return { error: "Status must be Scheduled, Active, Completed, or Cancelled" };
  }

  return {
    data: {
      vehiclePlateNumber,
      driverId,
      source,
      destination,
      cargoDescription,
      cargoWeightKg,
      distanceKm,
      startDate,
      endDate,
      status,
    },
  };
}

async function loadTripWithDriver(id: string) {
  return prisma.trip.findUnique({
    where: { id },
    include: {
      driver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          assignedVehicle: true,
        },
      },
    },
  });
}

async function findActiveConflict(vehiclePlateNumber: string, driverId: string, excludeTripId?: string) {
  const vehicleConflict = await prisma.trip.findFirst({
    where: {
      status: "ACTIVE",
      vehiclePlateNumber,
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    select: { id: true },
  });

  if (vehicleConflict) {
    return "That vehicle already has an active trip";
  }

  const driverConflict = await prisma.trip.findFirst({
    where: {
      status: "ACTIVE",
      driverId,
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    select: { id: true },
  });

  if (driverConflict) {
    return "That driver already has an active trip";
  }

  return null;
}

async function validateTripRules(payload: ValidatedTripPayload): Promise<{ error: string } | { data: EnrichedTripPayload }> {
  const vehicle = getVehicleByPlateNumber(payload.vehiclePlateNumber);
  if (!vehicle) {
    return { error: "Vehicle not found" };
  }

  if (vehicle.lifecycleStatus === "RETIRED") {
    return { error: "Retired vehicles cannot be assigned" };
  }

  if (vehicle.lifecycleStatus === "IN_SHOP") {
    return { error: "Vehicles in shop cannot be assigned" };
  }

  if (payload.cargoWeightKg > vehicle.capacityKg) {
    return { error: `Cargo weight exceeds ${vehicle.capacityKg} kg capacity for this vehicle` };
  }

  const driver = await prisma.driver.findUnique({
    where: { id: payload.driverId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      assignedVehicle: true,
    },
  });

  if (!driver) {
    return { error: "Driver not found" };
  }

  if (driver.status === "ON_LEAVE") {
    return { error: "Drivers on leave cannot be assigned to trips" };
  }

  return { data: { ...payload, vehicle, driver } };
}

function shouldAssignDriverToTrip(status: TripStatus) {
  return status === "ACTIVE";
}

router.use(requireAuth, requireRoles("FLEET_MANAGER"));

router.get("/", async (req: AuthenticatedRequest, res) => {
  const search = normalizeText(getQueryParam(req.query.search as string | undefined));
  const statusFilter = normalizeText(getQueryParam(req.query.status as string | undefined));
  const sortBy = (normalizeText(getQueryParam(req.query.sortBy as string | undefined)) || "startDate") as TripSortField;
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const rawTrips = await prisma.trip.findMany({
    include: {
      driver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          assignedVehicle: true,
        },
      },
    },
  });

  const trips = rawTrips
    .filter((trip) => {
      const matchesStatus = !statusFilter || statusFilter === "all" || trip.status === statusFilter;
      const matchesSearch =
        !search ||
        [
          trip.source,
          trip.destination,
          trip.cargoDescription,
          trip.vehiclePlateNumber,
          trip.driver.fullName,
          trip.driver.email,
          trip.driver.phone,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    })
    .map((trip) => ({ ...trip, driver: trip.driver })) as TripRecord[];

  res.json({
    trips: sortTrips(trips, sortBy, sortOrder).map(serializeTrip),
    summary: buildSummary(trips),
  });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = validateBasicPayload(req.body as TripInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const ruled = await validateTripRules(parsed.data);
  if ("error" in ruled) {
    res.status(400).json({ error: ruled.error });
    return;
  }

  const activeConflict = shouldAssignDriverToTrip(ruled.data.status)
    ? await findActiveConflict(ruled.data.vehiclePlateNumber, ruled.data.driverId)
    : null;

  if (activeConflict) {
    res.status(409).json({ error: activeConflict });
    return;
  }

  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        vehiclePlateNumber: ruled.data.vehiclePlateNumber,
        driverId: ruled.data.driverId,
        source: ruled.data.source,
        destination: ruled.data.destination,
        cargoDescription: ruled.data.cargoDescription,
        cargoWeightKg: ruled.data.cargoWeightKg,
        distanceKm: ruled.data.distanceKm,
        startDate: ruled.data.startDate,
        endDate: ruled.data.endDate,
        status: ruled.data.status,
      },
    });

    if (shouldAssignDriverToTrip(ruled.data.status)) {
      await tx.driver.update({ where: { id: ruled.data.driverId }, data: { status: "ON_TRIP" } });
    }

    return created;
  });

  const createdTrip = await loadTripWithDriver(trip.id);
  res.status(201).json({ trip: serializeTrip(createdTrip as TripRecord) });
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  const tripId = getQueryParam(req.params.id);
  if (!tripId) {
    res.status(400).json({ error: "Trip id is required" });
    return;
  }

  const existingTrip = await loadTripWithDriver(tripId);
  if (!existingTrip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const parsed = validateBasicPayload(req.body as TripInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const ruled = await validateTripRules(parsed.data);
  if ("error" in ruled) {
    res.status(400).json({ error: ruled.error });
    return;
  }

  const activeConflict = shouldAssignDriverToTrip(ruled.data.status)
    ? await findActiveConflict(ruled.data.vehiclePlateNumber, ruled.data.driverId, tripId)
    : null;

  if (activeConflict) {
    res.status(409).json({ error: activeConflict });
    return;
  }

  const updatedTrip = await prisma.$transaction(async (tx) => {
    const saved = await tx.trip.update({
      where: { id: tripId },
      data: {
        vehiclePlateNumber: ruled.data.vehiclePlateNumber,
        driverId: ruled.data.driverId,
        source: ruled.data.source,
        destination: ruled.data.destination,
        cargoDescription: ruled.data.cargoDescription,
        cargoWeightKg: ruled.data.cargoWeightKg,
        distanceKm: ruled.data.distanceKm,
        startDate: ruled.data.startDate,
        endDate: ruled.data.endDate,
        status: ruled.data.status,
      },
    });

    if (existingTrip.status === "ACTIVE" && ruled.data.status !== "ACTIVE") {
      await tx.driver.update({ where: { id: existingTrip.driverId }, data: { status: "AVAILABLE" } });
    }

    if (ruled.data.status === "ACTIVE") {
      if (existingTrip.status === "ACTIVE" && existingTrip.driverId !== ruled.data.driverId) {
        await tx.driver.update({ where: { id: existingTrip.driverId }, data: { status: "AVAILABLE" } });
      }
      await tx.driver.update({ where: { id: ruled.data.driverId }, data: { status: "ON_TRIP" } });
    }

    return saved;
  });

  const trip = await loadTripWithDriver(updatedTrip.id);
  res.json({ trip: serializeTrip(trip as TripRecord) });
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const tripId = getQueryParam(req.params.id);
  if (!tripId) {
    res.status(400).json({ error: "Trip id is required" });
    return;
  }

  const existingTrip = await loadTripWithDriver(tripId);
  if (!existingTrip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (existingTrip.status === "ACTIVE") {
      await tx.driver.update({ where: { id: existingTrip.driverId }, data: { status: "AVAILABLE" } });
    }

    await tx.trip.delete({ where: { id: tripId } });
  });

  res.json({ message: "Trip deleted" });
});

export default router;