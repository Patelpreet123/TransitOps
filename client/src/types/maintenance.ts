import type { VehicleLifecycleStatus } from "../lib/api";

export const MAINTENANCE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export interface MaintenanceVehicleRef {
  plateNumber: string;
  model: string;
  depot: string;
  capacityKg: number;
  lifecycleStatus: VehicleLifecycleStatus;
}

export interface MaintenanceRecord {
  id: string;
  vehiclePlateNumber: string;
  vehicle: MaintenanceVehicleRef | null;
  serviceType: string;
  scheduledDate: string;
  completionDate: string | null;
  cost: number;
  notes: string | null;
  status: MaintenanceStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceSummary {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  totalCost: number;
}

export interface MaintenanceResponse {
  maintenance: MaintenanceRecord[];
  summary: MaintenanceSummary;
}

export interface MaintenancePayload {
  vehiclePlateNumber: string;
  serviceType: string;
  scheduledDate: string;
  completionDate: string | null;
  cost: number;
  notes: string | null;
  status: MaintenanceStatus;
}