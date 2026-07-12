import { prisma } from "./prisma.js";
import { DRIVER_STATUS_LABELS } from "../types/drivers.js";
import { TRIP_STATUS_LABELS } from "../types/trips.js";
import { MAINTENANCE_STATUS_LABELS } from "../types/maintenance.js";
import { VEHICLES, getVehicleStatusLabel, type VehicleRecord } from "../routes/vehicles.js";

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
    fuelVsMaintenance: { label: string; fuel: number; maintenance: number }[];
    monthlyOperationalTrend: Array<{ label: string; fuel: number; maintenance: number; expenses: number; total: number }>;
    driverStatusDistribution: DistributionItem[];
  };
  meta: {
    vehicleOptions: Array<{ plateNumber: string; model: string }>;
    driverOptions: Array<{ id: string; fullName: string }>;
    generatedAt: string;
  };
}

function getQueryValue(value: string | undefined) {
  return value && value !== "all" ? value : undefined;
}

function inDateRange(dateValue: string | Date, from?: string, to?: string) {
  const date = typeof dateValue === "string" ? dateValue.slice(0, 10) : dateValue.toISOString().slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function monthKey(dateValue: string | Date) {
  const date = typeof dateValue === "string" ? dateValue.slice(0, 10) : dateValue.toISOString().slice(0, 10);
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(Number(year), Number(month) - 1, 1));
}

function vehicleMatchesStatus(vehicle: VehicleRecord, vehicleStatus?: string) {
  if (!vehicleStatus) return true;
  if (vehicleStatus === "retired") return vehicle.lifecycleStatus === "RETIRED";
  if (vehicleStatus === "in_shop") return vehicle.lifecycleStatus === "IN_SHOP" || vehicle.status === "maintenance";
  return vehicle.status === vehicleStatus;
}

