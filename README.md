# SCM Tool Gateway (HTTP)

A small **public HTTP** gateway intended for non-MCP AI clients (ChatGPT Actions, Gemini integrations, custom agents, etc.).

It provides:

- API key auth
- GET-only proxy to:
  - `scm-ads-api` (JWT obtained via a service account login; cached)
  - `scm-metrics-api`
- A simple OpenAPI document at `GET /openapi.json`

## Install

```bash
npm install
```

## Run

Required env:

- `TOOL_GATEWAY_API_KEY` (your public gateway key)
- `ADS_SERVICE_IDENTIFIER` (ads-api login identifier)
- `ADS_SERVICE_PASSWORD` (ads-api login password)

Optional env:

- `PORT` (default: `7070`)
- `SCM_ADS_API_BASE_URL` (default: `http://localhost:9000`)
- `SCM_METRICS_API_BASE_URL` (default: `http://localhost:8080`)

Run:

```bash
TOOL_GATEWAY_API_KEY=... \
ADS_SERVICE_IDENTIFIER=... \
ADS_SERVICE_PASSWORD=... \
npm start
```

## Auth

Send API key using either:

- `X-API-Key: <key>`
- or `Authorization: Bearer <key>`

### Key rotation

To rotate keys without downtime, set:

- `TOOL_GATEWAY_API_KEYS` as a comma-separated list of valid keys.

You can keep the old key and add the new key during a transition window, then remove the old key later.

`TOOL_GATEWAY_API_KEY` is still supported for backward compatibility.

### Rate limiting

Simple fixed-window rate limit (in-memory per pod):

- `RATE_LIMIT_WINDOW_SECONDS` (default: `60`)
- `RATE_LIMIT_MAX` (default: `120`)

Limit is enforced per `(apiKey, ip)`.

### Allowlist paths

Restrict which upstream paths can be accessed. If unset/empty, all paths are allowed.

- `ADS_ALLOWLIST` (comma-separated patterns)
- `METRICS_ALLOWLIST` (comma-separated patterns)

Pattern rules:

- Exact match: `/api/v1/advertisers/`
- Prefix match: `/api/v1/advertisers/*`
- Allow all: `*`

### OpenAPI server URL

Set `PUBLIC_BASE_URL` (e.g. `https://tool-gateway.citypost.us`) so `GET /openapi.json` returns the correct `servers` URL for external integrations.

## Routes

- `GET /health`
- `GET /openapi.json` (public)
- `GET /ads/*` -> proxies to `SCM_ADS_API_BASE_URL/*` with cached Ads JWT
- `GET /metrics/*` -> proxies to `SCM_METRICS_API_BASE_URL/*`

### Examples

List advertisers:

```bash
curl -H "X-API-Key: $TOOL_GATEWAY_API_KEY" \
  "http://localhost:7070/ads/api/v1/advertisers/"
```

Metrics latest:

```bash
curl -H "X-API-Key: $TOOL_GATEWAY_API_KEY" \
  "http://localhost:7070/metrics/api/metrics/latest"
```

## Kubernetes (multi-arch image)

Build and push a multi-arch image (recommended to avoid `exec format error` when your cluster nodes are `amd64` but your dev machine is `arm64`, or vice versa):

```bash
docker buildx create --use --name scm-builder || true
docker buildx build --platform linux/amd64,linux/arm64 -t smartcitymedia/scm-tool-gateway-http:0.0.6 --push .
```

Then set the image in `k8s/deployment.yaml` and apply manifests:

```bash
kubectl apply -f ./k8s/secret.yaml
kubectl apply -f ./k8s/deployment.yaml
kubectl apply -f ./k8s/service.yaml
kubectl apply -f ./k8s/ingress.yaml
kubectl rollout status deploy/scm-tool-gateway -n backend
```

Verify:

```bash
kubectl rollout status deploy/scm-tool-gateway -n backend
curl -H "X-API-Key: <key>" https://tool-gateway.citypost.us/health
kubectl apply -f ./k8s/deployment.yaml
kubectl rollout status deploy/scm-tool-gateway -n backend

```
