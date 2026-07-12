import type {
  DashboardFilters,
  FleetKpis,
  KpiDefinition,
  RoleDashboardConfig,
  RoleDashboardConfigs,
} from "../types/dashboard";
import type { Role } from "../types";

const BASE_METRICS: FleetKpis = {
  activeVehicles: 142,
  availableVehicles: 38,
  vehiclesInMaintenance: 12,
  activeTrips: 87,
  pendingTrips: 23,
  driversOnDuty: 96,
  fleetUtilization: 74,
};

const VEHICLE_TYPE_MULTIPLIERS: Record<
  DashboardFilters["vehicleType"],
  Partial<FleetKpis>
> = {
  all: {},
  bus: {
    activeVehicles: 0.42,
    availableVehicles: 0.38,
    vehiclesInMaintenance: 0.45,
    activeTrips: 0.48,
    pendingTrips: 0.4,
    driversOnDuty: 0.44,
    fleetUtilization: 0.92,
  },
  van: {
    activeVehicles: 0.31,
    availableVehicles: 0.34,
    vehiclesInMaintenance: 0.28,
    activeTrips: 0.3,
    pendingTrips: 0.32,
    driversOnDuty: 0.33,
    fleetUtilization: 0.88,
  },
  truck: {
    activeVehicles: 0.27,
    availableVehicles: 0.28,
    vehiclesInMaintenance: 0.27,
    activeTrips: 0.22,
    pendingTrips: 0.28,
    driversOnDuty: 0.23,
    fleetUtilization: 0.85,
  },
};

const REGION_MULTIPLIERS: Record<DashboardFilters["region"], Partial<FleetKpis>> = {
  all: {},
  north: {
    activeVehicles: 0.28,
    availableVehicles: 0.26,
    vehiclesInMaintenance: 0.25,
    activeTrips: 0.27,
    pendingTrips: 0.3,
    driversOnDuty: 0.29,
    fleetUtilization: 1.04,
  },
  south: {
    activeVehicles: 0.24,
    availableVehicles: 0.27,
    vehiclesInMaintenance: 0.33,
    activeTrips: 0.22,
    pendingTrips: 0.26,
    driversOnDuty: 0.25,
    fleetUtilization: 0.96,
  },
  east: {
    activeVehicles: 0.26,
    availableVehicles: 0.24,
    vehiclesInMaintenance: 0.17,
    activeTrips: 0.28,
    pendingTrips: 0.22,
    driversOnDuty: 0.27,
    fleetUtilization: 1.08,
  },
  west: {
    activeVehicles: 0.22,
    availableVehicles: 0.23,
    vehiclesInMaintenance: 0.25,
    activeTrips: 0.23,
    pendingTrips: 0.22,
    driversOnDuty: 0.19,
    fleetUtilization: 0.92,
  },
};

const STATUS_ADJUSTMENTS: Record<
  DashboardFilters["status"],
  Partial<FleetKpis>
> = {
  all: {},
  active: {
    activeVehicles: 1.12,
    availableVehicles: 0.72,
    vehiclesInMaintenance: 0.55,
    fleetUtilization: 1.06,
  },
  available: {
    activeVehicles: 0.68,
    availableVehicles: 1.35,
    vehiclesInMaintenance: 0.4,
    fleetUtilization: 0.82,
  },
  maintenance: {
    activeVehicles: 0.55,
    availableVehicles: 0.48,
    vehiclesInMaintenance: 1.8,
    fleetUtilization: 0.7,
  },
};

function scaleValue(value: number, multiplier: number | undefined): number {
  if (!multiplier) return value;
  return Math.round(value * multiplier);
}

