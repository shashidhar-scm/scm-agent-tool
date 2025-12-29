import { env } from "./utils/env.js";

const parseCsv = (v) =>
  String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  port: Number(env("PORT", "7070")),

  adsBaseUrl: env("SCM_ADS_API_BASE_URL", "http://localhost:9000"),
  metricsBaseUrl: env("SCM_METRICS_API_BASE_URL", "http://localhost:8080"),
  popBaseUrl: env("SCM_POP_API_BASE_URL", "https://pop-api.citypost.us"),

  adsServiceIdentifier: env("ADS_SERVICE_IDENTIFIER"),
  adsServicePassword: env("ADS_SERVICE_PASSWORD"),

  contextStorePath: env("CONTEXT_STORE_PATH", ""),

  publicBaseUrl: env("PUBLIC_BASE_URL", ""),

  rateLimitWindowSeconds: Number(env("RATE_LIMIT_WINDOW_SECONDS", "60")),
  rateLimitMax: Number(env("RATE_LIMIT_MAX", "120")),

  adsAllowlist: parseCsv(env("ADS_ALLOWLIST", "")),
  metricsAllowlist: parseCsv(env("METRICS_ALLOWLIST", "")),
  popAllowlist: parseCsv(env("POP_ALLOWLIST", "")),

  apiKeys: new Set(
    [env("TOOL_GATEWAY_API_KEYS"), env("TOOL_GATEWAY_API_KEY")]
      .filter(Boolean)
      .flatMap((v) => parseCsv(v))
  ),
};

if (config.apiKeys.size === 0) {
  throw new Error("TOOL_GATEWAY_API_KEY or TOOL_GATEWAY_API_KEYS is required");
}
