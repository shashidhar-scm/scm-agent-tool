import express from "express";
import { buildOpenApiSpec, getServerBaseUrl } from "../openapi.js";

export function createPublicRouter({ config }) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  router.get(["/privacy", "/privacy.html"], (req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy Policy - SCM Tool Gateway</title>
  </head>
  <body>
    <h1>Privacy Policy</h1>
    <p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>

    <h2>Overview</h2>
    <p>
      This privacy policy describes how the SCM Tool Gateway (the "Service") processes requests made through
      integrations such as AI assistants and other clients.
    </p>

    <h2>Data We Process</h2>
    <ul>
      <li>API key presented with requests (used for authentication and abuse prevention)</li>
      <li>Request metadata (path, query parameters, timestamps)</li>
      <li>Client network metadata (e.g. IP address) as provided by your network or hosting provider</li>
      <li>Response metadata (status codes, error messages)</li>
    </ul>

    <h2>How We Use Data</h2>
    <ul>
      <li>To authenticate requests and route them to upstream services</li>
      <li>To enforce rate limits and protect the Service from abuse</li>
      <li>To troubleshoot reliability issues</li>
    </ul>

    <h2>Sharing</h2>
    <p>
      Requests are forwarded to upstream services you are attempting to access (e.g. Ads API, Metrics API).
      We do not sell personal information.
    </p>

    <h2>Retention</h2>
    <p>
      Operational logs (if enabled) are retained for a limited period for security and debugging purposes.
    </p>

    <h2>Contact</h2>
    <p>
      For questions, contact: <a href="mailto:shashidhar@smartcitymedia.us">shashidhar@smartcitymedia.us</a>
    </p>
  </body>
</html>`);
  });

  router.get("/openapi.json", (req, res) => {
    const baseUrl = getServerBaseUrl({ publicBaseUrl: config.publicBaseUrl, port: config.port }, req);
    const url = new URL("/openapi.json", baseUrl);
    const spec = buildOpenApiSpec({ serverOrigin: url.origin });
    res.json(spec);
  });

  return router;
}
