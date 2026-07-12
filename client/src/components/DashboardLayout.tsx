import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, type NavItem } from "../types";
import { api } from "../lib/api";

interface DashboardLayoutProps {
  navItems: NavItem[];
}

function NavIcon({ id }: { id: string }) {
  const paths: Record<string, string> = {
    dashboard: "M4 6h16M4 12h16M4 18h10",
    fleet: "M3 13h2l1-4h12l1 4h2M7 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    drivers: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7a7 7 0 0 1 14 0",
    trips: "M5 12h14M12 5l7 7-7 7",
    vehicle: "M7 17h10M5 12h14M9 7h6",
    incidents: "M12 9v4m0 4h.01M10.3 3.6 2.5 17h19L13.7 3.6a1 1 0 0 0-1.7 0Z",
    compliance: "M9 12l2 2 4-4M7 20h10a2 2 0 0 0 2-2V8l-6-4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z",
    expenses: "M12 3v18M7 8h10M7 16h6",
    reports: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={paths[id] ?? paths.dashboard} />
    </svg>
  );
}

export function DashboardLayout({ navItems }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 16h16M6 12h12M8 8h8" />
            </svg>
          </div>
          <div>
            <h1>TransitOps</h1>
            <p>Smart Transport Operations</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) =>
            item.enabled ? (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={() => setMobileNavOpen(false)}
              >
                <NavIcon id={item.id} />
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <span key={item.id} className="nav-link disabled" title="Coming soon">
                <NavIcon id={item.id} />
                <span>{item.label}</span>
                <em className="soon-tag">Soon</em>
              </span>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-user">{user?.name}</p>
          <span className="role-badge">{user ? ROLE_LABELS[user.role] : ""}</span>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="topbar-title">
              <strong>Operations Dashboard</strong>
              <span className="muted">Real-time fleet overview</span>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-user hidden-mobile">
              <strong>{user?.name}</strong>
              <span className="role-badge">{user ? ROLE_LABELS[user.role] : ""}</span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function DashboardShell() {
  const [navItems, setNavItems] = useState<NavItem[]>([
    { id: "dashboard", label: "Dashboard", path: "/dashboard", enabled: true },
  ]);

  useEffect(() => {
    api
      .dashboardSummary()
      .then((summary) => setNavItems(summary.modules))
      .catch(() => {
        // Keep default nav if summary fails
      });
  }, []);

  return <DashboardLayout navItems={navItems} />;
}
