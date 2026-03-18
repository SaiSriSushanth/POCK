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

// ── Auth ─────────────────────────────────────────────────────────────────────

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

// ── Businesses / Channels ─────────────────────────────────────────────────────

export async function getChannelStatus() {
  const res = await api.get("/businesses/channels");
  return res.data;
}

export async function getFacebookOAuthUrl() {
  const res = await api.get("/businesses/oauth/facebook/url");
  return res.data.url;
}

export async function connectFacebook(code) {
  const res = await api.get(`/businesses/oauth/facebook/callback?code=${code}`);
  return res.data;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(params = {}) {
  const res = await api.get("/conversations", { params });
  return res.data;
}

export async function getConversation(id) {
  // The list endpoint returns all conversations; fetch detail via messages
  // We get the conversation from the list to avoid a separate detail endpoint
  const res = await api.get("/conversations", { params: {} });
  return res.data.find((c) => c.id === id) || null;
}

export async function getConversationMessages(id) {
  const res = await api.get(`/conversations/${id}/messages`);
  return res.data;
}

export async function updateConversation(id, data) {
  const res = await api.patch(`/conversations/${id}`, data);
  return res.data;
}

export async function sendReply(conversationId, text) {
  const res = await api.post(`/conversations/${conversationId}/reply`, { text });
  return res.data;
}

export async function addNote(conversationId, text) {
  const res = await api.post(`/conversations/${conversationId}/notes`, { text });
  return res.data;
}

export async function getNotes(conversationId) {
  const res = await api.get(`/conversations/${conversationId}/notes`);
  return res.data;
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getContacts(params = {}) {
  const res = await api.get("/contacts", { params });
  return res.data;
}

export async function getContact(id) {
  const res = await api.get(`/contacts/${id}`);
  return res.data;
}

export async function getContactHistory(id) {
  const res = await api.get(`/contacts/${id}/history`);
  return res.data;
}

export async function updateContact(id, data) {
  const res = await api.patch(`/contacts/${id}`, data);
  return res.data;
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function getLabels() {
  const res = await api.get("/labels");
  return res.data;
}

export async function createLabel(data) {
  const res = await api.post("/labels", data);
  return res.data;
}

export async function deleteLabel(id) {
  await api.delete(`/labels/${id}`);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalyticsOverview() {
  const res = await api.get("/analytics/overview");
  return res.data;
}

export async function getAnalyticsMessages() {
  const res = await api.get("/analytics/messages");
  return res.data;
}

export async function getAnalyticsLabels() {
  const res = await api.get("/analytics/labels");
  return res.data;
}

export async function getAnalyticsChannels() {
  const res = await api.get("/analytics/channels");
  return res.data;
}
