export function buildTargetUrl(baseUrl, proxyPath, query) {
  const normalized = proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`;
  const u = new URL(normalized, baseUrl);

  for (const [k, v] of Object.entries(query || {})) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const vv of v) u.searchParams.append(k, String(vv));
    } else {
      u.searchParams.set(k, String(v));
    }
  }

  return u.toString();
}

export async function proxyGet(req, res, { baseUrl, proxyPath, headers = {} }) {
  const targetUrl = buildTargetUrl(baseUrl, proxyPath, req.query);
  const upstream = await fetch(targetUrl, { method: "GET", headers });
  const buf = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  res.status(upstream.status);
  res.setHeader("content-type", contentType);
  res.send(Buffer.from(buf));
}
