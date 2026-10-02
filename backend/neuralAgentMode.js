import crypto from "node:crypto";

export const NEURAL_AGENT_ACTIONS = Object.freeze({
  read_business_state: { risk: "LOW", permission: "read_business_state", approval: false },
  modify_stock: { risk: "MEDIUM", permission: "modify_stock", approval: false },
  change_prices: { risk: "HIGH", permission: "change_prices", approval: true },
  create_products: { risk: "MEDIUM", permission: "create_products", approval: false },
  edit_products: { risk: "MEDIUM", permission: "edit_products", approval: false },
  delete_products: { risk: "CRITICAL", permission: "delete_products", approval: true },
  prepare_web_changes: { risk: "LOW", permission: "prepare_web_changes", approval: false },
  publish_web_changes: { risk: "HIGH", permission: "publish_web_changes", approval: true },
  rollback_web_changes: { risk: "CRITICAL", permission: "rollback_web_changes", approval: true },
  manage_crm: { risk: "MEDIUM", permission: "manage_crm", approval: false },
  manage_suppliers: { risk: "MEDIUM", permission: "manage_suppliers", approval: false },
  record_expenses: { risk: "HIGH", permission: "record_expenses", approval: true },
  issue_invoices: { risk: "HIGH", permission: "issue_invoices", approval: true },
  send_email: { risk: "HIGH", permission: "send_email", approval: true },
  send_whatsapp: { risk: "HIGH", permission: "send_whatsapp", approval: true },
  purchases: { risk: "CRITICAL", permission: "purchases", approval: true },
  refunds: { risk: "CRITICAL", permission: "refunds", approval: true },
  payments: { risk: "CRITICAL", permission: "payments", approval: true },
});

export function newNeuralActionId(prefix = "na") {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}

export function evaluateNeuralAction(action, policy = {}) {
  const spec = NEURAL_AGENT_ACTIONS[action];
  if (!spec) return { allowed: false, state: "BLOCKED", reason: "unknown_action" };
  if (policy.autonomy === "STOPPED") return { allowed: false, state: "BLOCKED", reason: "autonomy_stopped", spec };
  const mode = policy.permissions?.[spec.permission] || "BLOCK";
  if (mode === "BLOCK") return { allowed: false, state: "BLOCKED", reason: "permission_blocked", spec, mode };
  const needsApproval = spec.approval || mode === "ASK";
  return { allowed: !needsApproval, state: needsApproval ? "WAITING_APPROVAL" : "READY", reason: needsApproval ? "approval_required" : "authorized", spec, mode };
}

export function buildNeuralExecutionPlan({ intent, steps = [], policy = {} }) {
  const planId = newNeuralActionId("plan");
  const normalized = steps.map((step, index) => {
    const action = String(step.action || "");
    const gate = evaluateNeuralAction(action, policy);
    return {
      id: newNeuralActionId(`step${index + 1}`),
      action,
      input: step.input || {},
      verify: step.verify || null,
      ...gate,
    };
  });
  return {
    id: planId,
    intent: String(intent || "").slice(0, 1000),
    state: normalized.some(s => s.state === "BLOCKED") ? "BLOCKED" : normalized.some(s => s.state === "WAITING_APPROVAL") ? "WAITING_APPROVAL" : "READY",
    steps: normalized,
    createdAt: new Date().toISOString(),
  };
}

export function neuralAuditEvent({ planId, stepId, action, state, input, result, error }) {
  return {
    id: newNeuralActionId("audit"),
    planId,
    stepId,
    action,
    state,
    input: input || null,
    result: result || null,
    error: error ? String(error?.message || error) : null,
    at: new Date().toISOString(),
  };
}
