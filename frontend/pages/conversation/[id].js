import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMe,
  getConversation,
  getConversationMessages,
  updateConversation,
  sendReply,
  addNote,
  getNotes,
  getTeam,
  updateContact,
  logout,
} from "../../lib/api";
import Layout from "../../components/Layout";

const CHANNEL_ICONS = {
  whatsapp: "💬",
  messenger: "📘",
  instagram: "📷",
  slack: "🟣",
};

const STATUS_COLORS = {
  open: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  resolved: "bg-gray-100 text-gray-500 border-gray-200",
};

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const LABEL_COLORS = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function getLabelColor(label) {
  if (!label) return "bg-gray-100 text-gray-500";
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ConversationPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Auth guard
  const { isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) {
    logout();
    router.push("/login");
  }

  // Load single conversation
  const { data: conversation } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
    refetchInterval: 5000,
  });

  // Load messages
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getConversationMessages(id),
    enabled: !!id,
    refetchInterval: 3000,
    onSuccess: (data) => {
      if (!draftLoaded && data && data.length > 0) {
        const last = data[data.length - 1];
        if (last?.classification?.draft_reply) {
          setReplyText(last.classification.draft_reply);
          setDraftLoaded(true);
        }
      }
    },
  });

  // Load notes
  const { data: notes } = useQuery({
    queryKey: ["notes", id],
    queryFn: () => getNotes(id),
    enabled: !!id,
  });

  // Load team members for assignment
  const { data: team } = useQuery({ queryKey: ["team"], queryFn: getTeam, enabled: !!id });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data) => updateConversation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["conversation", id]);
      queryClient.invalidateQueries(["conversations"]);
    },
  });

  const noteMutation = useMutation({
    mutationFn: (text) => addNote(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries(["notes", id]);
      setNoteText("");
    },
  });

  const replyMutation = useMutation({
    mutationFn: (text) => sendReply(id, text),
    onSuccess: () => {
      setReplyText("");
      setDraftLoaded(false);
      setSendError(null);
      queryClient.invalidateQueries(["messages", id]);
      queryClient.invalidateQueries(["conversation", id]);
      queryClient.invalidateQueries(["conversations"]);
    },
    onError: (err) => {
      setSendError(err?.response?.data?.detail || "Failed to send message");
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: (data) => updateContact(contact.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["conversations"]);
      setEditingContact(false);
    },
  });

  if (!id) return null;

  const contact = conversation?.contact;

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Conversation top bar */}
        <div className="bg-white border-b px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">
              {contact?.display_name || "Conversation"}
            </span>
            {conversation?.source && (
              <span className="text-xs text-gray-400 capitalize">{conversation.source}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {["open", "pending", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => updateMutation.mutate({ status: s })}
                className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition font-medium ${
                  conversation?.status === s
                    ? STATUS_COLORS[s]
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
            <select
              value={conversation?.priority || ""}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value || null })}
              className="text-xs border rounded-lg px-2 py-1.5 text-gray-600 bg-white"
            >
              <option value="">No Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Left: Message Thread */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messagesLoading && <p className="text-gray-400 text-sm">Loading messages...</p>}

            {!messagesLoading && (!messages || messages.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-sm">No messages yet</p>
              </div>
            )}

            {messages?.map((msg) => {
              const isAgent = msg.sender_id === "agent";
              return (
              <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                {/* Message bubble */}
                <div className={`rounded-xl p-4 max-w-2xl shadow-sm ${isAgent ? "bg-indigo-600 text-white" : "bg-white border border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm leading-relaxed ${isAgent ? "text-white" : "text-gray-800"}`}>{msg.message_text}</p>
                    <span className={`text-xs shrink-0 ${isAgent ? "text-indigo-200" : "text-gray-400"}`}>{timeAgo(msg.created_at)}</span>
                  </div>

                  {/* Classification badge */}
                  {msg.classification && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLabelColor(
                          msg.classification.predicted_label
                        )}`}
                      >
                        {msg.classification.predicted_label}
                      </span>
                      {msg.classification.final_confidence != null && (
                        <span className="text-xs text-gray-400">
                          {Math.round(msg.classification.final_confidence * 100)}% confidence
                        </span>
                      )}
                      {msg.classification.reasoning && (
                        <span className="text-xs text-gray-400 italic">
                          — {msg.classification.reasoning}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Reply input */}
          <div className="border-t bg-white p-4 shrink-0">
            {messages && messages.length > 0 && messages[messages.length - 1]?.classification?.draft_reply && !draftLoaded && (
              <div className="mb-2 text-xs text-blue-600 flex items-center gap-1">
                <span>AI draft available</span>
                <button
                  onClick={() => {
                    setReplyText(messages[messages.length - 1].classification.draft_reply);
                    setDraftLoaded(true);
                  }}
                  className="underline"
                >
                  Load draft
                </button>
              </div>
            )}
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply... (AI draft loaded if available)"
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {sendError && (
              <p className="text-xs text-red-600 mt-1">{sendError}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">
                {replyText.length > 0 ? `${replyText.length} characters` : "No draft loaded"}
              </span>
              <button
                onClick={() => replyMutation.mutate(replyText.trim())}
                disabled={!replyText.trim() || replyMutation.isLoading}
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {replyMutation.isLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="border-t bg-gray-50 p-4 shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wide">Internal Notes</p>
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
              {notes?.map((note) => (
                <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                  <p className="text-xs text-gray-700">{note.note_text}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(note.created_at)}</p>
                </div>
              ))}
              {(!notes || notes.length === 0) && (
                <p className="text-xs text-gray-400">No notes yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && noteText.trim()) {
                    noteMutation.mutate(noteText.trim());
                  }
                }}
                placeholder="Add internal note..."
                className="flex-1 text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
              <button
                onClick={() => noteText.trim() && noteMutation.mutate(noteText.trim())}
                disabled={!noteText.trim()}
                className="text-xs bg-yellow-400 text-yellow-900 px-3 py-2 rounded-lg hover:bg-yellow-500 disabled:opacity-40 transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right: Contact Sidebar */}
        <aside className="w-64 bg-white border-l overflow-y-auto p-4 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wide">Contact</p>

          {contact ? (
            <div className="space-y-3">
              {editingContact ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Name</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Phone</label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        updateContactMutation.mutate({
                          display_name: contactName || undefined,
                          email: contactEmail || undefined,
                          phone: contactPhone || undefined,
                        })
                      }
                      disabled={updateContactMutation.isLoading}
                      className="flex-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700 disabled:opacity-40 transition"
                    >
                      {updateContactMutation.isLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingContact(false)}
                      className="flex-1 text-xs border border-gray-200 text-gray-500 rounded-lg py-1.5 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{contact.display_name}</p>
                      {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                      {contact.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
                    </div>
                    <button
                      onClick={() => {
                        setContactName(contact.display_name || "");
                        setContactEmail(contact.email || "");
                        setContactPhone(contact.phone || "");
                        setEditingContact(true);
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 transition shrink-0 ml-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {/* Channel badge */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Channel</p>
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                  {CHANNEL_ICONS[conversation?.source] || "💬"} {conversation?.source}
                </span>
              </div>

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact notes */}
              {contact.notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">{contact.notes}</p>
                </div>
              )}

              <button
                onClick={() => router.push(`/contacts?highlight=${contact.id}`)}
                className="w-full text-xs text-blue-600 border border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition"
              >
                View full contact
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No contact linked</p>
          )}

          {/* Assignment */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned To</p>
            <select
              value={conversation?.assigned_to || ""}
              onChange={(e) => updateMutation.mutate({ assigned_to: e.target.value || null })}
              className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Unassigned</option>
              {team?.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}{m.custom_role_name ? ` (${m.custom_role_name})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Conversation meta */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>
            {conversation?.priority && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Priority</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[conversation.priority]}`}>
                  {conversation.priority}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[conversation?.status] || ""}`}>
                {conversation?.status}
              </span>
            </div>
            {conversation?.created_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Started</span>
                <span className="text-xs text-gray-400">{timeAgo(conversation.created_at)}</span>
              </div>
            )}
          </div>
        </aside>
        </div>
      </div>
    </Layout>
  );
}
