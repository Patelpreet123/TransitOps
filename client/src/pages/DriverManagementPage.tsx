import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, type VehicleRecord } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  DRIVER_STATUS_LABELS,
  DRIVER_STATUSES,
  type DriverPayload,
  type DriverRecord,
  type DriverStatus,
  type DriversResponse,
} from "../types/drivers";

type SortField = "fullName" | "status" | "licenseExpiryDate" | "assignedVehicle";
type SortDirection = "asc" | "desc";
type DriverFormState = DriverPayload;

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

const EMPTY_FORM: DriverFormState = {
  fullName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  licenseExpiryDate: "",
  status: "AVAILABLE",
  assignedVehicle: null,
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^[+()\d\s-]{7,24}$/.test(value);
}

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toFormState(driver: DriverRecord): DriverFormState {
  return {
    fullName: driver.fullName,
    email: driver.email,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    licenseExpiryDate: driver.licenseExpiryDate,
    status: driver.status,
    assignedVehicle: driver.assignedVehicle,
  };
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: DriverStatus }) {
  return <span className={`driver-status status-${status}`}>{DRIVER_STATUS_LABELS[status]}</span>;
}

function DriverToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
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

export function DriverManagementPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleRecord[]>([]);
  const [summary, setSummary] = useState<DriversResponse["summary"]>({
    total: 0,
    available: 0,
    onTrip: 0,
    onLeave: 0,
    assignedVehicles: 0,
    unassignedVehicles: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DriverStatus>("all");
  const [sortField, setSortField] = useState<SortField>("fullName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (tone: ToastItem["tone"], message: string) => {
    const id = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);

    setToasts((current) => [...current, { id, tone, message }]);
  };

  const loadData = async () => {
    try {
      const [driverResponse, vehicleResponse] = await Promise.all([
        api.drivers(),
        api.vehicleRegistry().catch(() => ({ vehicles: [] as VehicleRecord[] })),
      ]);

      setDrivers(driverResponse.drivers);
      setSummary(driverResponse.summary);
      setVehicleOptions(vehicleResponse.vehicles);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredDrivers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...drivers]
      .filter((driver) => {
        const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [driver.fullName, driver.email, driver.phone, driver.licenseNumber, driver.assignedVehicle ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);

        return matchesStatus && matchesSearch;
      })
      .sort((left, right) => {
        let result = 0;

        switch (sortField) {
          case "fullName":
            result = compareText(left.fullName, right.fullName);
            break;
          case "status":
            result = compareText(left.status, right.status);
            break;
          case "licenseExpiryDate":
            result = new Date(left.licenseExpiryDate).getTime() - new Date(right.licenseExpiryDate).getTime();
            break;
          case "assignedVehicle":
            result = compareText(left.assignedVehicle, right.assignedVehicle);
            break;
        }

        return sortDirection === "asc" ? result : result * -1;
      });
  }, [drivers, search, statusFilter, sortDirection, sortField]);

  const validationMessage = useMemo(() => {
    if (!form.fullName.trim()) return "Full name is required";
    if (!isValidEmail(form.email.trim())) return "Enter a valid email address";
    if (!isValidPhone(form.phone.trim())) return "Enter a valid phone number";
    if (form.licenseNumber.trim().length < 4) return "License number must be at least 4 characters";
    if (!form.licenseExpiryDate) return "License expiry date is required";
    if (new Date(form.licenseExpiryDate).getTime() < new Date(todayIsoDate()).getTime()) {
      return "License expiry date cannot be in the past";
    }
    return "";
  }, [form]);

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

  const startEdit = (driver: DriverRecord) => {
    setEditingId(driver.id);
    setForm(toFormState(driver));
    setFormError("");
    pushToast("info", `Editing ${driver.fullName}`);
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
      const payload: DriverPayload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        licenseNumber: form.licenseNumber.trim().toUpperCase(),
        licenseExpiryDate: form.licenseExpiryDate,
        status: form.status,
        assignedVehicle: form.assignedVehicle?.trim() ? form.assignedVehicle.trim() : null,
      };

      if (editingId) {
        await api.updateDriver(editingId, payload);
        pushToast("success", "Driver updated successfully");
      } else {
        await api.createDriver(payload);
        pushToast("success", "Driver created successfully");
      }

      resetForm();
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Driver save failed";
      setFormError(message);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (driver: DriverRecord) => {
    const confirmed = window.confirm(`Delete ${driver.fullName}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await api.deleteDriver(driver.id);
      pushToast("success", "Driver deleted");
      if (editingId === driver.id) {
        resetForm();
      }
      await loadData();
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Delete failed");
    }
  };

  const onDismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    window.clearTimeout(id);
  };

  if (loading) {
    return (
      <div className="dashboard-page driver-page">
        <div className="driver-hero skeleton-block skeleton-header" />
        <div className="driver-metrics-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-block skeleton-kpi" />
          ))}
        </div>
        <div className="driver-layout-grid">
          <div className="skeleton-block skeleton-panel" />
          <div className="skeleton-block skeleton-panel" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page driver-page">
      <DriverToastStack toasts={toasts} onDismiss={onDismissToast} />

      <section className="driver-hero">
        <div>
          <p className="dashboard-eyebrow">Fleet Manager · Drivers</p>
          <h1>Driver Management</h1>
          <p className="dashboard-subtitle">
            Create, edit, search, and assign drivers with license tracking and operational status controls.
          </p>
        </div>

        <div className="registry-hero-meta">
          <div className="status-pill live">
            <span className="status-dot" />
            {summary.total} drivers tracked
          </div>
          <p className="welcome-name">{editingId ? "Editing driver profile" : "Ready for new driver intake"}</p>
        </div>
      </section>

      <section className="driver-metrics-grid" aria-label="Driver summary">
        <article className="driver-metric-card">
          <span>Total drivers</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="driver-metric-card">
          <span>Available</span>
          <strong>{summary.available}</strong>
        </article>
        <article className="driver-metric-card">
          <span>On trip</span>
          <strong>{summary.onTrip}</strong>
        </article>
        <article className="driver-metric-card">
          <span>On leave</span>
          <strong>{summary.onLeave}</strong>
        </article>
      </section>

      <section className="driver-layout-grid">
        <form className="driver-form-card" onSubmit={(event) => void submitForm(event)}>
          <div className="panel-heading">
            <h3>{editingId ? "Edit Driver" : "Create Driver"}</h3>
            <p>Beautiful, validated profile form with vehicle assignment support.</p>
          </div>

          <div className="driver-form-grid">
            <label>
              Full name
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Jordan Miles"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="jordan.miles@transitops.demo"
                required
              />
            </label>

            <label>
              Phone
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+1 555 210 4478"
                required
              />
            </label>

            <label>
              License number
              <input
                type="text"
                value={form.licenseNumber}
                onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })}
                placeholder="LIC-1001"
                required
              />
            </label>

            <label>
              License expiry date
              <input
                type="date"
                value={form.licenseExpiryDate}
                onChange={(event) => setForm({ ...form, licenseExpiryDate: event.target.value })}
                min={todayIsoDate()}
                required
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as DriverStatus })}
              >
                {DRIVER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {DRIVER_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="driver-assignment-field">
              Assigned vehicle
              <select
                value={form.assignedVehicle ?? ""}
                onChange={(event) =>
                  setForm({ ...form, assignedVehicle: event.target.value.length > 0 ? event.target.value : null })
                }
              >
                <option value="">Unassigned</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plateNumber}>
                    {vehicle.plateNumber} · {vehicle.model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError && <p className="error driver-form-error">{formError}</p>}

          <div className="driver-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (editingId ? "Saving changes..." : "Creating driver...") : editingId ? "Update driver" : "Create driver"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <section className="driver-table-card">
          <div className="panel-heading driver-table-heading">
            <div>
              <h3>Driver Directory</h3>
              <p>{filteredDrivers.length} matching drivers</p>
            </div>

            <div className="driver-controls">
              <label>
                Search
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, phone, license"
                />
              </label>

              <label>
                Filter
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">All statuses</option>
                  {DRIVER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DRIVER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sort by
                <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
                  <option value="fullName">Full name</option>
                  <option value="status">Status</option>
                  <option value="licenseExpiryDate">License expiry</option>
                  <option value="assignedVehicle">Assigned vehicle</option>
                </select>
              </label>

              <button type="button" className="btn-secondary sort-toggle" onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}>
                {sortDirection === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
          </div>

          <div className="driver-table-wrap">
            <table className="driver-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Contact</th>
                  <th>License</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <strong>{driver.fullName}</strong>
                      <span>{driver.email}</span>
                    </td>
                    <td>
                      <strong>{driver.phone}</strong>
                      <span>Created {formatDate(driver.createdAt)}</span>
                    </td>
                    <td>{driver.licenseNumber}</td>
                    <td>{formatDate(driver.licenseExpiryDate)}</td>
                    <td>
                      <StatusBadge status={driver.status} />
                    </td>
                    <td>{driver.assignedVehicle ?? "Unassigned"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-secondary" onClick={() => startEdit(driver)}>
                          Edit
                        </button>
                        <button type="button" className="btn-secondary danger" onClick={() => void handleDelete(driver)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredDrivers.length === 0 && <p className="driver-empty">No drivers match the current filters.</p>}
        </section>
      </section>
    </div>
  );
}