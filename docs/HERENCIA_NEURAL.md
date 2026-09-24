# HERENCIA Neural integration

Herencia communicates with an independent HERENCIA Neural service through two server-side boundaries.

## Admin proxy
The browser calls `/api/neural/*` using the existing Herencia admin session. The Herencia backend forwards those requests to `NEURAL_SERVICE_URL/v1/neural/*` with `NEURAL_ADMIN_TOKEN`. The browser never receives the Neural token.

## Business bridge
Neural reads and acts on Herencia through `/api/neural-bridge/*`, authenticated with `HERENCIA_NEURAL_TOKEN`. Write operations additionally require `X-Neural-Action-Id`.

The bridge exposes typed business capabilities rather than unrestricted database access: orders, products, inventory, CRM, suppliers, finance, TPV/cash state, invoices, website drafts/versions and governed communications.

## Events
Herencia pushes business events back to Neural for orders, sales, inventory, product changes, CRM, suppliers, expenses, invoices, website publication/rollback and TPV cash activity. Customer-chat events are accepted only through the sanitized chat bridge and are marked provisional.

## Website changes
Neural Designer operates on the current Visual Builder model. Workflow:
intent → structured operations → draft → preview/state inspection → explicit publish permission → version snapshot → publish → audit. Rollback first creates a safety snapshot.

## Required server variables
- `NEURAL_SERVICE_URL`
- `NEURAL_ADMIN_TOKEN`
- `HERENCIA_NEURAL_TOKEN`

Optional real communication providers:
- `RESEND_API_KEY`, `EMAIL_FROM`
- `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`

If a provider is missing, the backend returns an explicit configuration error; it does not claim the message was delivered.
