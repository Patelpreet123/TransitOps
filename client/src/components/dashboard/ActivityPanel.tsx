import type { DashboardFilters } from "../../types/dashboard";

interface ActivityPanelProps {
  filters: DashboardFilters;
}

const ACTIVITY_ITEMS = [
  { time: "2m ago", text: "Trip #1842 departed North depot", type: "trip" },
  { time: "14m ago", text: "Vehicle V-118 marked available", type: "vehicle" },
  { time: "28m ago", text: "Maintenance completed on Bus B-042", type: "maintenance" },
  { time: "41m ago", text: "Driver shift change — East corridor", type: "driver" },
  { time: "1h ago", text: "3 pending trips assigned in South", type: "trip" },
];

export function ActivityPanel({ filters }: ActivityPanelProps) {
  const filterLabel = [
    filters.vehicleType !== "all" ? filters.vehicleType : null,
    filters.region !== "all" ? filters.region : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="activity-panel">
      <div className="panel-heading">
        <h3>Recent Activity</h3>
        <p>{filterLabel ? `Filtered: ${filterLabel}` : "Latest fleet events"}</p>
      </div>

      <ul className="activity-list">
        {ACTIVITY_ITEMS.map((item, index) => (
          <li
            key={item.text}
            className={`activity-item type-${item.type}`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="activity-time">{item.time}</span>
            <span className="activity-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
