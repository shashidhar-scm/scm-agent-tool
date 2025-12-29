export function createAdsAuth({ adsBaseUrl, adsServiceIdentifier, adsServicePassword }) {
  let adsToken = null;
  let adsTokenExpiresAtMs = null;

  async function login(force = false) {
    if (!adsServiceIdentifier || !adsServicePassword) {
      throw new Error(
        "ADS_SERVICE_IDENTIFIER and ADS_SERVICE_PASSWORD must be set for Option B (service account)"
      );
    }

    if (!force && adsToken && (!adsTokenExpiresAtMs || Date.now() < adsTokenExpiresAtMs)) {
      return;
    }

    const url = new URL("/api/v1/auth/login", adsBaseUrl).toString();
    const payload = JSON.stringify({
      identifier: adsServiceIdentifier,
      password: adsServicePassword,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Ads login failed: HTTP ${res.status} ${res.statusText}: ${text}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Ads login failed: non-JSON response");
    }

    const token = parsed?.access_token;
    if (!token) throw new Error("Ads login failed: access_token missing");

    adsToken = token;

    const expiresIn = Number(parsed?.expires_in);
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      adsTokenExpiresAtMs = Date.now() + expiresIn * 1000 - 10_000;
    } else {
      adsTokenExpiresAtMs = null;
    }
  }

  return {
    ensureLoggedIn: login,
    getToken: () => adsToken,
  };
}
