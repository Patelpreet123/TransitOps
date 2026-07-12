import { Router } from "express";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { ROLE_LABELS, type Role } from "../types/roles.js";

const router = Router();

router.get("/summary", requireAuth, (req: AuthenticatedRequest, res) => {
  const role = req.user!.role;

  res.json({
    welcomeMessage: `Welcome, ${ROLE_LABELS[role]}`,
    role,
    modules: getModulesForRole(role),
  });
});

router.get(
  "/fleet",
  requireAuth,
  requireRoles("FLEET_MANAGER"),
  (_req, res) => {
    res.json({ message: "Fleet management module coming soon" });
  }
);

router.get(
  "/driver",
  requireAuth,
  requireRoles("DRIVER"),
  (_req, res) => {
    res.json({ message: "Driver module coming soon" });
  }
);

router.get(
  "/safety",
  requireAuth,
  requireRoles("SAFETY_OFFICER"),
  (_req, res) => {
    res.json({ message: "Safety module coming soon" });
  }
);

router.get(
  "/finance",
  requireAuth,
  requireRoles("FINANCIAL_ANALYST"),
  (_req, res) => {
    res.json({ message: "Finance module coming soon" });
  }
);

function getModulesForRole(role: Role) {
  const common = [{ id: "dashboard", label: "Dashboard", path: "/dashboard", enabled: true }];

  switch (role) {
    case "FLEET_MANAGER":
      return [
        ...common,
        { id: "vehicles", label: "Vehicle Registry", path: "/vehicles", enabled: true },
        { id: "drivers", label: "Driver Management", path: "/drivers", enabled: true },
        { id: "trips", label: "Trip Management", path: "/trips", enabled: true },
      ];
    case "DRIVER":
      return [
        ...common,
        { id: "trips", label: "My Trips", path: "/trips", enabled: false },
        { id: "vehicle", label: "My Vehicle", path: "/vehicle", enabled: false },
      ];
    case "SAFETY_OFFICER":
      return [
        ...common,
        { id: "incidents", label: "Incidents", path: "/incidents", enabled: false },
        { id: "compliance", label: "Compliance", path: "/compliance", enabled: false },
      ];
    case "FINANCIAL_ANALYST":
      return [
        ...common,
        { id: "expenses", label: "Expenses", path: "/expenses", enabled: false },
        { id: "reports", label: "Reports", path: "/reports", enabled: false },
      ];
    default:
      return common;
  }
}

export default router;
