import type { ReportsAnalytics } from "../types/reports";

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportReportsCsv(analytics: ReportsAnalytics) {
  const rows: (string | number)[][] = [
    ["TransitOps Reports Export"],
    ["Generated At", analytics.meta.generatedAt],
    [],
    ["Fleet Overview KPIs"],
    ["Metric", "Value"],
    ["Total Vehicles", analytics.kpis.totalVehicles],
    ["Available Vehicles", analytics.kpis.availableVehicles],
    ["Vehicles On Trip", analytics.kpis.vehiclesOnTrip],
    ["Vehicles In Shop", analytics.kpis.vehiclesInShop],
    ["Retired Vehicles", analytics.kpis.retiredVehicles],
    ["Total Drivers", analytics.kpis.totalDrivers],
    ["Active Trips", analytics.kpis.activeTrips],
    ["Completed Trips", analytics.kpis.completedTrips],
    ["Total Fuel Cost", analytics.kpis.totalFuelCost],
    ["Total Maintenance Cost", analytics.kpis.totalMaintenanceCost],
    ["Total Operational Cost", analytics.kpis.totalOperationalCost],
    [],
    ["Report Summaries"],
    ["Fleet Utilization %", analytics.summaries.fleetUtilizationPct],
    ["Average Fuel Efficiency (km/L)", analytics.summaries.averageFuelEfficiency],
    ["Most Used Vehicle", analytics.summaries.mostUsedVehicle?.label ?? "N/A"],
    ["Highest Maintenance Vehicle", analytics.summaries.highestMaintenanceVehicle?.label ?? "N/A"],
    ["Highest Cost Period", analytics.summaries.highestCostPeriod?.label ?? "N/A"],
    ["Most Active Driver", analytics.summaries.mostActiveDriver?.label ?? "N/A"],
    [],
    ["Vehicle Status Distribution"],
    ["Status", "Count"],
    ...analytics.charts.vehicleStatusDistribution.map((item) => [item.label, item.value]),
    [],
    ["Trip Status Distribution"],
    ["Status", "Count"],
    ...analytics.charts.tripStatusDistribution.map((item) => [item.label, item.value]),
    [],
    ["Monthly Operational Trend"],
    ["Month", "Fuel", "Maintenance", "Expenses", "Total"],
    ...analytics.charts.monthlyOperationalTrend.map((item) => [item.label, item.fuel, item.maintenance, item.expenses, item.total]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`transitops-reports-${stamp}.csv`, csv, "text/csv;charset=utf-8;");
}

export function printReportsView() {
  window.print();
}
