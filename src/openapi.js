export function getServerBaseUrl({ publicBaseUrl, port }, req) {
  const forwardedProto = (req.header("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = (req.header("x-forwarded-host") || "").split(",")[0].trim();
  const host = forwardedHost || req.header("host") || `127.0.0.1:${port}`;
  const proto = forwardedProto || "http";

  return publicBaseUrl ? publicBaseUrl.replace(/\/+$/, "") : `${proto}://${host}`;
}

export function buildOpenApiSpec({ serverOrigin }) {
  return {
    openapi: "3.1.0",
    info: { title: "SCM Tool Gateway", version: "0.1.0" },
    servers: [{ url: serverOrigin }],
    components: {
      schemas: {},
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/health": {
        get: {
          operationId: "health",
          responses: { "200": { description: "OK" } },
        },
      },
      "/context/{key}": {
        get: {
          operationId: "getContext",
          summary: "Get stored context value by key",
          parameters: [
            { name: "key", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "OK" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
        put: {
          operationId: "setContext",
          summary: "Set stored context value by key",
          parameters: [
            { name: "key", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    value: { description: "Any JSON value" },
                  },
                  required: ["value"],
                },
              },
            },
          },
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/pop/impressions": {
        get: {
          operationId: "popImpressions",
          summary: "Campaign impressions (total + poster breakdown)",
          parameters: [
            { name: "campaign_id", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/advertisers": {
        get: {
          operationId: "listAdvertisers",
          summary: "List advertisers",
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "createAdvertiser",
          summary: "Create advertiser",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    address: { type: "string" },
                    city: { type: "string" },
                    region: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/campaigns/{id}/impressions": {
        get: {
          operationId: "campaignImpressions",
          summary: "Fetch POP-backed lifetime impressions for a campaign",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/campaigns": {
        get: {
          operationId: "listCampaigns",
          summary: "List campaigns (supports query params like advertiser_id)",
          parameters: [
            {
              name: "advertiser_id",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "createCampaign",
          summary: "Create campaign",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    advertiser_id: { type: "string" },
                    name: { type: "string" },
                    budget: { type: "number" },
                    start_date: { type: "string", format: "date-time" },
                    end_date: { type: "string", format: "date-time" },
                    cities: { type: "array", items: { type: "string" } },
                  },
                  required: ["advertiser_id", "name", "budget", "start_date", "end_date"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/projects": {
        get: {
          operationId: "listProjects",
          summary: "List projects",
          responses: {
            "200": { description: "OK" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/projects/{name}": {
        get: {
          operationId: "getProject",
          summary: "Get project by name",
          parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/devices": {
        get: {
          operationId: "listDevices",
          summary: "List devices (supports pagination + filters)",
          parameters: [
            { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 20 } },
            { name: "project_id", in: "query", required: false, schema: { type: "integer" } },
            { name: "city", in: "query", required: false, schema: { type: "string" } },
            { name: "region", in: "query", required: false, schema: { type: "string" } },
            { name: "device_type", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/devices/{hostName}": {
        get: {
          operationId: "getDevice",
          summary: "Get device by hostName",
          parameters: [{ name: "hostName", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/venues": {
        get: {
          operationId: "listVenues",
          summary: "List venues",
          parameters: [
            { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/venues/{id}": {
        get: {
          operationId: "getVenue",
          summary: "Get venue by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/venues/{id}/devices": {
        get: {
          operationId: "getVenueDevices",
          summary: "Get devices by venue",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
            { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not Found" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/devices/{deviceId}/venues": {
        get: {
          operationId: "listVenuesByDevice",
          summary: "List venues by device",
          parameters: [
            { name: "deviceId", in: "path", required: true, schema: { type: "integer" } },
            { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer", default: 20 } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/creatives/upload": {
        post: {
          operationId: "uploadCreatives",
          summary: "Upload creatives (multipart/form-data)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    campaign_id: { type: "string" },
                    selected_days: { type: "string" },
                    time_slots: { type: "string" },
                    devices: { type: "string" },
                    files: { type: "string", format: "binary" },
                  },
                  required: ["campaign_id", "selected_days", "time_slots", "files"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/creatives/uploadByUrl": {
        post: {
          operationId: "uploadCreativesByUrl",
          summary: "Upload creatives by URL (JSON). Gateway downloads file and uploads to Ads API.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    campaign_id: { type: "string" },
                    selected_days: { type: "string" },
                    time_slots: { type: "string" },
                    devices: { type: "string" },
                    file_url: { type: "string" },
                  },
                  required: ["campaign_id", "selected_days", "time_slots", "file_url"],
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "413": { description: "Payload Too Large" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/creatives/uploadByUrls": {
        post: {
          operationId: "uploadCreativesByUrls",
          summary: "Bulk upload creatives by URLs (JSON). Uploads each file_url and returns per-file results.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    campaign_id: { type: "string" },
                    selected_days: { type: "string" },
                    time_slots: { type: "string" },
                    devices: { type: "string" },
                    file_urls: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["campaign_id", "selected_days", "time_slots", "file_urls"],
                },
              },
            },
          },
          responses: {
            "207": { description: "Multi-Status (per-file results)" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "413": { description: "Payload Too Large" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/ads/creatives": {
        get: {
          operationId: "listCreatives",
          summary: "List creatives (query params forwarded)",
          responses: { "200": { description: "OK" } },
        },
      },
      "/ads/creatives/campaign/{campaignId}": {
        get: {
          operationId: "listCreativesByCampaign",
          summary: "List creatives by campaign (query params forwarded)",
          parameters: [
            {
              name: "campaignId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },

	  "/ads/devices/counts/regions": {
		get: {
			operationId: "adsDevicesCountByRegion",
			summary: "Region-wise device counts (grouped by city + region)",
			parameters: [
				{ name: "city", in: "query", required: false, schema: { type: "string" } },
			],
			responses: {
				"200": { description: "OK" },
				"400": { description: "Bad Request" },
				"401": { description: "Unauthorized" },
				"500": { description: "Internal Server Error" },
			},
		},
	  },
      "/metrics/latest": {
        get: {
          operationId: "metricsLatest",
          summary: "Metrics latest",
          responses: { "200": { description: "OK" } },
        },
      },
      "/metrics/history": {
        get: {
          operationId: "metricsHistory",
          summary: "Metrics history (query params forwarded)",
          responses: { "200": { description: "OK" } },
        },
      },
      "/pop": {
        get: {
          operationId: "popList",
          summary: "List POP records (query params forwarded)",
          parameters: [
            { name: "city", in: "query", required: false, schema: { type: "string" } },
            { name: "region", in: "query", required: false, schema: { type: "string" } },
            { name: "kiosk_name", in: "query", required: false, schema: { type: "string" } },
            { name: "host_name", in: "query", required: false, schema: { type: "string" } },
            { name: "poster_type", in: "query", required: false, schema: { type: "string" } },
            { name: "poster_name", in: "query", required: false, schema: { type: "string" } },
            { name: "poster_id", in: "query", required: false, schema: { type: "string" } },
            { name: "poster_created_by", in: "query", required: false, schema: { type: "integer" } },
            { name: "type", in: "query", required: false, schema: { type: "string" } },
            { name: "page", in: "query", required: false, schema: { type: "integer" } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer" } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/pop/search": {
        get: {
          operationId: "popSearch",
          summary: "Search POP records",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/pop/stats": {
        get: {
          operationId: "popStats",
          summary: "Top/bottom performers (posters/devices/kiosks) by plays/clicks/count",
          parameters: [
            { name: "group_by", in: "query", required: false, schema: { type: "string", enum: ["poster", "device", "kiosk"] } },
            { name: "metric", in: "query", required: false, schema: { type: "string", enum: ["plays", "clicks", "value", "count"] } },
            { name: "order", in: "query", required: false, schema: { type: "string", enum: ["top", "bottom"] } },
            { name: "limit", in: "query", required: false, schema: { type: "integer" } },
            { name: "city", in: "query", required: false, schema: { type: "string" } },
            { name: "region", in: "query", required: false, schema: { type: "string" } },
            { name: "last_days", in: "query", required: false, schema: { type: "integer", default: 30 } },
            { name: "from", in: "query", required: false, schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
      "/pop/trend": {
        get: {
          operationId: "popTrend",
          summary: "Trend over time for a poster/device(city) by plays/clicks/count",
          parameters: [
            { name: "dimension", in: "query", required: false, schema: { type: "string", enum: ["poster", "device", "city"] } },
            { name: "key", in: "query", required: true, schema: { type: "string" } },
            { name: "metric", in: "query", required: false, schema: { type: "string", enum: ["plays", "clicks", "value", "count"] } },
            { name: "bucket", in: "query", required: false, schema: { type: "string", enum: ["hour", "day", "week", "month"] } },
            { name: "last_days", in: "query", required: false, schema: { type: "integer", default: 30 } },
            { name: "from", in: "query", required: false, schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          ],
          responses: {
            "200": { description: "OK" },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "500": { description: "Internal Server Error" },
          },
        },
      },
    },
  };
}
