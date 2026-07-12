import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { DRIVER_STATUS_LABELS, isDriverStatus, type DriverStatus } from "../types/drivers.js";

type DriverInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseExpiryDate?: string;
  status?: string;
  assignedVehicle?: string | null;
};

type DriverOrderBy =
  | "fullName"
  | "email"
  | "licenseNumber"
  | "licenseExpiryDate"
  | "status"
  | "assignedVehicle"
  | "createdAt";

const router = Router();

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeVehicle(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^[+()\d\s-]{7,24}$/.test(value);
}

function isFutureDate(value: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value.getTime() >= today.getTime();
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function serializeDriver(driver: {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiryDate: Date;
  status: DriverStatus;
  assignedVehicle: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...driver,
    licenseExpiryDate: formatDateOnly(driver.licenseExpiryDate),
    statusLabel: DRIVER_STATUS_LABELS[driver.status],
  };
}

function buildSummary(drivers: Array<{ status: DriverStatus; assignedVehicle: string | null }>) {
  return drivers.reduce(
    (summary, driver) => {
      summary.total += 1;
      if (driver.status === "AVAILABLE") {
        summary.available += 1;
      } else if (driver.status === "ON_TRIP") {
        summary.onTrip += 1;
      } else {
        summary.onLeave += 1;
      }
      if (driver.assignedVehicle) {
        summary.assignedVehicles += 1;
      } else {
        summary.unassignedVehicles += 1;
      }
      return summary;
    },
    {
      total: 0,
      available: 0,
      onTrip: 0,
      onLeave: 0,
      assignedVehicles: 0,
      unassignedVehicles: 0,
    }
  );
}

function parseOrderBy(value: unknown): DriverOrderBy {
  const allowed: DriverOrderBy[] = [
    "fullName",
    "email",
    "licenseNumber",
    "licenseExpiryDate",
    "status",
    "assignedVehicle",
    "createdAt",
  ];

  return allowed.includes(value as DriverOrderBy) ? (value as DriverOrderBy) : "fullName";
}

function compareStrings(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

function getRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function sortDrivers(
  drivers: Awaited<ReturnType<typeof prisma.driver.findMany>>,
  orderBy: DriverOrderBy,
  order: "asc" | "desc"
) {
  const direction = order === "asc" ? 1 : -1;

  return [...drivers].sort((left, right) => {
    let result = 0;

    switch (orderBy) {
      case "fullName":
        result = compareStrings(left.fullName, right.fullName);
        break;
      case "email":
        result = compareStrings(left.email, right.email);
        break;
      case "licenseNumber":
        result = compareStrings(left.licenseNumber, right.licenseNumber);
        break;
      case "licenseExpiryDate":
        result = left.licenseExpiryDate.getTime() - right.licenseExpiryDate.getTime();
        break;
      case "status":
        result = compareStrings(left.status, right.status);
        break;
      case "assignedVehicle":
        result = compareStrings(left.assignedVehicle, right.assignedVehicle);
        break;
      case "createdAt":
        result = left.createdAt.getTime() - right.createdAt.getTime();
        break;
    }

    if (result === 0) {
      result = compareStrings(left.fullName, right.fullName);
    }

    return result * direction;
  });
}

function buildWhereClause(search: string | undefined, status: string | undefined) {
  const filters: Array<Record<string, unknown>> = [];

  if (status && isDriverStatus(status)) {
    filters.push({ status });
  }

  if (search) {
    filters.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { licenseNumber: { contains: search, mode: "insensitive" } },
        { assignedVehicle: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.length === 0) {
    return {};
  }

  return { AND: filters };
}

async function ensureUniqueAssignments(driverId: string | null, input: Required<Pick<DriverInput, "email" | "licenseNumber">> & { assignedVehicle: string | null }) {
  const excludeSelf = driverId ? { id: { not: driverId } } : {};
  const [emailConflict, licenseConflict, vehicleConflict] = await Promise.all([
    prisma.driver.findFirst({ where: { email: input.email, ...excludeSelf }, select: { id: true } }),
    prisma.driver.findFirst({ where: { licenseNumber: input.licenseNumber, ...excludeSelf }, select: { id: true } }),
    input.assignedVehicle
      ? prisma.driver.findFirst({ where: { assignedVehicle: input.assignedVehicle, ...excludeSelf }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (emailConflict) {
    return "An account with this email already exists";
  }

  if (licenseConflict) {
    return "License number must be unique";
  }

  if (vehicleConflict) {
    return "That vehicle is already assigned to another driver";
  }

  return null;
}

function validatePayload(payload: DriverInput, isUpdate = false) {
  const fullName = normalizeText(payload.fullName);
  const email = normalizeText(payload.email).toLowerCase();
  const phone = normalizeText(payload.phone);
  const licenseNumber = normalizeText(payload.licenseNumber).toUpperCase();
  const assignedVehicle = normalizeVehicle(payload.assignedVehicle);
  const status = normalizeText(payload.status);

  if (!fullName || fullName.length < 2) {
    return { error: "Full name must be at least 2 characters" };
  }

  if (!email || !isValidEmail(email)) {
    return { error: "A valid email is required" };
  }

  if (!phone || !isValidPhone(phone)) {
    return { error: "A valid phone number is required" };
  }

  if (!licenseNumber || licenseNumber.length < 4) {
    return { error: "License number must be at least 4 characters" };
  }

  if (!payload.licenseExpiryDate) {
    return { error: "License expiry date is required" };
  }

  const licenseExpiryDate = new Date(payload.licenseExpiryDate);
  if (Number.isNaN(licenseExpiryDate.getTime())) {
    return { error: "License expiry date is invalid" };
  }

  if (!isFutureDate(licenseExpiryDate)) {
    return { error: "License expiry date cannot be in the past" };
  }

  if (!status || !isDriverStatus(status)) {
    return { error: "Status must be Available, On Trip, or On Leave" };
  }

  return {
    data: {
      fullName,
      email,
      phone,
      licenseNumber,
      licenseExpiryDate,
      status,
      assignedVehicle,
    },
  };
}

router.use(requireAuth, requireRoles("FLEET_MANAGER"));

router.get("/", async (req: AuthenticatedRequest, res) => {
  const search = normalizeText(req.query.search as string | undefined);
  const status = normalizeText(req.query.status as string | undefined);
  const orderBy = parseOrderBy(req.query.sortBy);
  const order = req.query.sortOrder === "desc" ? "desc" : "asc";

  const [drivers] = await Promise.all([
    prisma.driver.findMany({
      where: buildWhereClause(search, status),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const allDrivers = await prisma.driver.findMany({ orderBy: { createdAt: "desc" } });

  res.json({
    drivers: sortDrivers(drivers, orderBy, order).map(serializeDriver),
    summary: buildSummary(allDrivers),
  });
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = validatePayload(req.body as DriverInput);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const conflict = await ensureUniqueAssignments(null, {
    email: parsed.data.email,
    licenseNumber: parsed.data.licenseNumber,
    assignedVehicle: parsed.data.assignedVehicle,
  });

  if (conflict) {
    res.status(409).json({ error: conflict });
    return;
  }

  try {
    const driver = await prisma.driver.create({
      data: {
        ...parsed.data,
        status: parsed.data.status as DriverStatus,
      },
    });

    res.status(201).json({ driver: serializeDriver(driver) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Driver data must be unique" });
      return;
    }

    throw error;
  }
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  const driverId = getRouteParam(req.params.id);

  if (!driverId) {
    res.status(400).json({ error: "Driver id is required" });
    return;
  }

  const existing = await prisma.driver.findUnique({ where: { id: driverId } });

  if (!existing) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  const parsed = validatePayload(req.body as DriverInput, true);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const conflict = await ensureUniqueAssignments(driverId, {
    email: parsed.data.email,
    licenseNumber: parsed.data.licenseNumber,
    assignedVehicle: parsed.data.assignedVehicle,
  });

  if (conflict) {
    res.status(409).json({ error: conflict });
    return;
  }

  try {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        ...parsed.data,
        status: parsed.data.status as DriverStatus,
      },
    });

    res.json({ driver: serializeDriver(driver) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Driver data must be unique" });
      return;
    }

    throw error;
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const driverId = getRouteParam(req.params.id);

  if (!driverId) {
    res.status(400).json({ error: "Driver id is required" });
    return;
  }

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });

  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  await prisma.driver.delete({ where: { id: driverId } });
  res.json({ message: "Driver deleted" });
});

export default router;