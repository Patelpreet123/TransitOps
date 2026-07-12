export interface ReportFilterInput {
  from?: string;
  to?: string;
  vehicle?: string;
  driver?: string;
  tripStatus?: string;
  vehicleStatus?: string;
  maintenanceStatus?: string;
}

export interface DistributionItem {
  label: string;
  value: number;
  tone: string;
}

export interface NamedMetric {
  label: string;
  value: number;
  detail?: string;
}

export interface ReportsAnalytics {
  filters: ReportFilterInput;
  kpis: {
    totalVehicles: number;
    availableVehicles: number;
    vehiclesOnTrip: number;
    vehiclesInShop: number;
    retiredVehicles: number;
    totalDrivers: number;
    activeTrips: number;
    completedTrips: number;
    totalFuelCost: number;
    totalMaintenanceCost: number;
    totalOperationalCost: number;
  };
  summaries: {
    fleetUtilizationPct: number;
    averageFuelEfficiency: number;
    mostUsedVehicle: NamedMetric | null;
    highestMaintenanceVehicle: NamedMetric | null;
    highestCostPeriod: NamedMetric | null;
    mostActiveDriver: NamedMetric | null;
  };
  charts: {
    vehicleStatusDistribution: DistributionItem[];
    tripStatusDistribution: DistributionItem[];
    fleetUtilization: DistributionItem[];
    fuelVsMaintenance: Array<{ label: string; fuel: number; maintenance: number }>;
    monthlyOperationalTrend: Array<{ label: string; fuel: number; maintenance: number; expenses: number; total: number }>;
    driverStatusDistribution: DistributionItem[];
  };
  meta: {
    vehicleOptions: Array<{ plateNumber: string; model: string }>;
    driverOptions: Array<{ id: string; fullName: string }>;
    generatedAt: string;
  };
}

export interface ReportsAnalyticsResponse {
  analytics: ReportsAnalytics;
}

export interface ReportFilterState {
  from: string;
  to: string;
  vehicle: string;
  driver: string;
  tripStatus: string;
  vehicleStatus: string;
  maintenanceStatus: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFilterState = {
  from: "",
  to: "",
  vehicle: "all",
  driver: "all",
  tripStatus: "all",
  vehicleStatus: "all",
  maintenanceStatus: "all",
};

export function filtersToQuery(filters: ReportFilterState): ReportFilterInput {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    vehicle: filters.vehicle !== "all" ? filters.vehicle : undefined,
    driver: filters.driver !== "all" ? filters.driver : undefined,
    tripStatus: filters.tripStatus !== "all" ? filters.tripStatus : undefined,
    vehicleStatus: filters.vehicleStatus !== "all" ? filters.vehicleStatus : undefined,
    maintenanceStatus: filters.maintenanceStatus !== "all" ? filters.maintenanceStatus : undefined,
  };
}
