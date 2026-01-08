import { startServer } from "./server.js";

// Node < 18 does not provide global fetch. Use undici to polyfill.
// This keeps the gateway compatible with older Node runtimes.
import { fetch, Headers, Request, Response } from "undici";

if (typeof globalThis.fetch !== "function") {
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

startServer();
