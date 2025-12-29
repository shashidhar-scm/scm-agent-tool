import fs from "fs/promises";
import path from "path";

function isObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

async function readJsonFile(p) {
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) return {};
  return parsed;
}

async function writeJsonFileAtomic(p, obj) {
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export function createContextStore({ filePath }) {
  let data = {};
  let loaded = false;

  async function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    if (!filePath) {
      data = {};
      return;
    }
    try {
      data = await readJsonFile(filePath);
    } catch (err) {
      // If file doesn't exist or can't be read, start fresh.
      data = {};
    }
  }

  function isValidKey(k) {
    // URL path segment safe-ish; keep it strict.
    return typeof k === "string" && /^[a-zA-Z0-9_.:\/-]{1,200}$/.test(k);
  }

  async function get(key) {
    await ensureLoaded();
    if (!isValidKey(key)) throw new Error("invalid key");
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
  }

  async function set(key, value) {
    await ensureLoaded();
    if (!isValidKey(key)) throw new Error("invalid key");
    data[key] = value;
    if (filePath) {
      await writeJsonFileAtomic(filePath, data);
    }
    return value;
  }

  return { get, set, isValidKey };
}
