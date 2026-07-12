import { FILTER_OPTIONS } from "../../data/mockDashboard";
import type { DashboardFilters } from "../../types/dashboard";

interface DashboardFiltersBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function DashboardFiltersBar({ filters, onChange }: DashboardFiltersBarProps) {
  function update<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const hasActiveFilters =
    filters.vehicleType !== "all" ||
    filters.status !== "all" ||
    filters.region !== "all";

  return (
    <section className="dashboard-filters">
      <div className="filters-header">
        <div>
          <h3>Filters</h3>
          <p>Refine fleet metrics by type, status, and region</p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-reset"
            onClick={() =>
              onChange({ vehicleType: "all", status: "all", region: "all" })
            }
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="filters-grid">
        <label className="filter-field">
          <span>Vehicle Type</span>
          <select
            value={filters.vehicleType}
            onChange={(e) =>
              update("vehicleType", e.target.value as DashboardFilters["vehicleType"])
            }
          >
            {FILTER_OPTIONS.vehicleType.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              update("status", e.target.value as DashboardFilters["status"])
            }
          >
            {FILTER_OPTIONS.status.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Region</span>
          <select
            value={filters.region}
            onChange={(e) =>
              update("region", e.target.value as DashboardFilters["region"])
            }
          >
            {FILTER_OPTIONS.region.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
