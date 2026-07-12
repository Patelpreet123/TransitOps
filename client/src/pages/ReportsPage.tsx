import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type ExpenseRecord, type FuelRecord, type TripRecord, type VehicleRecord } from "../lib/api";
import type { MaintenanceRecord } from "../types/maintenance";

type RoleScope = "FLEET_MANAGER" | "FINANCIAL_ANALYST";

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

interface AnalyticsState {
  vehicles: VehicleRecord[];
  trips: TripRecord[];
  maintenance: MaintenanceRecord[];
  fuel: FuelRecord[];
  expenses: ExpenseRecord[];
}

const EMPTY_STATE: AnalyticsState = {
  vehicles: [],
  trips: [],
  maintenance: [],
  fuel: [],
  expenses: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function StatusBadge({ tone, label }: { tone: string; label: string }) {
  return <span className={`report-status status-${tone}`}>{label}</span>;
}

function CardShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="report-card">
      <div className="panel-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function BarChart({ data, colorClass, valueLabel }: { data: Array<{ label: string; value: number }>; colorClass: string; valueLabel?: (value: number) => string }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-wrap bar-chart">
      {data.map((item) => (
        <div key={item.label} className="chart-row">
          <div className="chart-row-label">
            <span>{item.label}</span>
            <strong>{valueLabel ? valueLabel(item.value) : formatNumber(item.value)}</strong>
          </div>
          <div className="chart-row-track">
            <div className={`chart-row-fill ${colorClass}`} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, totalLabel, centerLabel }: { data: Array<{ label: string; value: number; tone: string }>; totalLabel: string; centerLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <div className="donut-chart-container">
        <svg viewBox="0 0 140 140" className="donut-svg" aria-label={centerLabel} role="img">
          <circle className="donut-track" cx="70" cy="70" r={radius} />
          {data.map((item) => {
            const segment = (item.value / total) * circumference;
            const dashArray = `${segment} ${circumference - segment}`;
            const dashOffset = -offset;
            offset += segment;

            return (
              <circle
                key={item.label}
                className={`donut-segment tone-${item.tone}`}
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>

        <div className="donut-center">
          <strong>{totalLabel}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>

      <div className="chart-legend">
        {data.map((item) => (
          <div key={item.label} className="chart-legend-item">
            <span className={`legend-swatch ${item.tone}`} />
            <span>{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const width = 320;
  const height = 140;
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height - (item.value / max) * (height - 18) - 9;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" aria-label="Trend chart" role="img">
        <path className="line-chart-grid" d={`M0 ${height - 10}H${width}`} />
        <path className="line-chart-path" d={path} />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="line-chart-dot" cx={point.x} cy={point.y} r="4" />
            <text className="line-chart-label" x={point.x} y={height - 2} textAnchor="middle">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsState>(EMPTY_STATE);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
    setToasts((current) => [...current, { id, tone, message }]);
  };

  useEffect(() => {
    let active = true;

    Promise.all([api.vehicleRegistry(), api.trips(), api.maintenance(), api.fuel(), api.expenses()])
      .then(([vehicles, trips, maintenance, fuel, expenses]) => {
        if (!active) return;
        setData({ vehicles: vehicles.vehicles, trips: trips.trips, maintenance: maintenance.maintenance, fuel: fuel.fuel, expenses: expenses.expenses });
      })
      .catch((fetchError) => {
        if (!active) return;
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load reports";
        setError(message);
        pushToast("error", message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const totalVehicles = data.vehicles.length;
    const activeVehicles = data.vehicles.filter((vehicle) => vehicle.lifecycleStatus === "ACTIVE").length;
    const availableVehicles = data.vehicles.filter((vehicle) => vehicle.status === "available").length;
    const vehiclesInMaintenance = data.vehicles.filter((vehicle) => vehicle.status === "maintenance" || vehicle.lifecycleStatus === "IN_SHOP").length;
    const fleetUtilization = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
    const maintenanceOpen = data.maintenance.filter((record) => record.status === "SCHEDULED" || record.status === "IN_PROGRESS").length;
    const fuelCost = data.fuel.reduce((sum, record) => sum + record.totalCost, 0);
    const fuelLiters = data.fuel.reduce((sum, record) => sum + record.liters, 0);
    const expenseTotal = data.expenses.reduce((sum, record) => sum + record.amount, 0);
    const tripActive = data.trips.filter((trip) => trip.status === "ACTIVE").length;
    const tripCompleted = data.trips.filter((trip) => trip.status === "COMPLETED").length;
    const tripPending = data.trips.filter((trip) => trip.status === "SCHEDULED").length;

    return {
      totalVehicles,
      activeVehicles,
      availableVehicles,
      vehiclesInMaintenance,
      fleetUtilization,
      maintenanceOpen,
      fuelCost,
      fuelLiters,
      expenseTotal,
      tripActive,
      tripCompleted,
      tripPending,
    };
  }, [data]);

  const vehicleStatusDistribution = useMemo(
    () => [
      { label: "Available", value: data.vehicles.filter((vehicle) => vehicle.status === "available").length, tone: "emerald" },
      { label: "Assigned", value: data.vehicles.filter((vehicle) => vehicle.status === "assigned").length, tone: "indigo" },
      { label: "Maintenance", value: data.vehicles.filter((vehicle) => vehicle.status === "maintenance").length, tone: "amber" },
    ],
    [data]
  );

  const maintenanceDistribution = useMemo(
    () => [
      { label: "Scheduled", value: data.maintenance.filter((item) => item.status === "SCHEDULED").length, tone: "amber" },
      { label: "In Progress", value: data.maintenance.filter((item) => item.status === "IN_PROGRESS").length, tone: "indigo" },
      { label: "Completed", value: data.maintenance.filter((item) => item.status === "COMPLETED").length, tone: "emerald" },
      { label: "Cancelled", value: data.maintenance.filter((item) => item.status === "CANCELLED").length, tone: "rose" },
    ],
    [data]
  );

  const fuelUsageByVehicle = useMemo(
    () =>
      [...Object.entries(
        data.fuel.reduce<Record<string, number>>((accumulator, record) => {
          accumulator[record.vehiclePlateNumber] = (accumulator[record.vehiclePlateNumber] ?? 0) + record.liters;
          return accumulator;
        }, {})
      )]
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 5),
    [data]
  );

  const expenseByCategory = useMemo(
    () =>
      [...Object.entries(
        data.expenses.reduce<Record<string, number>>((accumulator, record) => {
          accumulator[record.category] = (accumulator[record.category] ?? 0) + record.amount;
          return accumulator;
        }, {})
      )]
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value),
    [data]
  );

  const tripStats = useMemo(
    () => [
      { label: "Active", value: data.trips.filter((trip) => trip.status === "ACTIVE").length },
      { label: "Scheduled", value: data.trips.filter((trip) => trip.status === "SCHEDULED").length },
      { label: "Completed", value: data.trips.filter((trip) => trip.status === "COMPLETED").length },
      { label: "Cancelled", value: data.trips.filter((trip) => trip.status === "CANCELLED").length },
    ],
    [data]
  );

  const monthlyActivity = useMemo(
    () =>
      data.trips.slice(0, 5).map((trip) => ({
        label: formatShortDate(trip.startDate),
        value: trip.distanceKm,
      })),
    [data]
  );

  if (!user) return null;

  const allowed: RoleScope[] = ["FLEET_MANAGER", "FINANCIAL_ANALYST"];
  if (!allowed.includes(user.role as RoleScope)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="dashboard-page reports-page">
        <div className="reports-hero skeleton-block skeleton-header" />
        <div className="reports-kpi-grid">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton-block skeleton-kpi" />)}
        </div>
        <div className="reports-grid">
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page reports-page">
      <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
        {toasts.map((toast) => (
          <button key={toast.id} type="button" className={`toast toast-${toast.tone}`} onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
            <span>{toast.message}</span>
          </button>
        ))}
      </div>

      <section className="reports-hero">
        <div>
          <p className="dashboard-eyebrow">Reports and analytics</p>
          <h1>Fleet Performance Analytics</h1>
          <p className="dashboard-subtitle">Fleet utilization, vehicle distribution, maintenance load, fuel usage, expense flow, and trip stats in one responsive view.</p>
        </div>
        <div className="reports-hero-meta">
          <div className="status-pill live"><span className="status-dot" />Live operational data</div>
          <p className="welcome-name">{error || `Loaded ${formatNumber(kpis.totalVehicles)} vehicles and ${formatNumber(data.trips.length)} trips`}</p>
        </div>
      </section>

      <section className="reports-kpi-grid" aria-label="Analytics summary">
        <article className="report-kpi-card"><span>Fleet utilization</span><strong>{kpis.fleetUtilization}%</strong><small>{kpis.activeVehicles} active of {kpis.totalVehicles} vehicles</small></article>
        <article className="report-kpi-card"><span>Maintenance open</span><strong>{kpis.maintenanceOpen}</strong><small>{kpis.vehiclesInMaintenance} vehicles in shop or maintenance</small></article>
        <article className="report-kpi-card"><span>Fuel cost</span><strong>{formatCurrency(kpis.fuelCost)}</strong><small>{formatNumber(kpis.fuelLiters)} liters recorded</small></article>
        <article className="report-kpi-card"><span>Expense total</span><strong>{formatCurrency(kpis.expenseTotal)}</strong><small>{data.expenses.length} expense entries</small></article>
        <article className="report-kpi-card"><span>Active trips</span><strong>{kpis.tripActive}</strong><small>{kpis.tripCompleted} completed trips</small></article>
        <article className="report-kpi-card"><span>Available fleet</span><strong>{kpis.availableVehicles}</strong><small>{data.vehicles.length > 0 ? Math.round((kpis.availableVehicles / data.vehicles.length) * 100) : 0}% available</small></article>
      </section>

      <section className="reports-grid">
        <CardShell title="Fleet Utilization" subtitle="Capacity versus fleet demand">
          <div className="utilization-mini">
            <div className="utilization-ring">
              <div className="utilization-ring-inner">
                <strong>{kpis.fleetUtilization}%</strong>
                <span>Utilization</span>
              </div>
              <svg viewBox="0 0 120 120" className="utilization-ring-svg" aria-hidden="true">
                <circle cx="60" cy="60" r="48" className="utilization-ring-track" />
                <circle cx="60" cy="60" r="48" className="utilization-ring-progress" style={{ strokeDasharray: 301.59289474462014, strokeDashoffset: 301.59289474462014 - (kpis.fleetUtilization / 100) * 301.59289474462014 }} />
              </svg>
            </div>
            <div className="mini-legend">
              <StatusBadge tone="emerald" label="Healthy capacity" />
              <StatusBadge tone={kpis.fleetUtilization > 85 ? "rose" : "amber"} label={kpis.fleetUtilization > 85 ? "High load" : "Balanced load"} />
            </div>
          </div>
        </CardShell>

        <CardShell title="Vehicle Status Distribution" subtitle="Operational breakdown by status">
          <DonutChart data={vehicleStatusDistribution} totalLabel={formatNumber(data.vehicles.length)} centerLabel="Vehicles" />
        </CardShell>

        <CardShell title="Maintenance Overview" subtitle="Current maintenance queue">
          <BarChart data={maintenanceDistribution} colorClass="fill-amber" valueLabel={formatNumber} />
        </CardShell>

        <CardShell title="Fuel Usage Summary" subtitle="Fuel volume by vehicle">
          <BarChart data={fuelUsageByVehicle} colorClass="fill-cyan" valueLabel={(value) => `${formatNumber(value)} L`} />
        </CardShell>

        <CardShell title="Expense Summary" subtitle="Spend by category">
          <BarChart data={expenseByCategory} colorClass="fill-indigo" valueLabel={(value) => formatCurrency(value)} />
        </CardShell>

        <CardShell title="Trip Statistics" subtitle="Trip lifecycle and distance trend">
          <div className="trip-stats-wrap">
            <div className="trip-stat-chip-row">
              {tripStats.map((item) => (
                <div key={item.label} className="trip-stat-chip">
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value)}</strong>
                </div>
              ))}
            </div>
            <LineChart data={monthlyActivity} />
          </div>
        </CardShell>

        <CardShell title="Recent Exceptions" subtitle="What needs attention">
          <div className="exceptions-list">
            <div className="exception-item"><strong>{data.maintenance.filter((item) => item.status === "SCHEDULED").length}</strong><span>scheduled maintenance items</span></div>
            <div className="exception-item"><strong>{data.fuel.filter((item) => item.status === "VOIDED").length}</strong><span>voided fuel logs</span></div>
            <div className="exception-item"><strong>{data.expenses.filter((item) => item.status === "PENDING").length}</strong><span>pending expenses</span></div>
          </div>
        </CardShell>
      </section>
    </div>
  );
}