export function getFleetKpis(filters: DashboardFilters): FleetKpis {
  const typeMult = VEHICLE_TYPE_MULTIPLIERS[filters.vehicleType];
  const regionMult = REGION_MULTIPLIERS[filters.region];
  const statusAdj = STATUS_ADJUSTMENTS[filters.status];

  const scaled: FleetKpis = {
    activeVehicles: scaleValue(
      BASE_METRICS.activeVehicles,
      (typeMult.activeVehicles ?? 1) * (regionMult.activeVehicles ?? 1) * (statusAdj.activeVehicles ?? 1)
    ),
    availableVehicles: scaleValue(
      BASE_METRICS.availableVehicles,
      (typeMult.availableVehicles ?? 1) *
        (regionMult.availableVehicles ?? 1) *
        (statusAdj.availableVehicles ?? 1)
    ),
    vehiclesInMaintenance: scaleValue(
      BASE_METRICS.vehiclesInMaintenance,
      (typeMult.vehiclesInMaintenance ?? 1) *
        (regionMult.vehiclesInMaintenance ?? 1) *
        (statusAdj.vehiclesInMaintenance ?? 1)
    ),
    activeTrips: scaleValue(
      BASE_METRICS.activeTrips,
      (typeMult.activeTrips ?? 1) * (regionMult.activeTrips ?? 1)
    ),
    pendingTrips: scaleValue(
      BASE_METRICS.pendingTrips,
      (typeMult.pendingTrips ?? 1) * (regionMult.pendingTrips ?? 1)
    ),
    driversOnDuty: scaleValue(
      BASE_METRICS.driversOnDuty,
      (typeMult.driversOnDuty ?? 1) * (regionMult.driversOnDuty ?? 1)
    ),
    fleetUtilization: Math.min(
      99,
      Math.max(
        12,
        Math.round(
          BASE_METRICS.fleetUtilization *
            (typeMult.fleetUtilization ?? 1) *
            (regionMult.fleetUtilization ?? 1) *
            (statusAdj.fleetUtilization ?? 1)
        )
      )
    ),
  };

  return scaled;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "activeVehicles",
    label: "Active Vehicles",
    icon: "vehicles",
    format: "number",
    trend: 4.2,
    accent: "blue",
  },
  {
    id: "availableVehicles",
    label: "Available Vehicles",
    icon: "available",
    format: "number",
    trend: 2.1,
    accent: "emerald",
  },
  {
    id: "vehiclesInMaintenance",
    label: "Vehicles in Maintenance",
    icon: "maintenance",
    format: "number",
    trend: -1.8,
    accent: "amber",
  },
  {
    id: "activeTrips",
    label: "Active Trips",
    icon: "trips",
    format: "number",
    trend: 6.5,
    accent: "violet",
  },
  {
    id: "pendingTrips",
    label: "Pending Trips",
    icon: "pending",
    format: "number",
    trend: -3.2,
    accent: "rose",
  },
  {
    id: "driversOnDuty",
    label: "Drivers On Duty",
    icon: "drivers",
    format: "number",
    trend: 1.4,
    accent: "cyan",
  },
  {
    id: "fleetUtilization",
    label: "Fleet Utilization",
    icon: "utilization",
    format: "percent",
    trend: 3.8,
    accent: "indigo",
  },
];

export const ROLE_DASHBOARD_CONFIG: RoleDashboardConfigs = {
  FLEET_MANAGER: {
    headline: "Fleet Command Center",
    subheadline: "Real-time visibility across your entire transport operation.",
    primaryKpis: [
      "activeVehicles",
      "fleetUtilization",
      "activeTrips",
      "driversOnDuty",
    ],
    insightTitle: "Operational pulse",
    insightBody:
      "Fleet utilization is trending up. Consider reallocating 6 available vehicles from the West region to meet pending trip demand in the East.",
  },
  DRIVER: {
    headline: "Driver Operations Hub",
    subheadline: "Your shift overview — trips, fleet status, and route readiness.",
    primaryKpis: ["activeTrips", "pendingTrips", "availableVehicles", "driversOnDuty"],
    insightTitle: "Shift snapshot",
    insightBody:
      "23 trips are queued for assignment. 96 drivers are currently on duty with strong coverage in the North and East corridors.",
  },
  SAFETY_OFFICER: {
    headline: "Safety & Compliance Overview",
    subheadline: "Monitor fleet health, maintenance load, and operational risk signals.",
    primaryKpis: [
      "vehiclesInMaintenance",
      "activeVehicles",
      "fleetUtilization",
      "driversOnDuty",
    ],
    insightTitle: "Risk watch",
    insightBody:
      "Maintenance volume is stable. Watch South region — slightly elevated vehicle downtime may impact afternoon trip coverage.",
  },
  FINANCIAL_ANALYST: {
    headline: "Fleet Performance Dashboard",
    subheadline: "Track utilization efficiency and capacity metrics for cost optimization.",
    primaryKpis: [
      "fleetUtilization",
      "activeVehicles",
      "availableVehicles",
      "activeTrips",
    ],
    insightTitle: "Efficiency insight",
    insightBody:
      "At 74% utilization, there is headroom to absorb 15–20% more trip volume before additional fleet investment is needed.",
  },
};

export const FILTER_OPTIONS = {
  vehicleType: [
    { value: "all", label: "All Types" },
    { value: "bus", label: "Bus" },
    { value: "van", label: "Van" },
    { value: "truck", label: "Truck" },
  ],
  status: [
    { value: "all", label: "All Statuses" },
    { value: "active", label: "Active" },
    { value: "available", label: "Available" },
    { value: "maintenance", label: "In Maintenance" },
  ],
  region: [
    { value: "all", label: "All Regions" },
    { value: "north", label: "North" },
    { value: "south", label: "South" },
    { value: "east", label: "East" },
    { value: "west", label: "West" },
  ],
} as const;

export const DEFAULT_FILTERS: DashboardFilters = {
  vehicleType: "all",
  status: "all",
  region: "all",
};

export function getRoleConfig(role: Role): RoleDashboardConfig {
  return ROLE_DASHBOARD_CONFIG[role];
}
