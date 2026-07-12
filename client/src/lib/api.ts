import type { DashboardSummary, User } from "../types";
import type { DriverPayload, DriversResponse } from "../types/drivers";

export type VehicleLifecycleStatus = "ACTIVE" | "RETIRED" | "IN_SHOP";

export type TripStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface TripVehicleRef {
  plateNumber: string;
  model: string;
  depot: string;
  capacityKg: number;
  lifecycleStatus: VehicleLifecycleStatus;
}

export interface TripDriverRef {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: "AVAILABLE" | "ON_TRIP" | "ON_LEAVE";
  statusLabel: string;
  assignedVehicle: string | null;
}

export interface TripRecord {
  id: string;
  vehiclePlateNumber: string;
  vehicle: TripVehicleRef | null;
  driver: TripDriverRef;
  source: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: number;
  distanceKm: number;
  startDate: string;
  endDate: string;
  status: TripStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripSummary {
  total: number;
  scheduled: number;
  active: number;
  completed: number;
  cancelled: number;
  totalCargoKg: number;
  totalDistanceKm: number;
}

export interface TripsResponse {
  trips: TripRecord[];
  summary: TripSummary;
}

export interface TripPayload {
  vehiclePlateNumber: string;
  driverId: string;
  source: string;
  destination: string;
  cargoDescription: string;
  cargoWeightKg: number;
  distanceKm: number;
  startDate: string;
  endDate: string;
  status: TripStatus;
}

export interface VehicleRecord {
  id: string;
  plateNumber: string;
  type: "bus" | "van" | "truck";
  model: string;
  depot: string;
  status: "available" | "assigned" | "maintenance";
  capacityKg: number;
  lifecycleStatus: VehicleLifecycleStatus;
  mileageKm: number;
  lastService: string;
  nextService: string;
  assignedDriver: string | null;
}

export interface VehicleRegistryResponse {
  summary: {
    totals: {
      total: number;
      available: number;
      assigned: number;
      maintenance: number;
    };
    byType: {
      bus: number;
      van: number;
      truck: number;
    };
  };
  vehicles: VehicleRecord[];
}

export interface DriverMutationResponse {
  driver: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    licenseExpiryDate: string;
    status: DriverPayload["status"];
    statusLabel: string;
    assignedVehicle: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong");
  }

  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(email: string, password: string, name: string, role: string) {
    return request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, role }),
    });
  },

  logout() {
    return request<{ message: string }>("/auth/logout", { method: "POST" });
  },

  me() {
    return request<{ user: User }>("/auth/me");
  },

  dashboardSummary() {
    return request<DashboardSummary>("/dashboard/summary");
  },

  vehicleRegistry() {
    return request<VehicleRegistryResponse>("/vehicles/registry");
  },

  drivers() {
    return request<DriversResponse>("/drivers");
  },

  trips(query?: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const params = new URLSearchParams();

    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.sortBy) params.set("sortBy", query.sortBy);
    if (query?.sortOrder) params.set("sortOrder", query.sortOrder);

    const suffix = params.toString().length > 0 ? `?${params.toString()}` : "";
    return request<TripsResponse>(`/trips${suffix}`);
  },

  createTrip(payload: TripPayload) {
    return request<{ trip: TripRecord }>("/trips", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateTrip(id: string, payload: TripPayload) {
    return request<{ trip: TripRecord }>(`/trips/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteTrip(id: string) {
    return request<{ message: string }>(`/trips/${id}`, { method: "DELETE" });
  },

  createDriver(payload: DriverPayload) {
    return request<DriverMutationResponse>("/drivers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateDriver(id: string, payload: DriverPayload) {
    return request<DriverMutationResponse>(`/drivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteDriver(id: string) {
    return request<{ message: string }>(`/drivers/${id}`, { method: "DELETE" });
  },
};
