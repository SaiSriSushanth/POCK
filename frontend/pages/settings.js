import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMe, getTeam, inviteMember, removeMember,
  getRoles, createRole, deleteRole,
  getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule,
  getLabels, logout,
} from "../lib/api";
import Layout from "../components/Layout";

const ACTION_TYPES = [
  { value: "assign_to_role", label: "Assign to role" },
  { value: "set_priority", label: "Set priority" },
  { value: "set_status", label: "Set status" },
];

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

  // Automation state
  const [ruleName, setRuleName] = useState("");
  const [triggerLabel, setTriggerLabel] = useState("");
  const [actionType, setActionType] = useState("assign_to_role");
  const [actionValue, setActionValue] = useState("");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) { logout(); router.push("/login"); }

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: getTeam, enabled: !!me });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: getRoles, enabled: !!me });
  const { data: labels } = useQuery({ queryKey: ["labels"], queryFn: getLabels, enabled: !!me });
  const { data: rules } = useQuery({ queryKey: ["automation"], queryFn: getAutomationRules, enabled: !!me });

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
    onSuccess: () => { queryClient.invalidateQueries(["roles"]); setRoleName(""); setRoleDesc(""); },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => deleteRole(id),
    onSuccess: () => queryClient.invalidateQueries(["roles"]),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data) => createAutomationRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["automation"]);
      setRuleName(""); setTriggerLabel(""); setActionType("assign_to_role"); setActionValue("");
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateAutomationRule(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries(["automation"]),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => deleteAutomationRule(id),
    onSuccess: () => queryClient.invalidateQueries(["automation"]),
  });

  const getRoleName = (roleId) => roles?.find((r) => r.id === roleId)?.name || roleId;
  const getActionLabel = (rule) => {
    if (rule.action_type === "assign_to_role") return `Assign to: ${getRoleName(rule.action_value)}`;
    if (rule.action_type === "set_priority") return `Set priority: ${rule.action_value}`;
    if (rule.action_type === "set_status") return `Set status: ${rule.action_value}`;
    return rule.action_value;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {["team", "roles", "automation"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
                      <button onClick={() => removeMutation.mutate(member.id)} className="text-xs text-red-500 hover:text-red-700 transition">
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

            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {roles?.map((role) => (
                <div key={role.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{role.name}</p>
                    {role.description && <p className="text-xs text-gray-400">{role.description}</p>}
                  </div>
                  {me?.role === "admin" && (
                    <button onClick={() => deleteRoleMutation.mutate(role.id)} className="text-xs text-red-500 hover:text-red-700 transition">
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

        {/* Automation Tab */}
        {tab === "automation" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">New Automation Rule</h3>
              <div className="space-y-3">
                <input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Rule name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">When label is</label>
                    <select
                      value={triggerLabel}
                      onChange={(e) => setTriggerLabel(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Select label...</option>
                      {labels?.map((l) => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Then</label>
                    <select
                      value={actionType}
                      onChange={(e) => { setActionType(e.target.value); setActionValue(""); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {ACTION_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Value</label>
                  {actionType === "assign_to_role" && (
                    <select value={actionValue} onChange={(e) => setActionValue(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">Select role...</option>
                      {roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                  {actionType === "set_priority" && (
                    <select value={actionValue} onChange={(e) => setActionValue(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">Select priority...</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  )}
                  {actionType === "set_status" && (
                    <select value={actionValue} onChange={(e) => setActionValue(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">Select status...</option>
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  )}
                </div>
              </div>
              <button
                onClick={() => createRuleMutation.mutate({ name: ruleName, trigger_label: triggerLabel, action_type: actionType, action_value: actionValue })}
                disabled={!ruleName || !triggerLabel || !actionValue || createRuleMutation.isLoading}
                className="mt-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
              >
                Create Rule
              </button>
              {createRuleMutation.isError && (
                <p className="text-xs text-red-600 mt-2">{createRuleMutation.error?.response?.data?.detail}</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="px-5 py-3 bg-slate-50 rounded-t-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Rules</p>
              </div>
              {rules?.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                      <p className="text-xs text-gray-400">
                        When <span className="font-medium text-indigo-600">{rule.trigger_label}</span> → {getActionLabel(rule)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRuleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                      className={`text-xs px-2 py-1 rounded-lg border transition ${rule.is_active ? "border-green-200 text-green-700 hover:bg-green-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                    >
                      {rule.is_active ? "Active" : "Inactive"}
                    </button>
                    <button onClick={() => deleteRuleMutation.mutate(rule.id)} className="text-xs text-red-500 hover:text-red-700 transition">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {(!rules || rules.length === 0) && (
                <p className="text-sm text-gray-400 p-5">No rules yet. Create one above.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
