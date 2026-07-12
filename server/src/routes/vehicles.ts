import { Router } from "express";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";

export type VehicleLifecycleStatus = "ACTIVE" | "RETIRED" | "IN_SHOP";
type VehicleStatus = "available" | "assigned" | "maintenance";
type VehicleType = "bus" | "van" | "truck";

export interface VehicleRecord {
  id: string;
  plateNumber: string;
  type: VehicleType;
  model: string;
  depot: string;
  status: VehicleStatus;
  capacityKg: number;
  lifecycleStatus: VehicleLifecycleStatus;
  mileageKm: number;
  lastService: string;
  nextService: string;
  assignedDriver: string | null;
}

export const VEHICLES: VehicleRecord[] = [
  { id: "veh-001", plateNumber: "TR-2048", type: "bus", model: "Voltra City 40", depot: "North Depot", status: "assigned", capacityKg: 12000, lifecycleStatus: "ACTIVE", mileageKm: 18420, lastService: "2026-06-28", nextService: "2026-08-01", assignedDriver: "Dana Driver" },
  { id: "veh-002", plateNumber: "TR-2111", type: "bus", model: "Voltra City 40", depot: "North Depot", status: "available", capacityKg: 12000, lifecycleStatus: "ACTIVE", mileageKm: 16200, lastService: "2026-06-14", nextService: "2026-08-06", assignedDriver: null },
  { id: "veh-003", plateNumber: "TR-3172", type: "van", model: "TransitX Cargo 12", depot: "East Depot", status: "assigned", capacityKg: 5500, lifecycleStatus: "ACTIVE", mileageKm: 22310, lastService: "2026-06-20", nextService: "2026-08-03", assignedDriver: "Ari Stone" },
  { id: "veh-004", plateNumber: "TR-3224", type: "van", model: "TransitX Cargo 12", depot: "East Depot", status: "available", capacityKg: 5500, lifecycleStatus: "IN_SHOP", mileageKm: 15890, lastService: "2026-06-11", nextService: "2026-07-29", assignedDriver: null },
  { id: "veh-005", plateNumber: "TR-4288", type: "truck", model: "Hauler Pro 18", depot: "South Depot", status: "maintenance", capacityKg: 18000, lifecycleStatus: "RETIRED", mileageKm: 34120, lastService: "2026-06-05", nextService: "2026-07-15", assignedDriver: null },
  { id: "veh-006", plateNumber: "TR-4330", type: "truck", model: "Hauler Pro 18", depot: "South Depot", status: "available", capacityKg: 18000, lifecycleStatus: "ACTIVE", mileageKm: 26780, lastService: "2026-06-18", nextService: "2026-08-12", assignedDriver: null },
  { id: "veh-007", plateNumber: "TR-5099", type: "bus", model: "MetroLine E2", depot: "West Depot", status: "assigned", capacityKg: 14000, lifecycleStatus: "ACTIVE", mileageKm: 29340, lastService: "2026-06-24", nextService: "2026-08-08", assignedDriver: "Sam Safety" },
  { id: "veh-008", plateNumber: "TR-5155", type: "van", model: "TransitX Cargo 12", depot: "West Depot", status: "maintenance", capacityKg: 5500, lifecycleStatus: "ACTIVE", mileageKm: 20110, lastService: "2026-06-03", nextService: "2026-07-20", assignedDriver: null },
];

export function getVehicleByPlateNumber(plateNumber: string) {
  return VEHICLES.find((vehicle) => vehicle.plateNumber === plateNumber) ?? null;
}

export function updateVehicleByPlateNumber(
  plateNumber: string,
  patch: Partial<Pick<VehicleRecord, "status" | "lifecycleStatus" | "assignedDriver" | "lastService" | "nextService">>
) {
  const vehicle = getVehicleByPlateNumber(plateNumber);
  if (!vehicle) {
    return null;
  }

  Object.assign(vehicle, patch);
  return vehicle;
}

export function setVehicleMaintenanceState(plateNumber: string, inMaintenance: boolean) {
  const vehicle = getVehicleByPlateNumber(plateNumber);
  if (!vehicle) {
    return null;
  }

  vehicle.lifecycleStatus = inMaintenance ? "IN_SHOP" : vehicle.lifecycleStatus === "RETIRED" ? "RETIRED" : "ACTIVE";
  if (vehicle.lifecycleStatus !== "RETIRED") {
    vehicle.status = inMaintenance ? "maintenance" : vehicle.assignedDriver ? "assigned" : "available";
  }

  return vehicle;
}

export function getVehicleStatusLabel(vehicle: VehicleRecord) {
  return vehicle.lifecycleStatus === "RETIRED"
    ? "Retired"
    : vehicle.lifecycleStatus === "IN_SHOP"
      ? "In Shop"
      : vehicle.status === "maintenance"
        ? "Under Maintenance"
        : vehicle.status === "assigned"
          ? "Assigned"
          : "Available";
}

function buildSummary(vehicles: VehicleRecord[]) {
  const totals = vehicles.reduce(
    (accumulator, vehicle) => {
      accumulator.total += 1;
      accumulator[vehicle.status] += 1;
      return accumulator;
    },
    { total: 0, available: 0, assigned: 0, maintenance: 0 }
  );

  return {
    totals,
    byType: {
      bus: vehicles.filter((vehicle) => vehicle.type === "bus").length,
      van: vehicles.filter((vehicle) => vehicle.type === "van").length,
      truck: vehicles.filter((vehicle) => vehicle.type === "truck").length,
    },
  };
}

const router = Router();

router.get("/registry", requireAuth, requireRoles("FLEET_MANAGER", "FINANCIAL_ANALYST"), (_req: AuthenticatedRequest, res) => {
  res.json({
    summary: buildSummary(VEHICLES),
    vehicles: VEHICLES,
  });
});

export default router;