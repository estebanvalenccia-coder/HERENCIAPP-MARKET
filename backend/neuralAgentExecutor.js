import { buildNeuralExecutionPlan, neuralAuditEvent, newNeuralActionId } from "./neuralAgentMode.js";

const ROUTES = Object.freeze({
  read_business_state: i => ({ method: "GET", path: "/api/neural-bridge/full-snapshot" }),
  modify_stock: i => ({ method: "PATCH", path: `/api/neural-bridge/products/${encodeURIComponent(i.productId)}/stock`, body: { stock: i.stock, delta: i.delta } }),
  change_prices: i => ({ method: "PATCH", path: `/api/neural-bridge/products/${encodeURIComponent(i.productId)}/price`, body: { price: i.price } }),
  create_products: i => ({ method: "POST", path: "/api/neural-bridge/products", body: { product: i.product || i } }),
  edit_products: i => ({ method: "PATCH", path: `/api/neural-bridge/products/${encodeURIComponent(i.productId)}`, body: { patch: i.patch || {} } }),
  delete_products: i => ({ method: "DELETE", path: `/api/neural-bridge/products/${encodeURIComponent(i.productId)}` }),
  manage_crm: i => ({ method: "POST", path: "/api/neural-bridge/crm/customers", body: { customer: i.customer || i } }),
  manage_suppliers: i => ({ method: "POST", path: "/api/neural-bridge/suppliers", body: { supplier: i.supplier || i } }),
  record_expenses: i => ({ method: "POST", path: "/api/neural-bridge/finance/expenses", body: i }),
  issue_invoices: i => ({ method: "POST", path: "/api/neural-bridge/invoices", body: i }),
  send_email: i => ({ method: "POST", path: "/api/neural-bridge/communications/email", body: i }),
  send_whatsapp: i => ({ method: "POST", path: "/api/neural-bridge/communications/whatsapp", body: i }),
  prepare_web_changes: i => ({ method: "POST", path: "/api/neural-bridge/web/drafts", body: { title: i.title, operations: i.operations || [] } }),
  publish_web_changes: i => ({ method: "POST", path: `/api/neural-bridge/web/drafts/${encodeURIComponent(i.draftId)}/publish`, body: {} }),
  rollback_web_changes: i => ({ method: "POST", path: `/api/neural-bridge/web/versions/${encodeURIComponent(i.versionId)}/rollback`, body: {} }),
});

export function createNeuralAgentExecutor({ invokeBridge, loadPolicy, appendAudit, savePlan }) {
  if (typeof invokeBridge !== "function") throw new Error("invokeBridge is required");
  return {
    async plan({ intent, steps }) {
      const policy = await loadPolicy();
      const plan = buildNeuralExecutionPlan({ intent, steps, policy });
      await savePlan?.(plan);
      return plan;
    },
    async execute(plan, approvals = {}) {
      const policy = await loadPolicy();
      const fresh = buildNeuralExecutionPlan({ intent: plan.intent, steps: plan.steps.map(s => ({ action: s.action, input: s.input, verify: s.verify })), policy });
      fresh.id = plan.id;
      const results = [];
      for (const step of fresh.steps) {
        const approved = approvals[step.id] === true || approvals[step.action] === true;
        if (step.state === "BLOCKED") { results.push({ stepId: step.id, action: step.action, state: "BLOCKED", reason: step.reason }); continue; }
        if (step.state === "WAITING_APPROVAL" && !approved) { results.push({ stepId: step.id, action: step.action, state: "WAITING_APPROVAL" }); continue; }
        const routeFactory = ROUTES[step.action];
        if (!routeFactory) { results.push({ stepId: step.id, action: step.action, state: "BLOCKED", reason: "no_executor" }); continue; }
        const actionId = newNeuralActionId("exec");
        try {
          const route = routeFactory(step.input || {});
          const result = await invokeBridge({ ...route, actionId });
          const audit = neuralAuditEvent({ planId: fresh.id, stepId: step.id, action: step.action, state: "SUCCEEDED", input: step.input, result });
          await appendAudit?.(audit);
          results.push({ stepId: step.id, action: step.action, state: "SUCCEEDED", actionId, result });
        } catch (error) {
          const audit = neuralAuditEvent({ planId: fresh.id, stepId: step.id, action: step.action, state: "FAILED", input: step.input, error });
          await appendAudit?.(audit);
          results.push({ stepId: step.id, action: step.action, state: "FAILED", actionId, error: String(error?.message || error) });
          break;
        }
      }
      const state = results.some(r => r.state === "FAILED") ? "FAILED" : results.some(r => r.state === "WAITING_APPROVAL") ? "WAITING_APPROVAL" : results.some(r => r.state === "BLOCKED") ? "PARTIAL" : "SUCCEEDED";
      const executed = { ...fresh, state, results, executedAt: new Date().toISOString() };
      await savePlan?.(executed);
      return executed;
    },
  };
}
