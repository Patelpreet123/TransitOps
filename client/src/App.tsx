import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { DashboardShell } from "./components/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ExpenseTrackingPage } from "./pages/ExpenseTrackingPage";
import { DriverManagementPage } from "./pages/DriverManagementPage";
import { FuelManagementPage } from "./pages/FuelManagementPage";
import { MaintenanceManagementPage } from "./pages/MaintenanceManagementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TripManagementPage } from "./pages/TripManagementPage";
import { VehicleRegistryPage } from "./pages/VehicleRegistryPage";

export function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/drivers" element={<DriverManagementPage />} />
          <Route path="/fuel" element={<FuelManagementPage />} />
          <Route path="/expenses" element={<ExpenseTrackingPage />} />
          <Route path="/maintenance" element={<MaintenanceManagementPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/trips" element={<TripManagementPage />} />
          <Route path="/vehicles" element={<VehicleRegistryPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
