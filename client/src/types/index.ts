export const ROLES = [
  "FLEET_MANAGER",
  "DRIVER",
  "SAFETY_OFFICER",
  "FINANCIAL_ANALYST",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  FLEET_MANAGER: "Fleet Manager",
  DRIVER: "Driver",
  SAFETY_OFFICER: "Safety Officer",
  FINANCIAL_ANALYST: "Financial Analyst",
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface NavItem {
  id: string;
  label: string;
  path: string;
  enabled: boolean;
}

export interface DashboardSummary {
  welcomeMessage: string;
  role: Role;
  modules: NavItem[];
}
