import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type VehicleRecord } from "../lib/api";
import { DRIVER_STATUS_LABELS, type DriverRecord } from "../types/drivers";
import {
  TRIP_STATUS_LABELS,
  type TripPayload,
  type TripRecord,
  type TripStatus,
  type TripSummary,
} from "../types/trips";

type SortField = "startDate" | "endDate" | "status" | "source" | "destination" | "vehicle" | "driver" | "cargoWeightKg" | "distanceKm";
type SortDirection = "desc" | "asc";

interface TripFormState {
  vehiclePlateNumber: string;
  driverId: string;
  source: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: string;
  distanceKm: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
}

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

const EMPTY_FORM: TripFormState = {
  vehiclePlateNumber: "",
  driverId: "",
  source: "",
  destination: "",
  cargoDescription: "",
  cargoWeightKg: "",
  distanceKm: "",
  startDate: "",
  endDate: "",
  status: "SCHEDULED",
};

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toFormState(trip: TripRecord): TripFormState {
  return {
    vehiclePlateNumber: trip.vehiclePlateNumber,
    driverId: trip.driver.id,
    source: trip.source,
    destination: trip.destination,
    cargoDescription: trip.cargoDescription,
    cargoWeightKg: String(trip.cargoWeightKg),
    distanceKm: String(trip.distanceKm),
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrencyLikeWeight(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function StatusBadge({ status }: { status: TripStatus }) {
  return <span className={`trip-status status-${status}`}>{TRIP_STATUS_LABELS[status]}</span>;
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className={`toast toast-${toast.tone}`} onClick={() => onDismiss(toast.id)}>
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
}

export function TripManagementPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [summary, setSummary] = useState<TripSummary>({
    total: 0,
    scheduled: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    totalCargoKg: 0,
    totalDistanceKm: 0,
  });
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TripStatus>("all");
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TripFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);

    setToasts((current) => [...current, { id, tone, message }]);
  };

  const loadOptions = async () => {
    try {
      const [driverResponse, vehicleResponse] = await Promise.all([api.drivers(), api.vehicleRegistry()]);
      setDrivers(driverResponse.drivers);
      setVehicles(vehicleResponse.vehicles);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load form options");
      pushToast("error", error instanceof Error ? error.message : "Failed to load form options");
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadTrips = async () => {
    try {
      setLoadingTrips(true);
      setPageError("");
      const response = await api.trips({
        search,
        status: statusFilter === "all" ? undefined : statusFilter,
        sortBy: sortField,
        sortOrder: sortDirection,
      });
      setTrips(response.trips);
      setSummary(response.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load trips";
      setPageError(message);
      pushToast("error", message);
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [search, statusFilter, sortDirection, sortField]);

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({ ...vehicle, disabled: vehicle.lifecycleStatus === "RETIRED" || vehicle.lifecycleStatus === "IN_SHOP" })),
    [vehicles]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.plateNumber === form.vehiclePlateNumber) ?? null,
    [form.vehiclePlateNumber, vehicles]
  );

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === form.driverId) ?? null,
    [drivers, form.driverId]
  );

  const validationMessage = useMemo(() => {
    if (!form.vehiclePlateNumber) return "Vehicle is required";
    if (!form.driverId) return "Driver is required";
    if (!form.source.trim()) return "Source is required";
    if (!form.destination.trim()) return "Destination is required";
    if (!form.cargoDescription.trim()) return "Cargo description is required";

    const weight = Number(form.cargoWeightKg);
    if (!Number.isFinite(weight) || weight <= 0) return "Cargo weight must be greater than zero";

    const distance = Number(form.distanceKm);
    if (!Number.isFinite(distance) || distance <= 0) return "Distance must be greater than zero";

    if (!form.startDate) return "Start date is required";
    if (!form.endDate) return "End date is required";
    if (new Date(form.endDate).getTime() < new Date(form.startDate).getTime()) return "End date must be on or after start date";

    if (!selectedVehicle) return "Selected vehicle is unavailable";
    if (selectedVehicle.lifecycleStatus === "RETIRED") return "Retired vehicles cannot be assigned";
    if (selectedVehicle.lifecycleStatus === "IN_SHOP") return "Vehicles in shop cannot be assigned";
    if (weight > selectedVehicle.capacityKg) {
      return `Cargo weight exceeds ${selectedVehicle.capacityKg} kg capacity for this vehicle`;
    }

    if (!selectedDriver) return "Selected driver is unavailable";
    if (selectedDriver.status === "ON_LEAVE") return "Drivers on leave cannot be assigned to trips";

    return "";
  }, [form, selectedDriver, selectedVehicle]);

  if (!user) {
    return null;
  }

  if (user.role !== "FLEET_MANAGER") {
    return <Navigate to="/dashboard" replace />;
  }

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const refreshAll = async () => {
    await Promise.all([loadTrips(), loadOptions()]);
  };

  const startEdit = (trip: TripRecord) => {
    setEditingId(trip.id);
    setForm(toFormState(trip));
    setFormError("");
    pushToast("info", `Editing trip from ${trip.source}`);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (validationMessage) {
      setFormError(validationMessage);
      pushToast("error", validationMessage);
      return;
    }

    setSaving(true);

    try {
      const payload: TripPayload = {
        vehiclePlateNumber: form.vehiclePlateNumber,
        driverId: form.driverId,
        source: form.source.trim(),
        destination: form.destination.trim(),
        cargoDescription: form.cargoDescription.trim(),
        cargoWeightKg: Number(form.cargoWeightKg),
        distanceKm: Number(form.distanceKm),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
      };

      if (editingId) {
        await api.updateTrip(editingId, payload);
        pushToast("success", "Trip updated successfully");
      } else {
        await api.createTrip(payload);
        pushToast("success", "Trip created successfully");
      }

      resetForm();
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Trip save failed";
      setFormError(message);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (trip: TripRecord) => {
    const confirmed = window.confirm(`Delete trip from ${trip.source} to ${trip.destination}?`);
    if (!confirmed) return;

    try {
      await api.deleteTrip(trip.id);
      pushToast("success", "Trip deleted");
      if (editingId === trip.id) resetForm();
      await refreshAll();
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Delete failed");
    }
  };

  const onDismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    window.clearTimeout(id);
  };

  if (loadingTrips || loadingOptions) {
    return (
      <div className="dashboard-page trip-page">
        <div className="trip-hero skeleton-block skeleton-header" />
        <div className="trip-stats-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton-block skeleton-kpi" />
          ))}
        </div>
        <div className="trip-layout-grid">
          <div className="skeleton-block skeleton-panel trip-form-skeleton" />
          <div className="skeleton-block skeleton-panel trip-table-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page trip-page">
      <ToastStack toasts={toasts} onDismiss={onDismissToast} />

      <section className="trip-hero">
        <div>
          <p className="dashboard-eyebrow">Fleet Manager · Trips</p>
          <h1>Trip Management</h1>
          <p className="dashboard-subtitle">
            Create and manage trips with vehicle capacity, driver assignment, and status controls.
          </p>
        </div>

        <div className="trip-hero-meta">
          <div className="status-pill live">
            <span className="status-dot" />
            {summary.total} trips tracked
          </div>
          <p className="welcome-name">{pageError || (editingId ? "Editing a trip" : "Trip operations ready")}</p>
        </div>
      </section>

      <section className="trip-stats-grid" aria-label="Trip summary">
        <article className="trip-stat-card"><span>Total</span><strong>{summary.total}</strong></article>
        <article className="trip-stat-card"><span>Scheduled</span><strong>{summary.scheduled}</strong></article>
        <article className="trip-stat-card"><span>Active</span><strong>{summary.active}</strong></article>
        <article className="trip-stat-card"><span>Completed</span><strong>{summary.completed}</strong></article>
        <article className="trip-stat-card"><span>Cancelled</span><strong>{summary.cancelled}</strong></article>
      </section>

      <section className="trip-toolbar">
        <label className="trip-toolbar-field trip-search">
          <span>Search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Source, destination, cargo, driver, vehicle" />
        </label>

        <label className="trip-toolbar-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TripStatus)}>
            <option value="all">All statuses</option>
            {Object.entries(TRIP_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="trip-toolbar-field">
          <span>Sort by</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
            <option value="startDate">Start date</option>
            <option value="endDate">End date</option>
            <option value="status">Status</option>
            <option value="source">Source</option>
            <option value="destination">Destination</option>
            <option value="vehicle">Vehicle</option>
            <option value="driver">Driver</option>
            <option value="cargoWeightKg">Cargo weight</option>
            <option value="distanceKm">Distance</option>
          </select>
        </label>

        <button type="button" className="btn-secondary trip-sort-toggle" onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}>
          {sortDirection === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </section>

      <section className="trip-layout-grid">
        <form className="trip-form-card" onSubmit={(event) => void submitForm(event)}>
          <div className="panel-heading">
            <h3>{editingId ? "Edit Trip" : "Create Trip"}</h3>
            <p>Validated route form with vehicle capacity and driver availability checks.</p>
          </div>

          <div className="trip-form-grid">
            <label>
              Vehicle
              <select value={form.vehiclePlateNumber} onChange={(event) => setForm({ ...form, vehiclePlateNumber: event.target.value })} required>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plateNumber} disabled={vehicle.disabled}>
                    {vehicle.plateNumber} · {vehicle.model} · {formatCurrencyLikeWeight(vehicle.capacityKg)} kg{vehicle.disabled ? " (unavailable)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Driver
              <select value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })} required>
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id} disabled={driver.status === "ON_LEAVE"}>
                    {driver.fullName} · {DRIVER_STATUS_LABELS[driver.status]}{driver.status === "ON_LEAVE" ? " (unavailable)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Source
              <input type="text" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="North Depot" required />
            </label>

            <label>
              Destination
              <input type="text" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="East Terminal" required />
            </label>

            <label className="trip-wide-field">
              Cargo description
              <textarea value={form.cargoDescription} onChange={(event) => setForm({ ...form, cargoDescription: event.target.value })} placeholder="Passenger transfer or freight manifest" rows={3} required />
            </label>

            <label>
              Cargo weight (kg)
              <input type="number" min="0.1" step="0.1" value={form.cargoWeightKg} onChange={(event) => setForm({ ...form, cargoWeightKg: event.target.value })} placeholder="4800" required />
            </label>

            <label>
              Distance (km)
              <input type="number" min="0.1" step="0.1" value={form.distanceKm} onChange={(event) => setForm({ ...form, distanceKm: event.target.value })} placeholder="42.5" required />
            </label>

            <label>
              Start date
              <input type="date" min={todayIsoDate()} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
            </label>

            <label>
              End date
              <input type="date" min={form.startDate || todayIsoDate()} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required />
            </label>

            <label className="trip-wide-field">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TripStatus })}>
                {Object.entries(TRIP_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError && <p className="error trip-form-error">{formError}</p>}

          <div className="trip-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (editingId ? "Saving trip..." : "Creating trip...") : editingId ? "Update trip" : "Create trip"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <p className="trip-form-note">Vehicles in shop and retired vehicles are disabled. Drivers on leave are disabled.</p>
        </form>

        <section className="trip-table-card">
          <div className="panel-heading trip-table-heading">
            <div>
              <h3>Trip Directory</h3>
              <p>{trips.length} matching trips</p>
            </div>
          </div>

          {pageError && <div className="trip-banner error-banner">{pageError}</div>}

          <div className="trip-table-wrap">
            <table className="trip-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Cargo</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>
                      <strong>{trip.source}</strong>
                      <span>{trip.destination}</span>
                    </td>
                    <td>
                      <strong>{trip.vehiclePlateNumber}</strong>
                      <span>{trip.vehicle ? `${trip.vehicle.model} · ${trip.vehicle.capacityKg} kg` : "Vehicle data unavailable"}</span>
                    </td>
                    <td>
                      <strong>{trip.driver.fullName}</strong>
                      <span>{trip.driver.statusLabel}</span>
                    </td>
                    <td>
                      <strong>{formatCurrencyLikeWeight(trip.cargoWeightKg)} kg</strong>
                      <span>{formatCurrencyLikeWeight(trip.distanceKm)} km · {trip.cargoDescription}</span>
                    </td>
                    <td>
                      <strong>{formatDate(trip.startDate)}</strong>
                      <span>{formatDate(trip.endDate)}</span>
                    </td>
                    <td>
                      <StatusBadge status={trip.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-secondary" onClick={() => startEdit(trip)}>
                          Edit
                        </button>
                        <button type="button" className="btn-secondary danger" onClick={() => void handleDelete(trip)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {trips.length === 0 && <p className="trip-empty">No trips match the current filters.</p>}
        </section>
      </section>
    </div>
  );
}