import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ROLE_LABELS, type DashboardSummary } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .dashboardSummary()
      .then(setSummary)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!summary) {
    return <p>Loading dashboard...</p>;
  }

  return (
    <div className="dashboard-page">
      <h2>{summary.welcomeMessage}</h2>
      <p className="muted">
        Signed in as <strong>{user?.email}</strong> with the{" "}
        <strong>{user ? ROLE_LABELS[user.role] : ""}</strong> role.
      </p>

      <section className="card-grid">
        <article className="info-card">
          <h3>Your access level</h3>
          <p>
            Navigation and API routes are filtered by your role. Future modules
            (vehicles, trips, maintenance, fuel, reports) will appear here as
            they are built.
          </p>
        </article>

        <article className="info-card">
          <h3>Available soon</h3>
          <ul>
            {summary.modules
              .filter((item) => !item.enabled)
              .map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
