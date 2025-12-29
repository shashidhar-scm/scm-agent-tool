import { createApp } from "./app.js";

export function startServer() {
  const { app, config } = createApp();

  app.listen(config.port, "0.0.0.0", () => {
    // Intentionally no verbose logging
  });
}
