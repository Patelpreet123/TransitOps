import type { FuelRecord, FuelSummary } from "../lib/api";

export const FUEL_STATUSES = ["RECORDED", "VOIDED"] as const;

export type FuelStatus = (typeof FUEL_STATUSES)[number];

export const FUEL_STATUS_LABELS: Record<FuelStatus, string> = {
  RECORDED: "Recorded",
  VOIDED: "Voided",
};

export interface FuelPayload {
  vehiclePlateNumber: string;
  tripId: string | null;
  fuelType: string;
  liters: number;
  unitPrice: number;
  refueledAt: string;
  odometerKm: number | null;
  notes: string | null;
  status: FuelStatus;
}

export interface FuelResponse {
  fuel: FuelRecord[];
  summary: FuelSummary;
}