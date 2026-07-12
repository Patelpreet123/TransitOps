export function DashboardSkeleton() {
  return (
    <div className="dashboard-page skeleton-page">
      <div className="skeleton-block skeleton-header" />

      <div className="skeleton-block skeleton-filters" />

      <div className="kpi-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton-block skeleton-kpi" />
        ))}
      </div>

      <div className="dashboard-bottom-grid">
        <div className="skeleton-block skeleton-panel" />
        <div className="skeleton-block skeleton-panel" />
        <div className="skeleton-block skeleton-panel wide" />
      </div>
    </div>
  );
}
