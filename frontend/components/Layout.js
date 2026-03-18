import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { getMe, getChannelStatus, getFacebookOAuthUrl, logout } from "../lib/api";

export default function Layout({ children }) {
  const router = useRouter();

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: getChannelStatus, enabled: !!me });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleConnectFacebook = async () => {
    const url = await getFacebookOAuthUrl();
    window.location.href = url;
  };

  const navItems = [
    { label: "Inbox", href: "/inbox" },
    { label: "Contacts", href: "/contacts" },
    { label: "Analytics", href: "/analytics" },
    { label: "Search", href: "/search" },
    { label: "Settings", href: "/settings" },
  ];

  const isActive = (href) => {
    if (href === "/inbox") return router.pathname === "/inbox" || router.pathname.startsWith("/conversation");
    if (href === "/settings") return router.pathname === "/settings" || router.pathname === "/automation";
    return router.pathname === href;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 px-6 py-3 flex items-center justify-between shadow-md shrink-0">
        <span className="font-bold text-xl text-white tracking-tight">POCK</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-indigo-200">{me?.email}</span>
          <button onClick={handleLogout} className="text-sm text-indigo-100 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-indigo-800 min-h-screen p-4 flex flex-col justify-between shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  isActive(item.href)
                    ? "bg-white text-indigo-700 font-semibold"
                    : "text-indigo-200 hover:bg-indigo-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            onClick={handleConnectFacebook}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-700 transition"
          >
            Reconnect Facebook
          </button>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
