import { KpiIcon } from "./KpiIcon";
import type { KpiDefinition } from "../../types/dashboard";

interface KpiCardProps {
  definition: KpiDefinition;
  value: number;
  highlighted?: boolean;
  delay?: number;
}

export function KpiCard({ definition, value, highlighted = false, delay = 0 }: KpiCardProps) {
  const formattedValue =
    definition.format === "percent" ? `${value}%` : value.toLocaleString();

  const trend = definition.trend;
  const trendLabel =
    trend !== undefined
      ? `${trend > 0 ? "+" : ""}${trend}% vs last week`
      : null;

  return (
    <article
      className={`kpi-card accent-${definition.accent}${highlighted ? " highlighted" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="kpi-card-top">
        <div className="kpi-icon-wrap">
          <KpiIcon icon={definition.icon} />
        </div>
        {trendLabel && (
          <span className={`kpi-trend${trend! < 0 ? " negative" : ""}`}>{trendLabel}</span>
        )}
      </div>

      <div className="kpi-card-body">
        <p className="kpi-label">{definition.label}</p>
        <p className="kpi-value">{formattedValue}</p>
      </div>

      <div className="kpi-card-glow" aria-hidden="true" />
    </article>
  );
}
