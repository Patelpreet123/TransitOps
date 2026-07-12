import type { TripStatus, TripPayload, TripRecord, TripSummary } from "../lib/api";

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type { TripStatus, TripPayload, TripRecord, TripSummary };