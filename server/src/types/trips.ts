export const TRIP_STATUSES = ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function isTripStatus(value: string): value is TripStatus {
  return TRIP_STATUSES.includes(value as TripStatus);
}