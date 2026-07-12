import type { DashboardSummary, User } from "../types";

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
};
