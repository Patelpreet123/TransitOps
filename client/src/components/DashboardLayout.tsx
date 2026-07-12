import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, type NavItem } from "../types";

interface DashboardLayoutProps {
  navItems: NavItem[];
}

export function DashboardLayout({ navItems }: DashboardLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>TransitOps</h1>
          <p>Smart Transport Operations</p>
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
              >
                {item.label}
              </NavLink>
            ) : (
              <span key={item.id} className="nav-link disabled" title="Coming soon">
                {item.label}
              </span>
            )
          )}
        </nav>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <strong>{user?.name}</strong>
            <span className="role-badge">{user ? ROLE_LABELS[user.role] : ""}</span>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void logout()}>
            Log out
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
