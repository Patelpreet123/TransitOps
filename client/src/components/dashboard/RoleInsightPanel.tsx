import type { RoleDashboardConfig } from "../../types/dashboard";
import type { FleetKpis } from "../../types/dashboard";

interface RoleInsightPanelProps {
  config: RoleDashboardConfig;
  kpis: FleetKpis;
}

export function RoleInsightPanel({ config, kpis }: RoleInsightPanelProps) {
  const highlights = [
    { label: "Active fleet", value: kpis.activeVehicles },
    { label: "On-duty drivers", value: kpis.driversOnDuty },
    { label: "Open trips", value: kpis.pendingTrips },
  ];

  return (
    <section className="insight-panel">
      <div className="panel-heading">
        <h3>{config.insightTitle}</h3>
        <p>Role-focused summary</p>
      </div>

      <p className="insight-body">{config.insightBody}</p>

      <div className="insight-stats">
        {highlights.map((item) => (
          <div key={item.label} className="insight-stat">
            <span className="insight-stat-value">{item.value}</span>
            <span className="insight-stat-label">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
