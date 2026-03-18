import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, getTeam, inviteMember, removeMember, getRoles, createRole, deleteRole, logout } from "../lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("team");

  // Team state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  // Role state
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) { logout(); router.push("/login"); }

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: getTeam, enabled: !!me });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: getRoles, enabled: !!me });

  const inviteMutation = useMutation({
    mutationFn: (data) => inviteMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["team"]);
      setInviteEmail(""); setInviteName(""); setInvitePassword(""); setInviteRoleId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => removeMember(id),
    onSuccess: () => queryClient.invalidateQueries(["team"]),
  });

  const createRoleMutation = useMutation({
    mutationFn: (data) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
      setRoleName(""); setRoleDesc("");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => deleteRole(id),
    onSuccess: () => queryClient.invalidateQueries(["roles"]),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-indigo-700 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/inbox")} className="text-sm text-indigo-200 hover:text-white transition">← Inbox</button>
          <span className="font-bold text-xl text-white tracking-tight">Settings</span>
        </div>
        <span className="text-sm text-indigo-200">{me?.email}</span>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {["team", "roles", "automation"].map((t) => (
            <button
              key={t}
              onClick={() => t === "automation" ? router.push("/automation") : setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Team Tab */}
        {tab === "team" && (
          <div className="space-y-6">
            {/* Invite form */}
            {me?.role === "admin" && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Invite Team Member</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Name"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <input
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Temporary password"
                    type="password"
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                  >
                    <option value="">No role assigned</option>
                    {roles?.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => inviteMutation.mutate({ email: inviteEmail, name: inviteName, password: invitePassword, custom_role_id: inviteRoleId || null })}
                  disabled={!inviteEmail || !inviteName || !invitePassword || inviteMutation.isLoading}
                  className="mt-3 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
                >
                  {inviteMutation.isLoading ? "Inviting..." : "Send Invite"}
                </button>
                {inviteMutation.isError && (
                  <p className="text-xs text-red-600 mt-2">{inviteMutation.error?.response?.data?.detail}</p>
                )}
              </div>
            )}

            {/* Team list */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {team?.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name || member.email}</p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.custom_role_name && (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{member.custom_role_name}</span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{member.role}</span>
                    {me?.role === "admin" && member.id !== me?.id && (
                      <button
                        onClick={() => removeMutation.mutate(member.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!team || team.length === 0) && (
                <p className="text-sm text-gray-400 p-5">No team members yet</p>
              )}
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {tab === "roles" && (
          <div className="space-y-6">
            {/* Create role form */}
            {me?.role === "admin" && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Create Role</h3>
                <div className="space-y-3">
                  <input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Role name (e.g. Sales, Support)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <textarea
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    placeholder="Description — what does this role handle?"
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <button
                  onClick={() => createRoleMutation.mutate({ name: roleName, description: roleDesc })}
                  disabled={!roleName || createRoleMutation.isLoading}
                  className="mt-3 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
                >
                  Create Role
                </button>
              </div>
            )}

            {/* Roles list */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {roles?.map((role) => (
                <div key={role.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{role.name}</p>
                    {role.description && <p className="text-xs text-gray-400">{role.description}</p>}
                  </div>
                  {me?.role === "admin" && (
                    <button
                      onClick={() => deleteRoleMutation.mutate(role.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {(!roles || roles.length === 0) && (
                <p className="text-sm text-gray-400 p-5">No roles created yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
