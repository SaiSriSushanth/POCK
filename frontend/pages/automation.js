import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, getLabels, getRoles, logout } from "../lib/api";
import Layout from "../components/Layout";

const ACTION_TYPES = [
  { value: "assign_to_role", label: "Assign to role" },
  { value: "set_priority", label: "Set priority" },
  { value: "set_status", label: "Set status" },
];

export default function AutomationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [triggerLabel, setTriggerLabel] = useState("");
  const [actionType, setActionType] = useState("assign_to_role");
  const [actionValue, setActionValue] = useState("");

  const { data: me, isError: meError } = useQuery({ queryKey: ["me"], queryFn: getMe });
  if (typeof window !== "undefined" && meError) { logout(); router.push("/login"); }

  const { data: rules } = useQuery({ queryKey: ["automation"], queryFn: getAutomationRules, enabled: !!me });
  const { data: labels } = useQuery({ queryKey: ["labels"], queryFn: getLabels, enabled: !!me });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: getRoles, enabled: !!me });

  const createMutation = useMutation({
    mutationFn: (data) => createAutomationRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["automation"]);
      setName(""); setTriggerLabel(""); setActionType("assign_to_role"); setActionValue("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateAutomationRule(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries(["automation"]),
  });

  const deleteMutation = useMutation({
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
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Create rule */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Automation Rule</h3>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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

            {/* Action value picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Value</label>
              {actionType === "assign_to_role" && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select role...</option>
                  {roles?.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
              {actionType === "set_priority" && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select priority...</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              )}
              {actionType === "set_status" && (
                <select
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select status...</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              )}
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate({ name, trigger_label: triggerLabel, action_type: actionType, action_value: actionValue })}
            disabled={!name || !triggerLabel || !actionValue || createMutation.isLoading}
            className="mt-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Create Rule
          </button>
          {createMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{createMutation.error?.response?.data?.detail}</p>
          )}
        </div>

        {/* Rules list */}
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
                  onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                  className={`text-xs px-2 py-1 rounded-lg border transition ${rule.is_active ? "border-green-200 text-green-700 hover:bg-green-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                >
                  {rule.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(rule.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
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
    </Layout>
  );
}
