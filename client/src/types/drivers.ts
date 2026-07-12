export const DRIVER_STATUSES = ["AVAILABLE", "ON_TRIP", "ON_LEAVE"] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  ON_LEAVE: "On Leave",
};

export interface DriverRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  status: DriverStatus;
  statusLabel: string;
  assignedVehicle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverSummary {
  total: number;
  available: number;
  onTrip: number;
  onLeave: number;
  assignedVehicles: number;
  unassignedVehicles: number;
}

export interface DriversResponse {
  drivers: DriverRecord[];
  summary: DriverSummary;
}

export interface DriverPayload {
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  status: DriverStatus;
  assignedVehicle: string | null;
}