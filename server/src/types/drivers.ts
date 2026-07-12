export const DRIVER_STATUSES = ["AVAILABLE", "ON_TRIP", "ON_LEAVE"] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  ON_LEAVE: "On Leave",
};

export function isDriverStatus(value: string): value is DriverStatus {
  return DRIVER_STATUSES.includes(value as DriverStatus);
}