export async function buildReportsAnalytics(rawFilters: ReportFilterInput): Promise<ReportsAnalytics> {
  const filters: ReportFilterInput = {
    from: getQueryValue(rawFilters.from),
    to: getQueryValue(rawFilters.to),
    vehicle: getQueryValue(rawFilters.vehicle),
    driver: getQueryValue(rawFilters.driver),
    tripStatus: getQueryValue(rawFilters.tripStatus),
    vehicleStatus: getQueryValue(rawFilters.vehicleStatus),
    maintenanceStatus: getQueryValue(rawFilters.maintenanceStatus),
  };

  const [drivers, trips, maintenance, fuel, expenses] = await Promise.all([
    prisma.driver.findMany({ orderBy: { fullName: "asc" } }),
    prisma.trip.findMany({ include: { driver: true }, orderBy: { startDate: "desc" } }),
    prisma.maintenanceRecord.findMany({ orderBy: { scheduledDate: "desc" } }),
    prisma.fuelRecord.findMany({ orderBy: { refueledAt: "desc" } }),
    prisma.expenseRecord.findMany({ orderBy: { expenseDate: "desc" } }),
  ]);

  const scopedVehicles = VEHICLES.filter((vehicle) => {
    if (filters.vehicle && vehicle.plateNumber !== filters.vehicle) return false;
    return vehicleMatchesStatus(vehicle, filters.vehicleStatus);
  });

  const scopedVehiclePlates = new Set(scopedVehicles.map((vehicle) => vehicle.plateNumber));

  const scopedTrips = trips.filter((trip) => {
    if (!scopedVehiclePlates.has(trip.vehiclePlateNumber)) return false;
    if (filters.driver && trip.driverId !== filters.driver) return false;
    if (filters.tripStatus && trip.status !== filters.tripStatus) return false;
    return inDateRange(trip.startDate, filters.from, filters.to);
  });

  const scopedMaintenance = maintenance.filter((record) => {
    if (!scopedVehiclePlates.has(record.vehiclePlateNumber)) return false;
    if (filters.maintenanceStatus && record.status !== filters.maintenanceStatus) return false;
    return inDateRange(record.scheduledDate, filters.from, filters.to);
  });

  const scopedFuel = fuel.filter((record) => {
    if (!scopedVehiclePlates.has(record.vehiclePlateNumber)) return false;
    if (record.status === "VOIDED") return false;
    return inDateRange(record.refueledAt, filters.from, filters.to);
  });

  const scopedExpenses = expenses.filter((record) => {
    if (record.vehiclePlateNumber && !scopedVehiclePlates.has(record.vehiclePlateNumber)) return false;
    if (record.status === "REJECTED") return false;
    return inDateRange(record.expenseDate, filters.from, filters.to);
  });

  const activeTripVehiclePlates = new Set(
    scopedTrips.filter((trip) => trip.status === "ACTIVE").map((trip) => trip.vehiclePlateNumber)
  );

  const totalFuelCost = scopedFuel.reduce((sum, record) => sum + record.totalCost, 0);
  const totalMaintenanceCost = scopedMaintenance.reduce((sum, record) => sum + record.cost, 0);
  const totalExpenseCost = scopedExpenses.reduce((sum, record) => sum + record.amount, 0);
  const totalOperationalCost = totalFuelCost + totalMaintenanceCost + totalExpenseCost;

  const availableVehicles = scopedVehicles.filter((vehicle) => vehicle.status === "available" && vehicle.lifecycleStatus === "ACTIVE").length;
  const vehiclesOnTrip = scopedVehicles.filter((vehicle) => activeTripVehiclePlates.has(vehicle.plateNumber)).length;
  const vehiclesInShop = scopedVehicles.filter((vehicle) => vehicle.lifecycleStatus === "IN_SHOP" || vehicle.status === "maintenance").length;
  const retiredVehicles = scopedVehicles.filter((vehicle) => vehicle.lifecycleStatus === "RETIRED").length;
  const activeFleet = scopedVehicles.filter((vehicle) => vehicle.lifecycleStatus !== "RETIRED").length;
  const assignedVehicles = scopedVehicles.filter((vehicle) => vehicle.status === "assigned" && vehicle.lifecycleStatus === "ACTIVE").length;
  const fleetUtilizationPct = activeFleet > 0 ? Math.round(((assignedVehicles + vehiclesOnTrip) / activeFleet) * 100) : 0;

  const completedDistance = scopedTrips.filter((trip) => trip.status === "COMPLETED").reduce((sum, trip) => sum + trip.distanceKm, 0);
  const totalLiters = scopedFuel.reduce((sum, record) => sum + record.liters, 0);
  const averageFuelEfficiency = totalLiters > 0 ? Math.round((completedDistance / totalLiters) * 10) / 10 : 0;

  const tripCountByVehicle = scopedTrips.reduce<Record<string, number>>((accumulator, trip) => {
    accumulator[trip.vehiclePlateNumber] = (accumulator[trip.vehiclePlateNumber] ?? 0) + 1;
    return accumulator;
  }, {});

  const maintenanceCostByVehicle = scopedMaintenance.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.vehiclePlateNumber] = (accumulator[record.vehiclePlateNumber] ?? 0) + record.cost;
    return accumulator;
  }, {});

  const tripCountByDriver = scopedTrips.reduce<Record<string, { name: string; count: number }>>((accumulator, trip) => {
    const current = accumulator[trip.driverId] ?? { name: trip.driver.fullName, count: 0 };
    current.count += 1;
    accumulator[trip.driverId] = current;
    return accumulator;
  }, {});

  const monthlyCosts = new Map<string, { fuel: number; maintenance: number; expenses: number }>();

  for (const record of scopedFuel) {
    const key = monthKey(record.refueledAt);
    const bucket = monthlyCosts.get(key) ?? { fuel: 0, maintenance: 0, expenses: 0 };
    bucket.fuel += record.totalCost;
    monthlyCosts.set(key, bucket);
  }

  for (const record of scopedMaintenance) {
    const key = monthKey(record.scheduledDate);
    const bucket = monthlyCosts.get(key) ?? { fuel: 0, maintenance: 0, expenses: 0 };
    bucket.maintenance += record.cost;
    monthlyCosts.set(key, bucket);
  }

  for (const record of scopedExpenses) {
    const key = monthKey(record.expenseDate);
    const bucket = monthlyCosts.get(key) ?? { fuel: 0, maintenance: 0, expenses: 0 };
    bucket.expenses += record.amount;
    monthlyCosts.set(key, bucket);
  }

  const monthlyOperationalTrend = [...monthlyCosts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, values]) => ({
      label: monthLabel(key),
      fuel: Math.round(values.fuel),
      maintenance: Math.round(values.maintenance),
      expenses: Math.round(values.expenses),
      total: Math.round(values.fuel + values.maintenance + values.expenses),
    }));

  const highestCostPeriod = monthlyOperationalTrend.reduce<NamedMetric | null>((best, item) => {
    if (!best || item.total > best.value) {
      return { label: item.label, value: item.total };
    }
    return best;
  }, null);

  const mostUsedVehicleEntry = Object.entries(tripCountByVehicle).sort(([, left], [, right]) => right - left)[0];
  const highestMaintenanceEntry = Object.entries(maintenanceCostByVehicle).sort(([, left], [, right]) => right - left)[0];
  const mostActiveDriverEntry = Object.values(tripCountByDriver).sort((left, right) => right.count - left.count)[0];

  const vehicleStatusDistribution: DistributionItem[] = [
    { label: "Available", value: scopedVehicles.filter((vehicle) => vehicle.status === "available").length, tone: "emerald" },
    { label: "Assigned", value: scopedVehicles.filter((vehicle) => vehicle.status === "assigned").length, tone: "indigo" },
    { label: "Maintenance", value: scopedVehicles.filter((vehicle) => vehicle.status === "maintenance").length, tone: "amber" },
    { label: "In Shop", value: scopedVehicles.filter((vehicle) => vehicle.lifecycleStatus === "IN_SHOP").length, tone: "rose" },
    { label: "Retired", value: retiredVehicles, tone: "slate" },
  ].filter((item) => item.value > 0);

  const tripStatusDistribution: DistributionItem[] = [
    { label: TRIP_STATUS_LABELS.SCHEDULED, value: scopedTrips.filter((trip) => trip.status === "SCHEDULED").length, tone: "amber" },
    { label: TRIP_STATUS_LABELS.ACTIVE, value: scopedTrips.filter((trip) => trip.status === "ACTIVE").length, tone: "indigo" },
    { label: TRIP_STATUS_LABELS.COMPLETED, value: scopedTrips.filter((trip) => trip.status === "COMPLETED").length, tone: "emerald" },
    { label: TRIP_STATUS_LABELS.CANCELLED, value: scopedTrips.filter((trip) => trip.status === "CANCELLED").length, tone: "rose" },
  ].filter((item) => item.value > 0);

  const fleetUtilization: DistributionItem[] = [
    { label: "Assigned", value: assignedVehicles, tone: "indigo" },
    { label: "On Trip", value: vehiclesOnTrip, tone: "cyan" },
    { label: "Available", value: availableVehicles, tone: "emerald" },
    { label: "In Shop", value: vehiclesInShop, tone: "amber" },
  ].filter((item) => item.value > 0);

  const driverStatusDistribution: DistributionItem[] = [
    { label: DRIVER_STATUS_LABELS.AVAILABLE, value: drivers.filter((driver) => driver.status === "AVAILABLE").length, tone: "emerald" },
    { label: DRIVER_STATUS_LABELS.ON_TRIP, value: drivers.filter((driver) => driver.status === "ON_TRIP").length, tone: "indigo" },
    { label: DRIVER_STATUS_LABELS.ON_LEAVE, value: drivers.filter((driver) => driver.status === "ON_LEAVE").length, tone: "amber" },
  ].filter((item) => item.value > 0);

  return {
    filters,
    kpis: {
      totalVehicles: scopedVehicles.length,
      availableVehicles,
      vehiclesOnTrip,
      vehiclesInShop,
      retiredVehicles,
      totalDrivers: drivers.length,
      activeTrips: scopedTrips.filter((trip) => trip.status === "ACTIVE").length,
      completedTrips: scopedTrips.filter((trip) => trip.status === "COMPLETED").length,
      totalFuelCost,
      totalMaintenanceCost,
      totalOperationalCost,
    },
    summaries: {
      fleetUtilizationPct,
      averageFuelEfficiency,
      mostUsedVehicle: mostUsedVehicleEntry
        ? { label: mostUsedVehicleEntry[0], value: mostUsedVehicleEntry[1], detail: `${mostUsedVehicleEntry[1]} trips` }
        : null,
      highestMaintenanceVehicle: highestMaintenanceEntry
        ? { label: highestMaintenanceEntry[0], value: highestMaintenanceEntry[1], detail: "Lifetime maintenance spend" }
        : null,
      highestCostPeriod,
      mostActiveDriver: mostActiveDriverEntry
        ? { label: mostActiveDriverEntry.name, value: mostActiveDriverEntry.count, detail: `${mostActiveDriverEntry.count} trips` }
        : null,
    },
    charts: {
      vehicleStatusDistribution,
      tripStatusDistribution,
      fleetUtilization,
      fuelVsMaintenance: [
        { label: "Fuel", fuel: totalFuelCost, maintenance: 0 },
        { label: "Maintenance", fuel: 0, maintenance: totalMaintenanceCost },
      ],
      monthlyOperationalTrend,
      driverStatusDistribution,
    },
    meta: {
      vehicleOptions: VEHICLES.map((vehicle) => ({ plateNumber: vehicle.plateNumber, model: vehicle.model })),
      driverOptions: drivers.map((driver) => ({ id: driver.id, fullName: driver.fullName })),
      generatedAt: new Date().toISOString(),
    },
  };
}

export function getVehicleStatusOptions() {
  return [
    { value: "all", label: "All statuses" },
    { value: "available", label: "Available" },
    { value: "assigned", label: "Assigned" },
    { value: "maintenance", label: "Maintenance" },
    { value: "in_shop", label: "In Shop" },
    { value: "retired", label: "Retired" },
  ];
}

export function getVehicleDisplayStatus(vehicle: VehicleRecord) {
  return getVehicleStatusLabel(vehicle);
}
