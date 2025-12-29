export function getApiKeyFromRequest(req) {
  const x = req.header("x-api-key");
  if (x && x.trim() !== "") return x.trim();

  const auth = req.header("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();

  return "";
}
