import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type VehicleRecord } from "../lib/api";

type StatusFilter = "all" | VehicleRecord["status"];
type TypeFilter = "all" | VehicleRecord["type"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMileage(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatusBadge({ status }: { status: VehicleRecord["status"] }) {
  return <span className={`registry-status status-${status}`}>{status}</span>;
}

export function VehicleRegistryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    api
      .vehicleRegistry()
      .then((response) => {
        if (isMounted) {
          setRecords(response.vehicles);
        }
      })
      .catch((fetchError) => {
        if (isMounted) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load vehicles");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
      const matchesType = typeFilter === "all" || vehicle.type === typeFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [vehicle.plateNumber, vehicle.model, vehicle.depot, vehicle.assignedDriver ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [query, records, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const available = records.filter((vehicle) => vehicle.status === "available").length;
    const assigned = records.filter((vehicle) => vehicle.status === "assigned").length;
    const maintenance = records.filter((vehicle) => vehicle.status === "maintenance").length;

    return { total, available, assigned, maintenance };
  }, [records]);

  if (!user) {
    return null;
  }

  if (user.role !== "FLEET_MANAGER") {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="dashboard-page vehicle-registry-page">
        <div className="vehicle-registry-hero skeleton-block skeleton-header" />
        <div className="registry-stats-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-block skeleton-kpi" />
          ))}
        </div>
        <div className="skeleton-block skeleton-panel" />
      </div>
    );
  }

  return (
    <div className="dashboard-page vehicle-registry-page">
      <section className="vehicle-registry-hero">
        <div>
          <p className="dashboard-eyebrow">Fleet Manager · Registry</p>
          <h1>Vehicle Registry</h1>
          <p className="dashboard-subtitle">
            View fleet units, assignments, depot placement, and service status from one place.
          </p>
        </div>

        <div className="registry-hero-meta">
          <div className="status-pill live">
            <span className="status-dot" />
            {stats.total} vehicles tracked
          </div>
          <p className="welcome-name">{error ? error : "Registry synced with operations"}</p>
        </div>
      </section>

      <section className="registry-stats-grid" aria-label="Vehicle registry summary">
        <article className="registry-stat-card">
          <span className="registry-stat-label">Total vehicles</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="registry-stat-card">
          <span className="registry-stat-label">Available</span>
          <strong>{stats.available}</strong>
        </article>
        <article className="registry-stat-card">
          <span className="registry-stat-label">Assigned</span>
          <strong>{stats.assigned}</strong>
        </article>
        <article className="registry-stat-card">
          <span className="registry-stat-label">In maintenance</span>
          <strong>{stats.maintenance}</strong>
        </article>
      </section>

      <section className="registry-toolbar">
        <label className="registry-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Plate, model, depot, driver"
          />
        </label>

        <label className="registry-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>

        <label className="registry-filter">
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
            <option value="all">All types</option>
            <option value="bus">Bus</option>
            <option value="van">Van</option>
            <option value="truck">Truck</option>
          </select>
        </label>
      </section>

      <section className="registry-table-card" aria-label="Vehicle registry table">
        <div className="panel-heading">
          <h3>Registry</h3>
          <p>{filteredRecords.length} matching vehicles</p>
        </div>

        <div className="registry-table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Depot</th>
                <th>Status</th>
                <th>Mileage</th>
                <th>Last service</th>
                <th>Next service</th>
                <th>Driver</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>
                    <strong>{vehicle.plateNumber}</strong>
                    <span>{vehicle.model}</span>
                  </td>
                  <td>{vehicle.type}</td>
                  <td>{vehicle.depot}</td>
                  <td>
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td>{formatMileage(vehicle.mileageKm)} km</td>
                  <td>{formatDate(vehicle.lastService)}</td>
                  <td>{formatDate(vehicle.nextService)}</td>
                  <td>{vehicle.assignedDriver ?? "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && <p className="registry-empty">No vehicles match the current filters.</p>}
      </section>
    </div>
  );
}