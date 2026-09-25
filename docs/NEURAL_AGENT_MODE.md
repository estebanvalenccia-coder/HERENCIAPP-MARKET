# HERENCIA Neural — Agent Mode

HERENCIA Neural remains the existing Neural OS (memory, Self Model, cells, learning, goals, reflection, planning and external mentors) and gains a governed execution layer. This is not a second chatbot.

## Execution loop

Every command follows one lifecycle:

`UNDERSTAND -> PLAN -> AUTHORIZE -> EXECUTE -> VERIFY -> AUDIT -> LEARN`

A task is not considered successful merely because an API returned HTTP 200. Neural must verify the resulting business state after every mutation.

## Safety kernel

The existing Permission Kernel (`AUTO / ASK / BLOCK`) remains the source of truth. The action manifest adds risk metadata. The strictest rule wins.

- LOW: read/analysis and reversible preparation. Can normally run automatically.
- MEDIUM: normal business mutations. Requires permission and may require confirmation.
- HIGH: publishing, prices, finance, invoices and external communications. Confirmation by default.
- CRITICAL: payments, purchases and refunds. Blocked by default unless explicitly enabled; always requires explicit confirmation and reconciliation.

Every write carries `X-Neural-Action-Id`. The action id is used to correlate plan, approval, execution, verification, business event and audit trail.

## Tool boundaries

Neural uses typed `/api/neural-bridge/*` capabilities. It does not receive unrestricted Supabase access, arbitrary SQL, arbitrary shell access or production secrets. Secrets remain server-side.

The current bridge already exposes verified business state and governed operations for products/inventory, CRM and website/business workflows. The browser talks only to `/api/neural/*`; the Herencia backend proxies to the independent Neural service using server-side credentials.

## Command examples

- `Revisa el stock y dime qué necesita atención.` -> read + analyze; no mutation.
- `Crea una planta Monstera por 29,90 € con 8 unidades.` -> plan product.create; ask/auto according to policy; create; re-read; audit.
- `Baja todas las plantas tropicales un 10%.` -> generate a preview first; HIGH-risk bulk price change; explicit approval; execute bounded mutations; verify totals.
- `Cambia el hero por esta campaña y publícalo.` -> create website draft; show/record revision; publishing is a separate governed action; verify active revision.
- `Arregla el botón que no funciona.` -> diagnose first. Content/configuration changes may be performed through typed tools. Source-code changes must go through a reviewed Git workflow rather than arbitrary runtime code execution.

## Professional execution record

Each action should retain at least:

- actionId
- conversationId
- initiating admin identity
- original command
- normalized intent
- plan and tool calls
- capability and risk level
- permission decision
- approval identity/time when required
- before snapshot/hash
- execution result
- verification result
- after snapshot/hash
- timestamps and latency
- failure/rollback information

## Rollback

Where a capability supports versions, Neural records the previous revision before mutation. Website publication uses version history. For non-versioned mutations Neural records enough before-state to create a compensating action when safe. Financial/provider transactions are never silently 'rolled back'; they use explicit refund/correction workflows.

## Agent manifest

`backend/neural-action-manifest.json` is the machine-readable contract for capabilities, risk levels and verification requirements. It should be kept in sync with the Neural service tool registry.
