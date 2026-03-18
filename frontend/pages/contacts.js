import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, getContacts, getContactHistory, updateContact, logout } from "../lib/api";
import Layout from "../components/Layout";

const CHANNEL_ICONS = {
  whatsapp: "💬",
  messenger: "📘",
  instagram: "📷",
  slack: "🟣",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ContactDetail({ contact, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: contact.display_name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    notes: contact.notes || "",
    tags: (contact.tags || []).join(", "),
  });

  const { data: history } = useQuery({
    queryKey: ["contact-history", contact.id],
    queryFn: () => getContactHistory(contact.id),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => updateContact(contact.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["contacts"]);
      setEditing(false);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      display_name: form.display_name,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{contact.display_name || "Contact"}</h2>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs border px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-xs border px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs border px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              {editing ? (
                <input
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-800">{contact.display_name || "—"}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              {editing ? (
                <input
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-800">{contact.email || "—"}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Phone</label>
              {editing ? (
                <input
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-800">{contact.phone || "—"}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tags (comma-separated)</label>
              {editing ? (
                <input
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {contact.tags && contact.tags.length > 0 ? (
                    contact.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            {editing ? (
              <textarea
                rows={3}
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            ) : (
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{contact.notes || "—"}</p>
            )}
          </div>

          {/* Channels */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Channels</p>
            <div className="flex flex-wrap gap-2">
              {contact.channels && contact.channels.length > 0 ? (
                contact.channels.map((ch) => (
                  <span
                    key={`${ch.channel}-${ch.external_id}`}
                    className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                  >
                    {CHANNEL_ICONS[ch.channel] || "💬"} {ch.channel}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">No channels</span>
              )}
            </div>
          </div>

          {/* Message history */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wide">
              Message History ({history?.length || 0})
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history && history.length > 0 ? (
                history.map((msg) => (
                  <div key={msg.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{CHANNEL_ICONS[msg.source] || "💬"}</span>
                      <p className="text-xs text-gray-700">{msg.message_text}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(msg.created_at)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400">No messages found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  const { isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) {
    logout();
    router.push("/login");
  }

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => getContacts(search ? { search } : {}),
    keepPreviousData: true,
  });

  return (
    <Layout>
      <main className="max-w-4xl mx-auto p-6">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Loading contacts...</p>}

        {!isLoading && (!contacts || contacts.length === 0) && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-3xl mb-2">👤</p>
            <p className="text-sm">No contacts found</p>
          </div>
        )}

        <div className="space-y-2">
          {contacts?.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="bg-white rounded-xl border p-4 hover:shadow-sm hover:border-blue-200 transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                    {(contact.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{contact.display_name || "Unknown"}</p>
                    <p className="text-xs text-gray-400">
                      {contact.email || contact.phone || "No contact info"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Channels */}
                  <div className="flex gap-1">
                    {contact.channels?.map((ch) => (
                      <span key={`${ch.channel}-${ch.external_id}`} title={ch.channel} className="text-sm">
                        {CHANNEL_ICONS[ch.channel] || "💬"}
                      </span>
                    ))}
                  </div>

                  {/* Tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex gap-1">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="text-xs text-gray-400">+{contact.tags.length - 2}</span>
                      )}
                    </div>
                  )}

                  <span className="text-xs text-gray-400">{timeAgo(contact.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Contact detail modal */}
      {selectedContact && (
        <ContactDetail contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}
    </Layout>
  );
}
