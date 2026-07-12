import { ROLE_LABELS } from "../../types";
import type { RoleDashboardConfig } from "../../types/dashboard";
import type { User } from "../../types";

interface DashboardHeaderProps {
  user: User;
  config: RoleDashboardConfig;
}

export function DashboardHeader({ user, config }: DashboardHeaderProps) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-text">
        <p className="dashboard-eyebrow">
          {dateLabel} · {ROLE_LABELS[user.role]}
        </p>
        <h1>{config.headline}</h1>
        <p className="dashboard-subtitle">{config.subheadline}</p>
      </div>

      <div className="dashboard-header-meta">
        <div className="status-pill live">
          <span className="status-dot" />
          Live data
        </div>
        <p className="welcome-name">Good to see you, {user.name.split(" ")[0]}</p>
      </div>
    </header>
  );
}
