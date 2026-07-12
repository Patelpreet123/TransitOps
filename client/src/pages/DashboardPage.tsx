import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ActivityPanel } from "../components/dashboard/ActivityPanel";
import { DashboardFiltersBar } from "../components/dashboard/DashboardFilters";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { KpiCard } from "../components/dashboard/KpiCard";
import { RoleInsightPanel } from "../components/dashboard/RoleInsightPanel";
import { UtilizationGauge } from "../components/dashboard/UtilizationGauge";
import {
  DEFAULT_FILTERS,
  getFleetKpis,
  getRoleConfig,
  KPI_DEFINITIONS,
} from "../data/mockDashboard";
import type { DashboardFilters } from "../types/dashboard";

export function DashboardPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 480);
    return () => window.clearTimeout(timer);
  }, []);

  const roleConfig = useMemo(
    () => (user ? getRoleConfig(user.role) : null),
    [user]
  );

  const kpis = useMemo(() => getFleetKpis(filters), [filters]);

  const sortedKpis = useMemo(() => {
    if (!roleConfig) return KPI_DEFINITIONS;

    const primary = new Set(roleConfig.primaryKpis);
    return [
      ...KPI_DEFINITIONS.filter((kpi) => primary.has(kpi.id)),
      ...KPI_DEFINITIONS.filter((kpi) => !primary.has(kpi.id)),
    ];
  }, [roleConfig]);

  if (!user || !roleConfig) {
    return null;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-page">
      <DashboardHeader user={user} config={roleConfig} />

      <DashboardFiltersBar filters={filters} onChange={setFilters} />

      <section className="kpi-grid" aria-label="Fleet KPI metrics">
        {sortedKpis.map((definition, index) => (
          <KpiCard
            key={definition.id}
            definition={definition}
            value={kpis[definition.id]}
            highlighted={roleConfig.primaryKpis.includes(definition.id)}
            delay={index * 50}
          />
        ))}
      </section>

      <section className="dashboard-bottom-grid">
        <UtilizationGauge value={kpis.fleetUtilization} />
        <RoleInsightPanel config={roleConfig} kpis={kpis} />
        <ActivityPanel filters={filters} />
      </section>
    </div>
  );
}
