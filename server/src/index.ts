import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import driverRoutes from "./routes/drivers.js";
import tripRoutes from "./routes/trips.js";
import vehicleRoutes from "./routes/vehicles.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/vehicles", vehicleRoutes);

app.listen(PORT, () => {
  console.log(`TransitOps API running at http://localhost:${PORT}`);
});
