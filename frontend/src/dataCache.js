import api from "./api";

/** In-memory GET cache — stale-while-revalidate for faster page switches. */
const store = new Map();
const inflight = new Map();

const TTL_MS = {
  "/clients": 2 * 60 * 1000,
  "/page-settings/client-info": 5 * 60 * 1000,
  "/page-settings/billing": 5 * 60 * 1000,
  "/therapists": 5 * 60 * 1000,
  "/sessions": 90 * 1000,
  "/billing/dashboard": 60 * 1000,
  "/invoices": 90 * 1000,
  "/clients/package-status": 90 * 1000,
  "/leaves": 3 * 60 * 1000,
  "/requests": 60 * 1000,
  "/schedule/week-status": 60 * 1000,
  "/schedule": 45 * 1000,
};

const DEFAULT_TIMEOUT_MS = 20000;
const SLOW_TIMEOUT_MS = 45000;

function timeoutFor(url) {
  const p = pathOf(url);
  if (p === "/sessions" || p === "/billing/dashboard") return SLOW_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

function pathOf(url) {
  return String(url || "").split("?")[0];
}

function cacheKey(url, params) {
  if (!params || !Object.keys(params).length) return pathOf(url);
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return `${pathOf(url)}?${sorted}`;
}

function ttlFor(url) {
  return TTL_MS[pathOf(url)] ?? 45 * 1000;
}

/** Read last cached payload without fetching (instant paint on revisit). */
export function peekCache(url, params) {
  const hit = store.get(cacheKey(url, params));
  return hit?.data ?? null;
}

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out")), ms);
    }),
  ]);
}

export function invalidateCache(prefix) {
  const p = pathOf(prefix);
  for (const key of [...store.keys()]) {
    if (key === p || key.startsWith(`${p}?`)) store.delete(key);
  }
}

export function clearDataCache() {
  store.clear();
  inflight.clear();
}

/** Return cached data immediately if fresh; otherwise fetch (deduped). */
export async function cachedGet(url, { params, force = false, staleOk = true } = {}) {
  const key = cacheKey(url, params);
  const hit = store.get(key);
  const fresh = hit && Date.now() - hit.at < ttlFor(url);

  if (!force && fresh) return hit.data;

  if (inflight.has(key)) return inflight.get(key);

  const req = withTimeout(api.get(url, { params }), timeoutFor(url))
    .then(res => {
      store.set(key, { data: res.data, at: Date.now() });
      inflight.delete(key);
      return res.data;
    })
    .catch(err => {
      inflight.delete(key);
      if (staleOk && hit) return hit.data;
      throw err;
    });

  inflight.set(key, req);
  return req;
}

/** Fire-and-forget warm cache (nav hover / shell mount). */
export function prefetch(url, params) {
  cachedGet(url, { params, staleOk: true }).catch(() => {});
}

/** After POST/PUT/DELETE — drop related list caches. */
export function invalidateForMutation(method, url) {
  const u = pathOf(url);
  if (u.includes("/sessions")) {
    invalidateCache("/sessions");
    invalidateCache("/clients/package-status");
  }
  if (u.includes("/invoices")) {
    invalidateCache("/invoices");
    invalidateCache("/clients/package-status");
  }
  if (u.includes("/clients")) {
    invalidateCache("/clients");
    invalidateCache("/clients/package-status");
  }
  if (u.includes("/schedule")) {
    invalidateCache("/schedule");
  }
  if (u.includes("/preparations")) {
    invalidateCache("/sessions");
    invalidateCache("/schedule");
  }
  if (method !== "GET") invalidateCache("/clients/package-status");
}
