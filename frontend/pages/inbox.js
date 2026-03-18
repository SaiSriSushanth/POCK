import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getConversations, getChannelStatus, getFacebookOAuthUrl, logout } from "../lib/api";

const CHANNEL_ICONS = {
  whatsapp: "💬",
  messenger: "📘",
  instagram: "📷",
  slack: "🟣",
};

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS = {
  open: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  resolved: "bg-gray-100 text-gray-500",
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
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function InboxPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("open");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: getChannelStatus });
  const {
    data: conversations,
    isLoading,
    error: convError,
  } = useQuery({
    queryKey: ["conversations", filter],
    queryFn: () => getConversations({ status: filter }),
    enabled: !!me,
    retry: false,
  });

  useEffect(() => {
    if (meError) {
      logout();
      router.push("/login");
    }
  }, [meError]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleConnectFacebook = async () => {
    const url = await getFacebookOAuthUrl();
    window.location.href = url;
  };

  const noChannelsConnected = channels && Object.values(channels).every((v) => !v);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-indigo-700 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="font-bold text-xl text-white tracking-tight">POCK</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-indigo-200">{me?.email}</span>
          <button onClick={handleLogout} className="text-sm text-indigo-100 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-48 bg-indigo-800 min-h-screen p-4 flex flex-col justify-between">
          <nav className="space-y-1">
            <p className="text-xs font-semibold text-indigo-300 uppercase px-3 py-1 tracking-wide">Inbox</p>
            {["open", "pending", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition ${
                  filter === s ? "bg-white text-indigo-700 font-semibold" : "text-indigo-200 hover:bg-indigo-700"
                }`}
              >
                {s}
              </button>
            ))}

            <div className="pt-4">
              <p className="text-xs font-semibold text-indigo-300 uppercase px-3 py-1 tracking-wide">Navigation</p>
              <button
                onClick={() => router.push("/contacts")}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 transition"
              >
                Contacts
              </button>
              <button
                onClick={() => router.push("/analytics")}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 transition"
              >
                Analytics
              </button>
              <button
                onClick={() => router.push("/search")}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 transition"
              >
                Search
              </button>
              <button
                onClick={() => router.push("/settings")}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 transition"
              >
                Settings
              </button>
              <button
                onClick={() => router.push("/automation")}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-700 transition"
              >
                Automation
              </button>
            </div>
          </nav>
          <button
            onClick={handleConnectFacebook}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-700 transition"
          >
            Reconnect Facebook
          </button>
        </aside>

        {/* Conversation List */}
        <main className="flex-1 p-6">
          {/* No channels banner */}
          {noChannelsConnected && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">No channels connected</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Connect Facebook to receive WhatsApp, Messenger & Instagram messages.
                </p>
              </div>
              <button
                onClick={handleConnectFacebook}
                className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
              >
                <span>📘</span> Connect Facebook
              </button>
            </div>
          )}

          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4 tracking-wide">
            {filter} conversations
          </h2>

          {isLoading && <p className="text-gray-400 text-sm">Loading...</p>}

          {convError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">Failed to load conversations. Is the API running?</p>
            </div>
          )}

          {!isLoading && !convError && (!conversations || conversations.length === 0) && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No {filter} conversations</p>
            </div>
          )}

          <div className="space-y-2">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => router.push(`/conversation/${conv.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-300 transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" title={conv.source}>
                      {CHANNEL_ICONS[conv.source] || "💬"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {conv.contact?.display_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{conv.source || "unknown channel"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {conv.latest_label && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLabelColor(conv.latest_label)}`}
                        title="AI Classification"
                      >
                        {conv.latest_label}
                      </span>
                    )}
                    {conv.priority && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[conv.priority] || ""}`}
                      >
                        {conv.priority}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[conv.status] || ""}`}
                    >
                      {conv.status}
                    </span>
                  </div>
                </div>

                {conv.last_message_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    {timeAgo(conv.last_message_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
