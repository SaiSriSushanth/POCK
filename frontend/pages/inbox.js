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

export default function InboxPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("open");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: getChannelStatus });
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", filter],
    queryFn: () => getConversations({ status: filter }),
    enabled: !!me,
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-gray-900">POCK</span>
          {channels && (
            <div className="flex gap-1">
              {Object.entries(channels).map(([ch, connected]) =>
                connected ? (
                  <span key={ch} className="text-sm" title={ch}>
                    {CHANNEL_ICONS[ch]}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{me?.email}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-48 bg-white border-r min-h-screen p-4 flex flex-col justify-between">
          <nav className="space-y-1">
            {["open", "pending", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition ${
                  filter === s ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </nav>
          <button
            onClick={handleConnectFacebook}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-50 transition"
          >
            📘 Reconnect Facebook
          </button>
        </aside>

        {/* Conversation List */}
        <main className="flex-1 p-6">
          {/* No channels banner */}
          {noChannelsConnected && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">No channels connected</p>
                <p className="text-xs text-blue-600 mt-0.5">Connect Facebook to receive WhatsApp, Messenger & Instagram messages.</p>
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

          {!isLoading && (!conversations || conversations.length === 0) && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No {filter} conversations</p>
            </div>
          )}

          <div className="space-y-2">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className="bg-white rounded-lg border p-4 hover:shadow-sm transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CHANNEL_ICONS[conv.source] || "💬"}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {conv.contact?.display_name || conv.contact_id || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">{conv.source}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conv.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[conv.priority] || ""}`}>
                        {conv.priority}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[conv.status] || ""}`}>
                      {conv.status}
                    </span>
                  </div>
                </div>
                {conv.last_message_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last message: {new Date(conv.last_message_at).toLocaleString()}
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
