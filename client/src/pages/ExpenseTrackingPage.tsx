import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type ExpenseRecord, type ExpenseSummary, type TripRecord, type VehicleRecord } from "../lib/api";
import { EXPENSE_CATEGORIES, EXPENSE_STATUS_LABELS, EXPENSE_STATUSES, type ExpenseCategory, type ExpensePayload, type ExpenseStatus } from "../types/expenses";

type SortField = "expenseDate" | "amount" | "status" | "category" | "title" | "paymentMethod";

interface FormState {
  title: string;
  category: ExpenseCategory | "";
  amount: string;
  expenseDate: string;
  vendor: string;
  paymentMethod: string;
  vehiclePlateNumber: string;
  tripId: string;
  notes: string;
  status: ExpenseStatus;
}

interface ToastItem {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  category: "Fuel",
  amount: "",
  expenseDate: "",
  vendor: "",
  paymentMethod: "Card",
  vehiclePlateNumber: "",
  tripId: "",
  notes: "",
  status: "PENDING",
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`expense-status status-${status}`}>{EXPENSE_STATUS_LABELS[status]}</span>;
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

export function ExpenseTrackingPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ total: 0, totalAmount: 0, pending: 0, approved: 0, paid: 0, rejected: 0 });
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ExpenseStatus>("all");
  const [sortField, setSortField] = useState<SortField>("expenseDate");
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

  const loadExpenses = async () => {
    try {
      setLoadingRecords(true);
      setPageError("");
      const response = await api.expenses({ search, status: statusFilter === "all" ? undefined : statusFilter, sortBy: sortField, sortOrder: sortDirection });
      setRecords(response.expenses);
      setSummary(response.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load expenses";
      setPageError(message);
      pushToast("error", message);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => { void loadOptions(); }, []);
  useEffect(() => { void loadExpenses(); }, [search, statusFilter, sortField, sortDirection]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.plateNumber === form.vehiclePlateNumber) ?? null, [form.vehiclePlateNumber, vehicles]);
  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === form.tripId) ?? null, [form.tripId, trips]);
  const filteredTrips = useMemo(() => trips.filter((trip) => !form.vehiclePlateNumber || trip.vehiclePlateNumber === form.vehiclePlateNumber), [form.vehiclePlateNumber, trips]);

  const validationMessage = useMemo(() => {
    if (!form.title.trim()) return "Title is required";
    if (!form.category) return "Category is required";
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return "Amount must be greater than zero";
    if (!form.expenseDate) return "Expense date is required";
    if (!form.paymentMethod.trim()) return "Payment method is required";
    if (!selectedTrip && form.tripId) return "Selected trip is unavailable";
    if (form.vehiclePlateNumber && !selectedVehicle) return "Selected vehicle is unavailable";
    if (selectedTrip && form.vehiclePlateNumber && selectedTrip.vehiclePlateNumber !== form.vehiclePlateNumber) return "Trip must match the selected vehicle";
    return "";
  }, [form, selectedTrip, selectedVehicle]);

  if (!user) return null;
  if (user.role !== "FLEET_MANAGER" && user.role !== "FINANCIAL_ANALYST") return <Navigate to="/dashboard" replace />;

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const refresh = async () => { await loadExpenses(); };

  const startEdit = (record: ExpenseRecord) => {
    setEditingId(record.id);
    setForm({
      title: record.title,
      category: record.category as ExpenseCategory,
      amount: String(record.amount),
      expenseDate: record.expenseDate,
      vendor: record.vendor ?? "",
      paymentMethod: record.paymentMethod,
      vehiclePlateNumber: record.vehiclePlateNumber ?? "",
      tripId: record.tripId ?? "",
      notes: record.notes ?? "",
      status: record.status,
    });
    setFormError("");
    pushToast("info", `Editing expense ${record.title}`);
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
      const payload: ExpensePayload = {
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        expenseDate: new Date(form.expenseDate).toISOString(),
        vendor: form.vendor.trim() ? form.vendor.trim() : null,
        paymentMethod: form.paymentMethod.trim(),
        vehiclePlateNumber: form.vehiclePlateNumber || null,
        tripId: form.tripId || null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        status: form.status,
      };

      if (editingId) {
        await api.updateExpense(editingId, payload);
        pushToast("success", "Expense updated successfully");
      } else {
        await api.createExpense(payload);
        pushToast("success", "Expense created successfully");
      }

      resetForm();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Expense save failed";
      setFormError(message);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: ExpenseRecord) => {
    if (!window.confirm(`Delete expense ${record.title}?`)) return;
    try {
      await api.deleteExpense(record.id);
      pushToast("success", "Expense deleted");
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

  const selectableVehicles = vehicles;

  if (loadingRecords || loadingOptions) {
    return (
      <div className="dashboard-page finance-page">
        <div className="finance-hero skeleton-block skeleton-header" />
        <div className="finance-stats-grid">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton-block skeleton-kpi" />)}
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
          <p className="dashboard-eyebrow">Fleet Manager · Finance</p>
          <h1>Expense Tracking</h1>
          <p className="dashboard-subtitle">Record operating costs, connect them to trips or vehicles, and review approval states.</p>
        </div>
        <div className="finance-hero-meta">
          <div className="status-pill live"><span className="status-dot" />{summary.total} expenses tracked</div>
          <p className="welcome-name">{pageError || (editingId ? "Editing expense record" : "Expense ledger ready")}</p>
        </div>
      </section>

      <section className="finance-stats-grid" aria-label="Expense summary">
        <article className="finance-stat-card"><span>Total</span><strong>{summary.total}</strong></article>
        <article className="finance-stat-card"><span>Amount</span><strong>{formatCurrency(summary.totalAmount)}</strong></article>
        <article className="finance-stat-card"><span>Pending</span><strong>{summary.pending}</strong></article>
        <article className="finance-stat-card"><span>Approved</span><strong>{summary.approved}</strong></article>
        <article className="finance-stat-card"><span>Paid</span><strong>{summary.paid}</strong></article>
        <article className="finance-stat-card"><span>Rejected</span><strong>{summary.rejected}</strong></article>
      </section>

      <section className="finance-toolbar">
        <label className="finance-toolbar-field">
          <span>Search</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, category, vendor, trip, notes" />
        </label>

        <label className="finance-toolbar-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ExpenseStatus)}>
            <option value="all">All statuses</option>
            {EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{EXPENSE_STATUS_LABELS[status]}</option>)}
          </select>
        </label>

        <label className="finance-toolbar-field">
          <span>Sort by</span>
          <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
            <option value="expenseDate">Expense date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
            <option value="category">Category</option>
            <option value="title">Title</option>
            <option value="paymentMethod">Payment method</option>
          </select>
        </label>

        <button type="button" className="btn-secondary finance-sort-toggle" onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}>
          {sortDirection === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </section>

      <section className="finance-layout-grid">
        <form className="finance-form-card" onSubmit={(event) => void submitForm(event)}>
          <div className="panel-heading">
            <h3>{editingId ? "Edit Expense" : "Create Expense"}</h3>
            <p>Validated expense form with optional vehicle and trip links.</p>
          </div>

          <div className="finance-form-grid">
            <label>
              Title
              <input type="text" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Toll charges - East corridor" required />
            </label>

            <label>
              Category
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}>
                {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label>
              Amount
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="84" required />
            </label>

            <label>
              Expense date
              <input type="date" max={todayIsoDate()} value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} required />
            </label>

            <label>
              Vendor
              <input type="text" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder="City Toll Authority" />
            </label>

            <label>
              Payment method
              <input type="text" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} placeholder="Card" required />
            </label>

            <label>
              Vehicle
              <select value={form.vehiclePlateNumber} onChange={(event) => setForm({ ...form, vehiclePlateNumber: event.target.value, tripId: "" })}>
                <option value="">No vehicle link</option>
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
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ExpenseStatus })}>
                {EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{EXPENSE_STATUS_LABELS[status]}</option>)}
              </select>
            </label>

            <label className="finance-wide-field">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} placeholder="Optional expense notes" />
            </label>
          </div>

          {formError && <p className="error finance-form-error">{formError}</p>}

          <div className="finance-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? (editingId ? "Saving..." : "Creating...") : editingId ? "Update expense" : "Create expense"}</button>
            {editingId && <button type="button" className="btn-secondary" onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>

        <section className="finance-table-card">
          <div className="panel-heading finance-table-heading">
            <div>
              <h3>Expense Ledger</h3>
              <p>{records.length} matching entries</p>
            </div>
          </div>

          {pageError && <div className="finance-banner error-banner">{pageError}</div>}

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Links</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.title}</strong><span>{record.vendor ?? "No vendor"}</span></td>
                    <td>{record.category}</td>
                    <td><strong>{record.vehiclePlateNumber ?? "No vehicle"}</strong><span>{record.trip ? `${record.trip.source} → ${record.trip.destination}` : "No trip link"}</span></td>
                    <td><strong>{formatCurrency(record.amount)}</strong><span>{formatDate(record.expenseDate)}</span></td>
                    <td><ExpenseStatusBadge status={record.status} /></td>
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

          {records.length === 0 && <p className="finance-empty">No expenses match the current filters.</p>}
        </section>
      </section>
    </div>
  );
}