import type { KpiDefinition } from "../../types/dashboard";

interface KpiIconProps {
  icon: KpiDefinition["icon"];
}

export function KpiIcon({ icon }: KpiIconProps) {
  switch (icon) {
    case "vehicles":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 13h1.5l1.2-4.5A2 2 0 0 1 7.6 7h8.8a2 2 0 0 1 1.9 1.5L19.5 13H21" />
          <circle cx="7.5" cy="17" r="1.5" />
          <circle cx="16.5" cy="17" r="1.5" />
          <path d="M5 13h14v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-3z" />
        </svg>
      );
    case "available":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "maintenance":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-3.3-3.3 2.1-2.1z" />
        </svg>
      );
    case "trips":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16M4 12h10M4 18h14" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      );
    case "pending":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "drivers":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M14 19c0-2.2 1.8-4 4-4" />
        </svg>
      );
    case "utilization":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-4 3 2 4-6" />
        </svg>
      );
    default:
      return null;
  }
}
