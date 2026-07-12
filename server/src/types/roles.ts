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

export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}
