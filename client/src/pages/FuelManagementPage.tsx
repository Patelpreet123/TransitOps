import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type FuelRecord, type FuelSummary, type TripRecord, type VehicleRecord } from "../lib/api";
import { FUEL_STATUS_LABELS, FUEL_STATUSES, type FuelPayload, type FuelStatus } from "../types/fuel";

type SortField = "refueledAt" | "vehiclePlateNumber" | "tripId" | "fuelType" | "liters" | "totalCost" | "status";

interface FormState {
  vehiclePlateNumber: string;
  tripId: string;
  fuelType: string;
  liters: string;
  unitPrice: string;
  refueledAt: string;
  odometerKm: string;
  notes: string;
  status: FuelStatus;
}

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

const EMPTY_FORM: FormState = {
  vehiclePlateNumber: "",
  tripId: "",
  fuelType: "Diesel",
  liters: "",
  unitPrice: "",
  refueledAt: "",
  odometerKm: "",
  notes: "",
  status: "RECORDED",
};

function todayIsoDateTime() {
  return new Date().toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function FuelStatusBadge({ status }: { status: FuelStatus }) {
  return <span className={`fuel-status status-${status}`}>{FUEL_STATUS_LABELS[status]}</span>;
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

export function FuelManagementPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [summary, setSummary] = useState<FuelSummary>({ total: 0, totalLiters: 0, totalCost: 0, recorded: 0, voided: 0 });
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FuelStatus>("all");
  const [sortField, setSortField] = useState<SortField>("refueledAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
    setToasts((current) => [...current, { id, tone, message }]);
  };

  const loadOptions = async () => {
    try {
      const [vehicleResponse, tripResponse] = await Promise.all([api.vehicleRegistry(), api.trips()]);
      setVehicles(vehicleResponse.vehicles);
      setTrips(tripResponse.trips);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load options");
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadFuel = async () => {
    try {
      setLoadingRecords(true);
      setPageError("");
      const response = await api.fuel({ search, status: statusFilter === "all" ? undefined : statusFilter, sortBy: sortField, sortOrder: sortDirection });
      setRecords(response.fuel);
      setSummary(response.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load fuel records";
      setPageError(message);
      pushToast("error", message);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  useEffect(() => {
    void loadFuel();
  }, [search, statusFilter, sortField, sortDirection]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.plateNumber === form.vehiclePlateNumber) ?? null, [form.vehiclePlateNumber, vehicles]);
  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === form.tripId) ?? null, [form.tripId, trips]);
  const filteredTrips = useMemo(() => trips.filter((trip) => !form.vehiclePlateNumber || trip.vehiclePlateNumber === form.vehiclePlateNumber), [form.vehiclePlateNumber, trips]);

  const validationMessage = useMemo(() => {
    if (!form.vehiclePlateNumber) return "Vehicle is required";
    if (!form.fuelType.trim()) return "Fuel type is required";
    if (!form.refueledAt) return "Refueled date is required";
    if (!Number.isFinite(Number(form.liters)) || Number(form.liters) <= 0) return "Liters must be greater than zero";
    if (!Number.isFinite(Number(form.unitPrice)) || Number(form.unitPrice) < 0) return "Unit price must be zero or greater";
    if (form.odometerKm && (!Number.isFinite(Number(form.odometerKm)) || Number(form.odometerKm) < 0)) return "Odometer must be zero or greater";
    if (!selectedVehicle) return "Selected vehicle is unavailable";
    if (selectedVehicle.lifecycleStatus === "RETIRED") return "Retired vehicles cannot be refueled";
    if (form.tripId && !selectedTrip) return "Selected trip is unavailable";
    if (selectedTrip && selectedTrip.vehiclePlateNumber !== form.vehiclePlateNumber) return "Trip must match the selected vehicle";
    if (form.status === "VOIDED" && Number(form.liters) <= 0) return "Voided entries still require liters greater than zero";
    return "";
  }, [form, selectedTrip, selectedVehicle]);

  if (!user) return null;
  if (user.role !== "FLEET_MANAGER") return <Navigate to="/dashboard" replace />;

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const refresh = async () => {
    await loadFuel();
  };

  const startEdit = (record: FuelRecord) => {
    setEditingId(record.id);
    setForm({
      vehiclePlateNumber: record.vehiclePlateNumber,
      tripId: record.tripId ?? "",
      fuelType: record.fuelType,
      liters: String(record.liters),
      unitPrice: String(record.unitPrice),
      refueledAt: record.refueledAt.slice(0, 16),
      odometerKm: record.odometerKm === null ? "" : String(record.odometerKm),
      notes: record.notes ?? "",
      status: record.status,
    });
    setFormError("");
    pushToast("info", `Editing fuel record for ${record.vehiclePlateNumber}`);
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
      const payload: FuelPayload = {
        vehiclePlateNumber: form.vehiclePlateNumber,
        tripId: form.tripId || null,
        fuelType: form.fuelType.trim(),
        liters: Number(form.liters),
        unitPrice: Number(form.unitPrice),
        refueledAt: new Date(form.refueledAt).toISOString(),
        odometerKm: form.odometerKm ? Number(form.odometerKm) : null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        status: form.status,
      };

      if (editingId) {
        await api.updateFuel(editingId, payload);
        pushToast("success", "Fuel record updated successfully");
      } else {
        await api.createFuel(payload);
        pushToast("success", "Fuel record created successfully");
      }

      resetForm();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fuel save failed";
      setFormError(message);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: FuelRecord) => {
    if (!window.confirm(`Delete fuel record for ${record.vehiclePlateNumber}?`)) return;
    try {
      await api.deleteFuel(record.id);
      pushToast("success", "Fuel record deleted");
      if (editingId === record.id) resetForm();
      await refresh();
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Delete failed");
    }
  };

  const onDismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    window.clearTimeout(id);
  };

  const selectableVehicles = vehicles.filter((vehicle) => vehicle.lifecycleStatus !== "RETIRED");

  if (loadingRecords || loadingOptions) {
    return (
      <div className="dashboard-page finance-page">
        <div className="finance-hero skeleton-block skeleton-header" />
        <div className="finance-stats-grid">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton-block skeleton-kpi" />)}
        </div>
        <div className="finance-layout-grid">
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page finance-page">
      <ToastStack toasts={toasts} onDismiss={onDismissToast} />

      <section className="finance-hero">
        <div>
          <p className="dashboard-eyebrow">Fleet Manager · Fuel</p>
          <h1>Fuel Management</h1>
          <p className="dashboard-subtitle">Track refueling, associate fuel logs with trips, and keep vehicle operating costs current.</p>
        </div>
        <div className="finance-hero-meta">
          <div className="status-pill live"><span className="status-dot" />{summary.total} fuel logs</div>
          <p className="welcome-name">{pageError || (editingId ? "Editing fuel entry" : "Fuel operations ready")}</p>
        </div>
      </section>

      <section className="finance-stats-grid" aria-label="Fuel summary">
        <article className="finance-stat-card"><span>Total logs</span><strong>{summary.total}</strong></article>
        <article className="finance-stat-card"><span>Total liters</span><strong>{formatDecimal(summary.totalLiters)}</strong></article>
        <article className="finance-stat-card"><span>Total cost</span><strong>{formatCurrency(summary.totalCost)}</strong></article>
        <article className="finance-stat-card"><span>Recorded</span><strong>{summary.recorded}</strong></article>
        <article className="finance-stat-card"><span>Voided</span><strong>{summary.voided}</strong></article>
      </section>

      <section className="finance-toolbar">
        <label className="finance-toolbar-field">
          <span>Search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vehicle, trip, fuel type, notes" />
        </label>

        <label className="finance-toolbar-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | FuelStatus)}>
            <option value="all">All statuses</option>
            {FUEL_STATUSES.map((status) => <option key={status} value={status}>{FUEL_STATUS_LABELS[status]}</option>)}
          </select>
        </label>

        <label className="finance-toolbar-field">
          <span>Sort by</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
            <option value="refueledAt">Refueled at</option>
            <option value="vehiclePlateNumber">Vehicle</option>
            <option value="tripId">Trip</option>
            <option value="fuelType">Fuel type</option>
            <option value="liters">Liters</option>
            <option value="totalCost">Total cost</option>
            <option value="status">Status</option>
          </select>
        </label>

        <button type="button" className="btn-secondary finance-sort-toggle" onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}>
          {sortDirection === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </section>

      <section className="finance-layout-grid">
        <form className="finance-form-card" onSubmit={(event) => void submitForm(event)}>
          <div className="panel-heading">
            <h3>{editingId ? "Edit Fuel Log" : "Create Fuel Log"}</h3>
            <p>Validate vehicle and trip alignment before recording refueling events.</p>
          </div>

          <div className="finance-form-grid">
            <label>
              Vehicle
              <select value={form.vehiclePlateNumber} onChange={(event) => setForm({ ...form, vehiclePlateNumber: event.target.value, tripId: "" })} required>
                <option value="">Select vehicle</option>
                {selectableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plateNumber}>{vehicle.plateNumber} · {vehicle.model}</option>)}
              </select>
            </label>

            <label>
              Trip
              <select value={form.tripId} onChange={(event) => setForm({ ...form, tripId: event.target.value })}>
                <option value="">No trip link</option>
                {filteredTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.source} → {trip.destination} · {trip.status}</option>)}
              </select>
            </label>

            <label>
              Fuel type
              <input type="text" value={form.fuelType} onChange={(event) => setForm({ ...form, fuelType: event.target.value })} placeholder="Diesel" required />
            </label>

            <label>
              Refueled at
              <input type="datetime-local" max={todayIsoDateTime()} value={form.refueledAt} onChange={(event) => setForm({ ...form, refueledAt: event.target.value })} required />
            </label>

            <label>
              Liters
              <input type="number" min="0" step="0.1" value={form.liters} onChange={(event) => setForm({ ...form, liters: event.target.value })} placeholder="125" required />
            </label>

            <label>
              Unit price
              <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} placeholder="1.42" required />
            </label>

            <label>
              Odometer km
              <input type="number" min="0" step="1" value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} placeholder="18485" />
            </label>

            <label>
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FuelStatus })}>
                {FUEL_STATUSES.map((status) => <option key={status} value={status}>{FUEL_STATUS_LABELS[status]}</option>)}
              </select>
            </label>

            <label className="finance-wide-field">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} placeholder="Optional fuel notes" />
            </label>
          </div>

          {formError && <p className="error finance-form-error">{formError}</p>}

          <div className="finance-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? (editingId ? "Saving..." : "Creating...") : editingId ? "Update fuel log" : "Create fuel log"}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>

        <section className="finance-table-card">
          <div className="panel-heading finance-table-heading">
            <div>
              <h3>Fuel Logs</h3>
              <p>{records.length} matching entries</p>
            </div>
          </div>

          {pageError && <div className="finance-banner error-banner">{pageError}</div>}

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Trip</th>
                  <th>Fuel</th>
                  <th>Metrics</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.vehiclePlateNumber}</strong><span>{record.vehicle ? record.vehicle.model : "Vehicle unavailable"}</span></td>
                    <td><strong>{record.trip ? `${record.trip.source} → ${record.trip.destination}` : "No trip link"}</strong><span>{record.trip ? record.trip.status : "Standalone fuel log"}</span></td>
                    <td><strong>{record.fuelType}</strong><span>{formatDate(record.refueledAt)}</span></td>
                    <td><strong>{formatDecimal(record.liters)} L · {formatCurrency(record.totalCost)}</strong><span>{record.odometerKm !== null ? `${formatDecimal(record.odometerKm)} km` : "No odometer"}</span></td>
                    <td><FuelStatusBadge status={record.status} /></td>
                    <td>{record.notes ?? "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-secondary" onClick={() => startEdit(record)}>Edit</button>
                        <button type="button" className="btn-secondary danger" onClick={() => void handleDelete(record)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {records.length === 0 && <p className="finance-empty">No fuel logs match the current filters.</p>}
        </section>
      </section>
    </div>
  );
}