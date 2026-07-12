import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type VehicleRecord } from "../lib/api";
import {
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUSES,
  type MaintenancePayload,
  type MaintenanceRecord,
  type MaintenanceStatus,
  type MaintenanceSummary,
} from "../types/maintenance";

type SortField = "scheduledDate" | "completionDate" | "cost" | "status" | "vehiclePlateNumber" | "serviceType";
type SortDirection = "asc" | "desc";

interface FormState {
  vehiclePlateNumber: string;
  serviceType: string;
  scheduledDate: string;
  completionDate: string;
  cost: string;
  notes: string;
  status: MaintenanceStatus;
}

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

const EMPTY_FORM: FormState = {
  vehiclePlateNumber: "",
  serviceType: "",
  scheduledDate: "",
  completionDate: "",
  cost: "",
  notes: "",
  status: "SCHEDULED",
};

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function StatusBadge({ status }: { status: MaintenanceStatus }) {
  return <span className={`maintenance-status status-${status}`}>{MAINTENANCE_STATUS_LABELS[status]}</span>;
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

export function MaintenanceManagementPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>({
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    totalCost: 0,
  });
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MaintenanceStatus>("all");
  const [sortField, setSortField] = useState<SortField>("scheduledDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);

    setToasts((current) => [...current, { id, tone, message }]);
  };

  const loadData = async () => {
    try {
      setPageError("");
      const [maintenanceResponse, vehicleResponse] = await Promise.all([
        api.maintenance({ search, status: statusFilter === "all" ? undefined : statusFilter, sortBy: sortField, sortOrder: sortDirection }),
        api.vehicleRegistry(),
      ]);

      setRecords(maintenanceResponse.maintenance);
      setSummary(maintenanceResponse.summary);
      setVehicles(vehicleResponse.vehicles);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load maintenance data";
      setPageError(message);
      pushToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [search, statusFilter, sortField, sortDirection]);

  const vehicleOptions = useMemo(() => vehicles, [vehicles]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.plateNumber === form.vehiclePlateNumber) ?? null,
    [form.vehiclePlateNumber, vehicles]
  );

  const validationMessage = useMemo(() => {
    if (!form.vehiclePlateNumber) return "Vehicle is required";
    if (!form.serviceType.trim()) return "Service type is required";
    if (!form.scheduledDate) return "Scheduled date is required";
    if (Number(form.cost) < 0 || !Number.isFinite(Number(form.cost))) return "Cost must be zero or greater";
    if (form.status === "COMPLETED" && !form.completionDate) return "Completion date is required when completed";
    if (form.completionDate && new Date(form.completionDate).getTime() < new Date(form.scheduledDate).getTime()) {
      return "Completion date must be on or after scheduled date";
    }

    if (!selectedVehicle) return "Selected vehicle is unavailable";
    if (selectedVehicle.lifecycleStatus === "RETIRED") return "Retired vehicles cannot be scheduled";
    if (selectedVehicle.lifecycleStatus === "IN_SHOP") return "Vehicles in shop cannot be scheduled";

    return "";
  }, [form, selectedVehicle]);

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

  const refresh = async () => {
    setLoading(true);
    await loadData();
  };

  const startEdit = (record: MaintenanceRecord) => {
    setEditingId(record.id);
    setForm({
      vehiclePlateNumber: record.vehiclePlateNumber,
      serviceType: record.serviceType,
      scheduledDate: record.scheduledDate,
      completionDate: record.completionDate ?? "",
      cost: String(record.cost),
      notes: record.notes ?? "",
      status: record.status,
    });
    setFormError("");
    pushToast("info", `Editing ${record.serviceType}`);
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
      const payload: MaintenancePayload = {
        vehiclePlateNumber: form.vehiclePlateNumber,
        serviceType: form.serviceType.trim(),
        scheduledDate: form.scheduledDate,
        completionDate: form.completionDate || null,
        cost: Number(form.cost),
        notes: form.notes.trim() ? form.notes.trim() : null,
        status: form.status,
      };

      if (editingId) {
        await api.updateMaintenance(editingId, payload);
        pushToast("success", "Maintenance updated successfully");
      } else {
        await api.createMaintenance(payload);
        pushToast("success", "Maintenance created successfully");
      }

      resetForm();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Maintenance save failed";
      setFormError(message);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: MaintenanceRecord) => {
    const confirmed = window.confirm(`Delete maintenance for ${record.vehiclePlateNumber}?`);
    if (!confirmed) return;

    try {
      await api.deleteMaintenance(record.id);
      pushToast("success", "Maintenance deleted");
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

  const sortedVehicleLabels = vehicleOptions.filter((vehicle) => vehicle.lifecycleStatus !== "RETIRED");

  if (loading) {
    return (
      <div className="dashboard-page maintenance-page">
        <div className="maintenance-hero skeleton-block skeleton-header" />
        <div className="maintenance-stats-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton-block skeleton-kpi" />
          ))}
        </div>
        <div className="maintenance-layout-grid">
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page maintenance-page">
      <ToastStack toasts={toasts} onDismiss={onDismissToast} />

      <section className="maintenance-hero">
        <div>
          <p className="dashboard-eyebrow">Fleet Manager · Maintenance</p>
          <h1>Maintenance Management</h1>
          <p className="dashboard-subtitle">Schedule service, track costs, and keep trip eligibility aligned with vehicle condition.</p>
        </div>
        <div className="maintenance-hero-meta">
          <div className="status-pill live">
            <span className="status-dot" />
            {summary.total} maintenance records
          </div>
          <p className="welcome-name">{pageError || (editingId ? "Editing maintenance record" : "Maintenance desk ready")}</p>
        </div>
      </section>

      <section className="maintenance-stats-grid" aria-label="Maintenance summary">
        <article className="maintenance-stat-card"><span>Total</span><strong>{summary.total}</strong></article>
        <article className="maintenance-stat-card"><span>Scheduled</span><strong>{summary.scheduled}</strong></article>
        <article className="maintenance-stat-card"><span>In Progress</span><strong>{summary.inProgress}</strong></article>
        <article className="maintenance-stat-card"><span>Completed</span><strong>{summary.completed}</strong></article>
        <article className="maintenance-stat-card"><span>Total Cost</span><strong>{formatCurrency(summary.totalCost)}</strong></article>
      </section>

      <section className="maintenance-toolbar">
        <label className="maintenance-toolbar-field">
          <span>Search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vehicle, service type, notes" />
        </label>

        <label className="maintenance-toolbar-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | MaintenanceStatus)}>
            <option value="all">All statuses</option>
            {MAINTENANCE_STATUSES.map((status) => (
              <option key={status} value={status}>{MAINTENANCE_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>

        <label className="maintenance-toolbar-field">
          <span>Sort by</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
            <option value="scheduledDate">Scheduled date</option>
            <option value="completionDate">Completion date</option>
            <option value="cost">Cost</option>
            <option value="status">Status</option>
            <option value="vehiclePlateNumber">Vehicle</option>
            <option value="serviceType">Service type</option>
          </select>
        </label>

        <button type="button" className="btn-secondary maintenance-sort-toggle" onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}>
          {sortDirection === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </section>

      <section className="maintenance-layout-grid">
        <form className="maintenance-form-card" onSubmit={(event) => void submitForm(event)}>
          <div className="panel-heading">
            <h3>{editingId ? "Edit Maintenance" : "Create Maintenance"}</h3>
            <p>Professional scheduling form with vehicle eligibility checks.</p>
          </div>

          <div className="maintenance-form-grid">
            <label>
              Vehicle
              <select value={form.vehiclePlateNumber} onChange={(event) => setForm({ ...form, vehiclePlateNumber: event.target.value })} required>
                <option value="">Select vehicle</option>
                {sortedVehicleLabels.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plateNumber} disabled={vehicle.lifecycleStatus === "IN_SHOP" || vehicle.lifecycleStatus === "RETIRED"}>
                    {vehicle.plateNumber} · {vehicle.model} · {vehicle.lifecycleStatus === "IN_SHOP" ? "In Shop" : vehicle.lifecycleStatus === "RETIRED" ? "Retired" : "Active"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Service type
              <input type="text" value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })} placeholder="Brake inspection" required />
            </label>

            <label>
              Scheduled date
              <input type="date" min={todayIsoDate()} value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} required />
            </label>

            <label>
              Completion date
              <input type="date" min={form.scheduledDate || todayIsoDate()} value={form.completionDate} onChange={(event) => setForm({ ...form, completionDate: event.target.value })} />
            </label>

            <label>
              Cost
              <input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} placeholder="780" required />
            </label>

            <label>
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MaintenanceStatus })}>
                {MAINTENANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>{MAINTENANCE_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </label>

            <label className="maintenance-wide-field">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} placeholder="Optional service notes" />
            </label>
          </div>

          {formError && <p className="error maintenance-form-error">{formError}</p>}

          <div className="maintenance-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (editingId ? "Saving..." : "Creating...") : editingId ? "Update maintenance" : "Create maintenance"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel edit</button>
            )}
          </div>

          <p className="maintenance-form-note">Completed maintenance returns the vehicle to active availability for future trips.</p>
        </form>

        <section className="maintenance-table-card">
          <div className="panel-heading maintenance-table-heading">
            <div>
              <h3>Maintenance Directory</h3>
              <p>{records.length} matching records</p>
            </div>
          </div>

          {pageError && <div className="maintenance-banner error-banner">{pageError}</div>}

          <div className="maintenance-table-wrap">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Service</th>
                  <th>Dates</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.vehiclePlateNumber}</strong>
                      <span>{record.vehicle ? `${record.vehicle.model} · ${record.vehicle.lifecycleStatus}` : "Vehicle unavailable"}</span>
                    </td>
                    <td>{record.serviceType}</td>
                    <td>
                      <strong>{formatDate(record.scheduledDate)}</strong>
                      <span>{record.completionDate ? formatDate(record.completionDate) : "Pending completion"}</span>
                    </td>
                    <td>{formatCurrency(record.cost)}</td>
                    <td><StatusBadge status={record.status} /></td>
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

          {records.length === 0 && <p className="maintenance-empty">No maintenance records match the current filters.</p>}
        </section>
      </section>
    </div>
  );
}