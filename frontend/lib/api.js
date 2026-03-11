import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE });

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("pock_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(email, password) {
  const form = new URLSearchParams({ username: email, password });
  const res = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem("pock_token", res.data.access_token);
  return res.data;
}

export async function register(email, password, name, businessName) {
  const res = await api.post("/auth/register", {
    email,
    password,
    name,
    business_name: businessName,
  });
  localStorage.setItem("pock_token", res.data.access_token);
  return res.data;
}

export function logout() {
  localStorage.removeItem("pock_token");
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function getConversations(params = {}) {
  const res = await api.get("/conversations", { params });
  return res.data;
}

export async function getChannelStatus() {
  const res = await api.get("/businesses/channels");
  return res.data;
}
