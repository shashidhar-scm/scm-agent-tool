import { getApiKeyFromRequest } from "../security/apiKey.js";

export function createAuthMiddleware({ apiKeys, rateLimit }) {
  return (req, res, next) => {
    const key = getApiKeyFromRequest(req);
    if (!key || !apiKeys.has(key)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    try {
      rateLimit(key, req.ip);
    } catch (err) {
      const status = err && typeof err === "object" && "statusCode" in err ? err.statusCode : 429;
      res.status(status).json({ error: "rate_limited" });
      return;
    }

    next();
  };
}
