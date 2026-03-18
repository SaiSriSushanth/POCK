import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { getMe, searchMessages, logout } from "../lib/api";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) { logout(); router.push("/login"); }

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => searchMessages(submitted),
    enabled: !!submitted,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSubmitted(query.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-indigo-700 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/inbox")} className="text-sm text-indigo-200 hover:text-white transition">← Inbox</button>
          <span className="font-bold text-xl text-white tracking-tight">Search</span>
        </div>
        <span className="text-sm text-indigo-200">{me?.email}</span>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Search
          </button>
        </form>

        {isLoading && <p className="text-sm text-gray-400">Searching...</p>}

        {results && results.length === 0 && submitted && (
          <p className="text-sm text-gray-400">No results for "{submitted}"</p>
        )}

        <div className="space-y-2">
          {results?.map((r) => (
            <div
              key={r.message_id}
              onClick={() => r.conversation_id && router.push(`/conversation/${r.conversation_id}`)}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-800">{r.message_text}</p>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(r.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">{r.contact_name}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500 capitalize">{r.source}</span>
                {r.label && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{r.label}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
