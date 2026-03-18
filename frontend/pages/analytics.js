import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import {
  getMe,
  getAnalyticsOverview,
  getAnalyticsMessages,
  getAnalyticsLabels,
  getAnalyticsChannels,
  logout,
} from "../lib/api";

const CHANNEL_ICONS = {
  whatsapp: "💬",
  messenger: "📘",
  instagram: "📷",
  slack: "🟣",
};

const LABEL_COLORS = [
  "bg-purple-400",
  "bg-blue-400",
  "bg-pink-400",
  "bg-orange-400",
  "bg-teal-400",
  "bg-indigo-400",
  "bg-red-400",
  "bg-yellow-400",
];

function getLabelBarColor(index) {
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
      {icon && <span className="text-2xl">{icon}</span>}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? "—"}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();

  const { isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) {
    logout();
    router.push("/login");
  }

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: getAnalyticsOverview,
  });

  const { data: messagesData } = useQuery({
    queryKey: ["analytics-messages"],
    queryFn: getAnalyticsMessages,
  });

  const { data: labelsData } = useQuery({
    queryKey: ["analytics-labels"],
    queryFn: getAnalyticsLabels,
  });

  const { data: channelsData } = useQuery({
    queryKey: ["analytics-channels"],
    queryFn: getAnalyticsChannels,
  });

  const maxLabelCount = labelsData
    ? Math.max(...labelsData.map((l) => l.count), 1)
    : 1;

  const maxChannelCount = channelsData
    ? Math.max(...channelsData.map((c) => c.count), 1)
    : 1;

  const maxMsgCount = messagesData
    ? Math.max(...messagesData.map((d) => d.count), 1)
    : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/inbox")}
            className="text-sm text-gray-500 hover:text-gray-900 transition"
          >
            ← Inbox
          </button>
          <span className="font-bold text-lg text-gray-900">Analytics</span>
        </div>
        <button
          onClick={() => router.push("/contacts")}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          👤 Contacts
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Overview Cards */}
        {overviewLoading ? (
          <p className="text-gray-400 text-sm">Loading overview...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Messages"
              value={overview?.total_messages?.toLocaleString()}
              icon="📨"
            />
            <StatCard
              title="Open Conversations"
              value={overview?.open_conversations?.toLocaleString()}
              icon="💬"
            />
            <StatCard
              title="Resolved Today"
              value={overview?.resolved_today?.toLocaleString()}
              icon="✅"
            />
            <StatCard
              title="Avg AI Confidence"
              value={overview?.avg_confidence != null ? `${Math.round(overview.avg_confidence * 100)}%` : "—"}
              icon="🤖"
              subtitle="Hybrid score"
            />
          </div>
        )}

        {/* Messages by day */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Messages per Day (Last 30 days)</h3>
          {messagesData && messagesData.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {messagesData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full bg-blue-400 rounded-t hover:bg-blue-500 transition"
                    style={{ height: `${Math.max(4, (d.count / maxMsgCount) * 112)}px` }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                    <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      {d.day}: {d.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No message data available</p>
          )}
          {messagesData && messagesData.length > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{messagesData[0]?.day}</span>
              <span>{messagesData[messagesData.length - 1]?.day}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Label Distribution */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Label Distribution</h3>
            {labelsData && labelsData.length > 0 ? (
              <div className="space-y-3">
                {labelsData.map((item, idx) => (
                  <div key={item.label || "unknown"}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="font-medium truncate max-w-xs">{item.label || "Unknown"}</span>
                      <span className="text-gray-400 ml-2">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getLabelBarColor(idx)}`}
                        style={{ width: `${(item.count / maxLabelCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No classification data yet</p>
            )}
          </div>

          {/* Messages by Channel */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Messages by Channel</h3>
            {channelsData && channelsData.length > 0 ? (
              <div className="space-y-3">
                {channelsData.map((item) => (
                  <div key={item.source || "unknown"}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="flex items-center gap-1 capitalize font-medium">
                        <span>{CHANNEL_ICONS[item.source] || "💬"}</span>
                        {item.source || "unknown"}
                      </span>
                      <span className="text-gray-400">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-400"
                        style={{ width: `${(item.count / maxChannelCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No channel data yet</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
