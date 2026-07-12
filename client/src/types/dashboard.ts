import type { Role } from "./index";

export type VehicleTypeFilter = "all" | "bus" | "van" | "truck";
export type StatusFilter = "all" | "active" | "available" | "maintenance";
export type RegionFilter = "all" | "north" | "south" | "east" | "west";

export interface DashboardFilters {
  vehicleType: VehicleTypeFilter;
  status: StatusFilter;
  region: RegionFilter;
}

export interface FleetKpis {
  activeVehicles: number;
  availableVehicles: number;
  vehiclesInMaintenance: number;
  activeTrips: number;
  pendingTrips: number;
  driversOnDuty: number;
  fleetUtilization: number;
}

export interface KpiDefinition {
  id: keyof FleetKpis;
  label: string;
  icon: "vehicles" | "available" | "maintenance" | "trips" | "pending" | "drivers" | "utilization";
  format: "number" | "percent";
  trend?: number;
  accent: "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan" | "indigo";
}

export interface RoleDashboardConfig {
  headline: string;
  subheadline: string;
  primaryKpis: Array<keyof FleetKpis>;
  insightTitle: string;
  insightBody: string;
}

export type RoleDashboardConfigs = Record<Role, RoleDashboardConfig>;
