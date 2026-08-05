// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Best-effort rate limiting for the LLM-backed routes
// ═══════════════════════════════════════════════════════════════════════════════
// The public demo calls the Anthropic API with a single shared server-side key.
// This module throttles that usage per client IP and globally so a visitor
// cannot drain the key. A throttled request degrades to demo mode rather than
// erroring, so the caller still gets a usable draft.
//
// NOTE: serverless functions do not share memory reliably across invocations or
// instances, so this is a best-effort throttle, not a hard guarantee. The
// primary protection is demo mode itself (lib/demoLetter.js): the demo runs
// end to end with no key at all. Tune the limits below for the deployment.
// ═══════════════════════════════════════════════════════════════════════════════

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_IP = 5; // real LLM requests per IP per window
const MAX_GLOBAL = 60; // total real LLM requests per window (spend guard)

const ipHits = new Map(); // ip -> timestamps[]
let globalHits = []; // timestamps[]

function within(list, now) {
  return list.filter((t) => now - t < WINDOW_MS);
}

export function getClientIp(req) {
  const xff = req.headers && req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Returns { allowed: true } or { allowed: false, retryAfter, scope }.
export function checkRateLimit(req, now = Date.now()) {
  const ip = getClientIp(req);

  globalHits = within(globalHits, now);
  if (globalHits.length >= MAX_GLOBAL) {
    return { allowed: false, retryAfter: Math.ceil(WINDOW_MS / 1000), scope: "global" };
  }

  const hits = within(ipHits.get(ip) || [], now);
  if (hits.length >= MAX_PER_IP) {
    return { allowed: false, retryAfter: Math.ceil(WINDOW_MS / 1000), scope: "ip" };
  }

  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);

  // Opportunistic cleanup so the Map does not grow unbounded.
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (within(v, now).length === 0) ipHits.delete(k);
    }
  }

  return { allowed: true };
}
