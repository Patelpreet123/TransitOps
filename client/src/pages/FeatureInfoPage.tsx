import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../types";

export function FeatureInfoPage() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  let title = "Feature Information";
  let subtitle = "System Status";
  let message = "This section is monitored and maintained by your fleet administration.";
  let detail = "Continuous tracking is active. Real-time updates will reflect automatically.";
  let iconPath = "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"; // Shield

  if (path === "/vehicle") {
    title = "My Vehicle Assignment";
    subtitle = "Fleet Status";
    message = "No active vehicle assigned to your current shift.";
    detail = "You are listed as standby on-duty. Once a fleet manager assigns a vehicle to your trip, its plate number, capacity, and route registry will display here.";
    iconPath = "M4 7h12l4 5v5H4zM8 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"; // Vehicle
  } else if (path === "/incidents") {
    title = "Incident Log";
    subtitle = "Safety Monitoring";
    message = "No safety incidents reported in the last 30 days.";
    detail = "The safety and hazard tracking system reports a clean record. Emergency response alerts and vehicle collisions are monitored automatically in real-time.";
    iconPath = "M12 9v4m0 4h.01M10.3 3.6 2.5 17h19L13.7 3.6a1 1 0 0 0-1.7 0Z"; // Warning
  } else if (path === "/compliance") {
    title = "Compliance Status";
    subtitle = "Regulatory Audit";
    message = "All fleet credentials and driver certifications are up to date.";
    detail = "ELD logging, rest breaks, and vehicle inspection records (DVIR) have been fully validated. No pending compliance issues require attention.";
    iconPath = "M9 12l2 2 4-4M7 20h10a2 2 0 0 0 2-2V8l-6-4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"; // Clipboard check
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-text">
          <p className="dashboard-eyebrow">{ROLE_LABELS[user?.role ?? "FLEET_MANAGER"]} Workspace</p>
          <h1>{title}</h1>
          <p className="dashboard-subtitle">{subtitle} overview and details.</p>
        </div>
      </header>

      <section className="registry-table-card" style={{ padding: "4rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--color-primary-soft)", color: "var(--color-primary)", display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "32px", height: "32px" }}>
            <path d={iconPath} />
          </svg>
        </div>
        <div style={{ maxWidth: "500px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--color-text)", margin: "0 0 0.5rem" }}>{message}</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", lineHeight: "1.6", margin: 0 }}>{detail}</p>
        </div>
      </section>
    </div>
  );
}
