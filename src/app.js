import express from "express";
import { config } from "./config.js";
import { createRateLimiter } from "./security/rateLimit.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createAdsAuth } from "./services/adsAuth.js";
import { createContextStore } from "./contextStore.js";
import { createPublicRouter } from "./routes/public.js";
import { createProtectedRouter } from "./routes/protected.js";

export function createApp() {
  const app = express();

  const rateLimit = createRateLimiter({
    windowSeconds: config.rateLimitWindowSeconds,
    max: config.rateLimitMax,
  });

  const adsAuth = createAdsAuth({
    adsBaseUrl: config.adsBaseUrl,
    adsServiceIdentifier: config.adsServiceIdentifier,
    adsServicePassword: config.adsServicePassword,
  });

  const contextStore = createContextStore({
    filePath: config.contextStorePath || "",
  });

  app.use(createPublicRouter({ config }));
  app.use(createAuthMiddleware({ apiKeys: config.apiKeys, rateLimit }));
  app.use(createProtectedRouter({ config, adsAuth, contextStore }));

  return { app, config };
}
