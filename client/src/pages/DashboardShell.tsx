import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { api } from "../lib/api";
import type { NavItem } from "../types";

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
