import express from "express";
import { matchAllowlist } from "../security/allowlist.js";
import { buildTargetUrl, proxyGet } from "../proxy.js";

export function createProtectedRouter({ config, adsAuth, contextStore }) {
  const router = express.Router();

  router.get("/context/:key", async (req, res) => {
    try {
      const key = req.params.key || "";
      const value = await contextStore.get(key);
      if (value === undefined) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ key, value });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/campaigns/:id/impressions", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const id = req.params.id;
      const proxyPath = `/api/v1/campaigns/${id}/impressions`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.put("/context/:key", express.json({ limit: "1mb" }), async (req, res) => {
    try {
      const key = req.params.key || "";
      const value = req.body?.value;
      await contextStore.set(key, value);
      res.json({ key, value });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  async function fetchUpstream({ targetUrl, headers = {} }) {
    const upstream = await fetch(targetUrl, { method: "GET", headers });
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    return { status: upstream.status, buf: Buffer.from(buf), contentType };
  }

  function respond(res, { status, contentType, buf }) {
    res.status(status);
    res.setHeader("content-type", contentType);
    res.send(buf);
  }

  async function proxyStream(req, res, { baseUrl, proxyPath, headers = {} }) {
    const targetUrl = buildTargetUrl(baseUrl, proxyPath, req.query);

    const contentLength = req.header("content-length");
    const upstreamHeaders = {
      ...headers,
      ...(contentLength ? { "content-length": contentLength } : {}),
    };

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      // Node fetch requires duplex for streaming request bodies
      duplex: "half",
      body: req,
    });

    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.status(upstream.status);
    res.setHeader("content-type", contentType);
    res.send(Buffer.from(buf));
  }

  async function readRequestBody(req) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  function filenameFromUrl(u) {
    try {
      const p = new URL(u).pathname;
      const last = p.split("/").filter(Boolean).pop();
      return last && last.trim() !== "" ? last : "upload";
    } catch {
      return "upload";
    }
  }

  function isHttpUrl(u) {
    try {
      const url = new URL(u);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  function buildMultipartBody({ boundary, fields, fileFieldName, fileName, fileContentType, fileBytes }) {
    const chunks = [];
    const push = (s) => chunks.push(Buffer.from(s, "utf8"));

    for (const [k, v] of Object.entries(fields)) {
      if (v == null) continue;
      const vv = Array.isArray(v) ? v.join(",") : String(v);
      push(`--${boundary}\r\n`);
      push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
      push(`${vv}\r\n`);
    }

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n`);
    push(`Content-Type: ${fileContentType || "application/octet-stream"}\r\n\r\n`);
    chunks.push(Buffer.from(fileBytes));
    push("\r\n");
    push(`--${boundary}--\r\n`);

    return Buffer.concat(chunks);
  }

  router.get("/ads/advertisers", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/advertisers/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/ads/advertisers", express.json({ limit: "1mb" }), async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/advertisers/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const contentType = req.header("content-type") || "";
      if (!/^application\/json\b/i.test(contentType)) {
        res.status(400).json({
          error: "invalid_content_type",
          message: "Expected application/json for advertiser creation",
        });
        return;
      }

      const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adsAuth.getToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(req.body ?? {}),
      });

      const buf = await upstream.arrayBuffer();
      const resContentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.status(upstream.status);
      res.setHeader("content-type", resContentType);
      res.send(Buffer.from(buf));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/creatives", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/creatives/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/creatives/campaign/:campaignId", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const campaignId = req.params.campaignId;
      const proxyPath = `/api/v1/creatives/campaign/${campaignId}`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/campaigns", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/campaigns/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/projects", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/projects/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/projects/:name", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const name = req.params.name;
      const proxyPath = `/api/v1/projects/${name}`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/devices", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/devices/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/devices/counts/regions", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/devices/counts/regions";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/devices/:hostName", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const hostName = req.params.hostName;
      const proxyPath = `/api/v1/devices/${hostName}`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/venues", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/venues/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/venues/:id", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const id = req.params.id;
      const proxyPath = `/api/v1/venues/${id}`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/venues/:id/devices", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const id = req.params.id;
      const proxyPath = `/api/v1/venues/${id}/devices`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/ads/devices/:deviceId/venues", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const deviceId = req.params.deviceId;
      const proxyPath = `/api/v1/devices/${deviceId}/venues`;
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, {
        baseUrl: config.adsBaseUrl,
        proxyPath,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/ads/campaigns", express.json({ limit: "1mb" }), async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/campaigns/";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const contentType = req.header("content-type") || "";
      if (!/^application\/json\b/i.test(contentType)) {
        res.status(400).json({
          error: "invalid_content_type",
          message: "Expected application/json for campaign creation",
        });
        return;
      }

      const normalizeDateTime = (v) => {
        if (typeof v !== "string") return v;
        const s = v.trim();
        if (s === "") return v;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
        return v;
      };

      const payload = {
        ...(req.body ?? {}),
        start_date: normalizeDateTime(req.body?.start_date),
        end_date: normalizeDateTime(req.body?.end_date),
      };

      const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adsAuth.getToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const buf = await upstream.arrayBuffer();
      const resContentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.status(upstream.status);
      res.setHeader("content-type", resContentType);
      res.send(Buffer.from(buf));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.delete("/pop", async (req, res) => {
    try {
      const proxyPath = "/pop";
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const body = await readRequestBody(req);
      const contentType = req.header("content-type");

      const targetUrl = buildTargetUrl(config.popBaseUrl, proxyPath, req.query);
      const upstream = await fetch(targetUrl, {
        method: "DELETE",
        headers: {
          ...(contentType ? { "content-type": contentType } : {}),
          ...(body?.length ? { "content-length": String(body.length) } : {}),
        },
        body: body?.length ? body : undefined,
      });

      const buf = await upstream.arrayBuffer();
      const resContentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.status(upstream.status);
      res.setHeader("content-type", resContentType);
      res.send(Buffer.from(buf));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/ads/creatives/upload", async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = "/api/v1/creatives/upload";
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const contentType = req.header("content-type");
      if (!contentType) {
        res.status(400).json({ error: "content-type is required" });
        return;
      }

      if (!/^multipart\/form-data\b/i.test(contentType)) {
        res.status(400).json({
          error: "invalid_content_type",
          message: "Expected multipart/form-data for creatives upload",
        });
        return;
      }

      // Buffering avoids upstream multipart parsers that break on streamed/chunked bodies.
      const body = await readRequestBody(req);
      const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adsAuth.getToken()}`,
          "content-type": contentType,
          "content-length": String(body.length),
        },
        body,
      });

      const buf = await upstream.arrayBuffer();
      const resContentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.status(upstream.status);
      res.setHeader("content-type", resContentType);
      res.send(Buffer.from(buf));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post(
    "/ads/creatives/uploadByUrl",
    express.json({ limit: "2mb" }),
    async (req, res) => {
      try {
        await adsAuth.ensureLoggedIn(false);
        const proxyPath = "/api/v1/creatives/upload";
        if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
          res.status(403).json({ error: "forbidden_path" });
          return;
        }

        const { campaign_id, selected_days, time_slots, devices, file_url } = req.body || {};
        if (!campaign_id || !selected_days || !time_slots || !file_url) {
          res.status(400).json({
            error: "bad_request",
            message: "campaign_id, selected_days, time_slots, and file_url are required",
          });
          return;
        }

        if (!isHttpUrl(file_url)) {
          res.status(400).json({ error: "bad_request", message: "file_url must be http(s)" });
          return;
        }

        const download = await fetch(file_url, { method: "GET" });
        if (!download.ok) {
          const t = await download.text().catch(() => "");
          res.status(400).json({
            error: "download_failed",
            message: `Failed to download file_url: HTTP ${download.status} ${download.statusText}`,
            details: t.slice(0, 500),
          });
          return;
        }

        const maxBytes = 25 * 1024 * 1024;
        const cl = Number(download.headers.get("content-length") || "0");
        if (cl && cl > maxBytes) {
          res.status(413).json({ error: "file_too_large", message: `File exceeds ${maxBytes} bytes` });
          return;
        }

        const fileBuf = Buffer.from(await download.arrayBuffer());
        if (fileBuf.length > maxBytes) {
          res.status(413).json({ error: "file_too_large", message: `File exceeds ${maxBytes} bytes` });
          return;
        }

        const boundary = `--------------------------${Math.random().toString(16).slice(2)}${Math.random()
          .toString(16)
          .slice(2)}`;
        const multipart = buildMultipartBody({
          boundary,
          fields: { campaign_id, selected_days, time_slots, devices },
          fileFieldName: "files",
          fileName: filenameFromUrl(file_url),
          fileContentType: download.headers.get("content-type") || "application/octet-stream",
          fileBytes: fileBuf,
        });

        const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
        const upstream = await fetch(targetUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adsAuth.getToken()}`,
            "content-type": `multipart/form-data; boundary=${boundary}`,
            "content-length": String(multipart.length),
          },
          body: multipart,
        });

        const buf = await upstream.arrayBuffer();
        const resContentType = upstream.headers.get("content-type") || "application/octet-stream";
        res.status(upstream.status);
        res.setHeader("content-type", resContentType);
        res.send(Buffer.from(buf));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  router.post(
    "/ads/creatives/uploadByUrls",
    express.json({ limit: "2mb" }),
    async (req, res) => {
      try {
        await adsAuth.ensureLoggedIn(false);
        const proxyPath = "/api/v1/creatives/upload";
        if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
          res.status(403).json({ error: "forbidden_path" });
          return;
        }

        const { campaign_id, selected_days, time_slots, devices, file_urls } = req.body || {};
        if (!campaign_id || !selected_days || !time_slots || !file_urls) {
          res.status(400).json({
            error: "bad_request",
            message: "campaign_id, selected_days, time_slots, and file_urls are required",
          });
          return;
        }

        if (!Array.isArray(file_urls) || file_urls.length === 0) {
          res.status(400).json({ error: "bad_request", message: "file_urls must be a non-empty array" });
          return;
        }

        if (file_urls.length > 20) {
          res.status(400).json({ error: "bad_request", message: "file_urls max is 20" });
          return;
        }

        const results = [];
        for (const file_url of file_urls) {
          try {
            if (!isHttpUrl(file_url)) {
              results.push({ file_url, ok: false, status: 400, error: "bad_request", message: "file_url must be http(s)" });
              continue;
            }

            const download = await fetch(file_url, { method: "GET" });
            if (!download.ok) {
              const t = await download.text().catch(() => "");
              results.push({
                file_url,
                ok: false,
                status: 400,
                error: "download_failed",
                message: `Failed to download file_url: HTTP ${download.status} ${download.statusText}`,
                details: t.slice(0, 500),
              });
              continue;
            }

            const maxBytes = 25 * 1024 * 1024;
            const cl = Number(download.headers.get("content-length") || "0");
            if (cl && cl > maxBytes) {
              results.push({ file_url, ok: false, status: 413, error: "file_too_large", message: `File exceeds ${maxBytes} bytes` });
              continue;
            }

            const fileBuf = Buffer.from(await download.arrayBuffer());
            if (fileBuf.length > maxBytes) {
              results.push({ file_url, ok: false, status: 413, error: "file_too_large", message: `File exceeds ${maxBytes} bytes` });
              continue;
            }

            const boundary = `--------------------------${Math.random().toString(16).slice(2)}${Math.random()
              .toString(16)
              .slice(2)}`;
            const multipart = buildMultipartBody({
              boundary,
              fields: { campaign_id, selected_days, time_slots, devices },
              fileFieldName: "files",
              fileName: filenameFromUrl(file_url),
              fileContentType: download.headers.get("content-type") || "application/octet-stream",
              fileBytes: fileBuf,
            });

            const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
            const upstream = await fetch(targetUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${adsAuth.getToken()}`,
                "content-type": `multipart/form-data; boundary=${boundary}`,
                "content-length": String(multipart.length),
              },
              body: multipart,
            });

            const text = await upstream.text();
            if (!upstream.ok) {
              results.push({
                file_url,
                ok: false,
                status: upstream.status,
                error: "upstream_error",
                message: `Ads upload failed: HTTP ${upstream.status} ${upstream.statusText}`,
                details: text.slice(0, 2000),
              });
              continue;
            }

            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
            results.push({ file_url, ok: true, status: upstream.status, result: parsed });
          } catch (e) {
            results.push({ file_url, ok: false, status: 500, error: "exception", message: e instanceof Error ? e.message : String(e) });
          }
        }

        res.status(207).json({ results });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  router.get("/metrics/latest", async (req, res) => {
    try {
      const proxyPath = "/api/metrics/latest";
      if (!matchAllowlist(proxyPath, config.metricsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.metricsBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/metrics/history", async (req, res) => {
    try {
      const proxyPath = "/api/metrics/history";
      if (!matchAllowlist(proxyPath, config.metricsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.metricsBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/pop", async (req, res) => {
    try {
      const proxyPath = "/pop";
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.popBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/pop/search", async (req, res) => {
    try {
      const proxyPath = "/pop/search";
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.popBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/pop/stats", async (req, res) => {
    try {
      const proxyPath = "/pop/stats";
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.popBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/pop/impressions", async (req, res) => {
    try {
      const proxyPath = "/pop/impressions";
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }
      await proxyGet(req, res, { baseUrl: config.popBaseUrl, proxyPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Power-user proxy routes
  router.get(["/ads", "/ads/*"], async (req, res) => {
    try {
      await adsAuth.ensureLoggedIn(false);
      const proxyPath = req.path === "/ads" ? "/" : req.path.replace(/^\/ads/, "");
      if (!matchAllowlist(proxyPath, config.adsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const targetUrl = buildTargetUrl(config.adsBaseUrl, proxyPath, req.query);
      let result = await fetchUpstream({
        targetUrl,
        headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
      });

      if (result.status === 401 || result.status === 403) {
        await adsAuth.ensureLoggedIn(true);
        result = await fetchUpstream({
          targetUrl,
          headers: { Authorization: `Bearer ${adsAuth.getToken()}` },
        });
      }

      respond(res, result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get(["/metrics", "/metrics/*"], async (req, res) => {
    try {
      const proxyPath = req.path === "/metrics" ? "/" : req.path.replace(/^\/metrics/, "");
      if (!matchAllowlist(proxyPath, config.metricsAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const targetUrl = buildTargetUrl(config.metricsBaseUrl, proxyPath, req.query);
      const result = await fetchUpstream({ targetUrl });
      respond(res, result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get(["/pop/*"], async (req, res) => {
    try {
      const proxyPath = req.path;
      if (!matchAllowlist(proxyPath, config.popAllowlist)) {
        res.status(403).json({ error: "forbidden_path" });
        return;
      }

      const targetUrl = buildTargetUrl(config.popBaseUrl, proxyPath, req.query);
      const result = await fetchUpstream({ targetUrl });
      respond(res, result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
