export const FUEL_STATUSES = ["RECORDED", "VOIDED"] as const;

export type FuelStatus = (typeof FUEL_STATUSES)[number];

export const FUEL_STATUS_LABELS: Record<FuelStatus, string> = {
  RECORDED: "Recorded",
  VOIDED: "Voided",
};

export function isFuelStatus(value: string): value is FuelStatus {
  return FUEL_STATUSES.includes(value as FuelStatus);
}