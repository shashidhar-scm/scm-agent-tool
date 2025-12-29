# tool-gateway-http WORKLOG

This document records why changes were made so the next agent can understand the current shape of `tool-gateway-http`.

### Gateway purpose
- Provides an API-key-protected public surface for AI agents (e.g., ChatGPT Actions) to reach internal systems such as `scm-ads-api`.
- Handles JWT login to Ads API and enforces allowlists before proxying GET requests.
- Hosts human-readable documentation (`README.md`, `agent_instructions.md`) so operators know how to configure their agents.

## 2025-12-29

### Devices counts proxy + documentation
- Added a proxied `GET /ads/devices/counts/regions` route that forwards to the Ads API `GET /api/v1/devices/counts/regions`, including allowlist enforcement and token passthrough so agents can fetch per-region/city device counts through the gateway (@tool-gateway-http/src/routes/protected.js#267-320).
- Documented the new route in the public OpenAPI description so downstream agents discover the aggregator endpoint and its optional `city` filter (@tool-gateway-http/src/openapi.js#397-411). This is critical because the connector sometimes over-fetches `/ads/devices`; now agents can be instructed to use the lighter aggregate endpoint.

### Agent operating guide
- Created `agent_instructions.md` containing the SCM-ADS-ASSISTANT execution rules: automatic dashboard loading, POP totals via `popList`, kiosk counts via `/ads/devices/counts/regions`, Google Drive creative-upload workflow, context storage expectations, and a “no browsing” policy (@tool-gateway-http/agent_instructions.md#1-75). These instructions are meant to be pasted directly into GPT configuration so it always prefers gateway tools over web search.
