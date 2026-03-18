import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getConversations, logout } from "../lib/api";
import Layout from "../components/Layout";

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
  const {
    data: conversations,
    isLoading,
    error: convError,
  } = useQuery({
    queryKey: ["conversations", filter],
    queryFn: () => getConversations({ status: filter }),
    enabled: !!me,
    retry: false,
    refetchInterval: 10000,
  });

  const { data: openConvs } = useQuery({ queryKey: ["conversations", "open"], queryFn: () => getConversations({ status: "open" }), enabled: !!me, refetchInterval: 10000 });
  const { data: pendingConvs } = useQuery({ queryKey: ["conversations", "pending"], queryFn: () => getConversations({ status: "pending" }), enabled: !!me, refetchInterval: 10000 });
  const { data: resolvedConvs } = useQuery({ queryKey: ["conversations", "resolved"], queryFn: () => getConversations({ status: "resolved" }), enabled: !!me, refetchInterval: 10000 });

  const counts = { open: openConvs?.length ?? 0, pending: pendingConvs?.length ?? 0, resolved: resolvedConvs?.length ?? 0 };

  useEffect(() => {
    if (meError) {
      logout();
      router.push("/login");
    }
  }, [meError]);

  return (
    <Layout>
      <div className="flex h-full">
        {/* Filter sidebar */}
        <div className="w-36 bg-indigo-900 min-h-screen p-3 shrink-0">
          <p className="text-xs font-semibold text-indigo-300 uppercase px-2 py-1 tracking-wide mb-1">Filter</p>
          {["open", "pending", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`w-full text-left px-2 py-2 rounded-lg text-sm capitalize transition flex items-center justify-between ${
                filter === s ? "bg-white text-indigo-700 font-semibold" : "text-indigo-200 hover:bg-indigo-700"
              }`}
            >
              <span>{s}</span>
              <span className={`text-xs px-1.5 rounded-full font-semibold ${filter === s ? "bg-indigo-100 text-indigo-700" : "bg-indigo-700 text-indigo-200"}`}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <main className="flex-1 p-6">
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
                    {conv.assigned_to_name && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {conv.assigned_to_name}
                      </span>
                    )}
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

                {conv.last_message_text && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {conv.last_message_text.length > 80
                      ? conv.last_message_text.slice(0, 80) + "..."
                      : conv.last_message_text}
                  </p>
                )}

                {conv.last_message_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {timeAgo(conv.last_message_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </Layout>
  );
}
