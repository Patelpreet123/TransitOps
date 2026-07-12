import { Router } from "express";
import { buildReportsAnalytics, type ReportFilterInput } from "../lib/reportAnalytics.js";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

function getQueryParam(value: any): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

router.use(requireAuth, requireRoles("FLEET_MANAGER", "FINANCIAL_ANALYST"));

router.get("/analytics", async (req: AuthenticatedRequest, res) => {
  try {
    const filters: ReportFilterInput = {
      from: getQueryParam(req.query.from),
      to: getQueryParam(req.query.to),
      vehicle: getQueryParam(req.query.vehicle),
      driver: getQueryParam(req.query.driver),
      tripStatus: getQueryParam(req.query.tripStatus),
      vehicleStatus: getQueryParam(req.query.vehicleStatus),
      maintenanceStatus: getQueryParam(req.query.maintenanceStatus),
    };

    const analytics = await buildReportsAnalytics(filters);
    res.json({ analytics });
  } catch (error) {
    console.error("Failed to build reports analytics", error);
    res.status(500).json({ error: "Failed to load reports analytics" });
  }
});

export default router;
