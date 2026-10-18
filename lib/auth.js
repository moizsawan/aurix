// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Server-Side Authentication
// ═══════════════════════════════════════════════════════════════════════════════
// Two modes, chosen by whether AURIX_USERS is configured.
//
//   Not configured  -> DEMO. The public sandbox keeps its published accounts and
//                      behaves exactly as before. No PHI belongs there.
//   Configured      -> REAL. Credentials are verified only on the server against
//                      scrypt hashes, and the session travels in an httpOnly,
//                      HMAC-signed cookie. The demo accounts are not consulted.
//
// The mode is deliberately fail-closed: if AURIX_USERS is present but malformed,
// or AURIX_SESSION_SECRET is missing, authentication is REFUSED rather than
// quietly falling back to the published demo credentials. A practice deployment
// that silently accepted dr.smith@clinic.com would be worse than no auth at all,
// because it would look configured.
//
// Built on node:crypto only. No dependencies, so there is no supply chain to
// audit beyond the Node runtime itself.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "crypto";

// scrypt parameters. N is the dominant cost; 2^15 keeps a single verification
// in the tens of milliseconds on modern hardware, which is a reasonable brake on
// offline cracking without making a login feel slow.
const SCRYPT_N = 32768;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// scrypt needs about 128 * N * r bytes, which at these parameters is exactly
// 32 MiB and therefore lands on Node's default maxmem ceiling. Derive the
// allowance from the parameters, with headroom, so raising N later does not
// reintroduce a RangeError at the first login.
const maxmemFor = (N, r) => 128 * N * r * 2;

// Upper bound on what a stored hash is allowed to request. Without this, a
// crafted hash string could ask for a gigabyte of memory on every login
// attempt, which is a denial-of-service lever on an unauthenticated endpoint.
const MAX_ALLOWED_N = 131072;

export const SESSION_COOKIE = "ax_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // one clinical shift

// ─── PASSWORD HASHING ─────────────────────────────────────────────────────────

// Self-describing so the cost parameters travel with the hash and an old hash
// stays verifiable after the defaults change.
//   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
export function hashPassword(password, salt = randomBytes(SALT_LEN)) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("hashPassword requires a non-empty password");
  }
  const key = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: maxmemFor(SCRYPT_N, SCRYPT_r),
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  // Refuse absurd parameters rather than letting a crafted hash string pin the
  // process in a memory-hard computation.
  if (N < 1024 || N > MAX_ALLOWED_N || r < 1 || r > 32 || p < 1 || p > 16) return false;
  // N must be a power of two or scrypt rejects it outright.
  if ((N & (N - 1)) !== 0) return false;

  let salt, expected;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual;
  try {
    actual = scryptSync(password, salt, expected.length, {
      N, r, p, maxmem: maxmemFor(N, r),
    });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// ─── USER DIRECTORY ───────────────────────────────────────────────────────────

// AURIX_USERS is a JSON array:
//   [{"email":"a@b.com","name":"Dr A B","role":"clinician","hash":"scrypt$..."}]
// `role` is "clinician" or "patient"; a patient entry may also carry patientId.
export function parseUsers(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { configured: false, users: [], error: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { configured: true, users: [], error: "AURIX_USERS is not valid JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { configured: true, users: [], error: "AURIX_USERS must be a JSON array" };
  }
  if (parsed.length === 0) {
    return { configured: true, users: [], error: "AURIX_USERS is an empty array" };
  }

  const users = [];
  for (const [i, u] of parsed.entries()) {
    if (!u || typeof u !== "object") {
      return { configured: true, users: [], error: `AURIX_USERS[${i}] is not an object` };
    }
    if (typeof u.email !== "string" || !u.email.includes("@")) {
      return { configured: true, users: [], error: `AURIX_USERS[${i}] needs an email` };
    }
    if (typeof u.hash !== "string" || !u.hash.startsWith("scrypt$")) {
      // The hash format uses $ as its field separator, which is the crypt
      // convention but means a shell will expand it inside DOUBLE quotes and
      // silently eat part of the hash. That failure is otherwise baffling: the
      // operator pasted a valid hash and is told it is not one. Detect the
      // signature of it and say what actually happened.
      const mangled =
        typeof u.hash === "string" &&
        u.hash.startsWith("scrypt") &&
        !u.hash.startsWith("scrypt$");
      return {
        configured: true,
        users: [],
        error: mangled
          ? `AURIX_USERS[${i}] (${u.email}) has a hash whose $ separators were stripped. A shell expanded them because AURIX_USERS was set inside DOUBLE quotes. Use single quotes: AURIX_USERS='[...]'`
          : `AURIX_USERS[${i}] (${u.email}) needs a scrypt hash; generate one with "npm run hash-password"`,
      };
    }
    if (u.hash.split("$").length !== 6) {
      return {
        configured: true,
        users: [],
        error: `AURIX_USERS[${i}] (${u.email}) has a hash with ${u.hash.split("$").length} fields instead of 6. If it was set inside double quotes, a shell ate part of it; use single quotes.`,
      };
    }
    const role = u.role === "patient" ? "patient" : "clinician";
    users.push({
      email: u.email.trim().toLowerCase(),
      name: typeof u.name === "string" && u.name ? u.name : u.email,
      role,
      hash: u.hash,
      ...(u.title ? { title: u.title } : {}),
      ...(role === "patient" && u.patientId ? { patientId: u.patientId } : {}),
    });
  }
  return { configured: true, users, error: null };
}

export function findUser(users, email) {
  if (typeof email !== "string") return null;
  const needle = email.trim().toLowerCase();
  return users.find((u) => u.email === needle) || null;
}

// ─── SESSION TOKENS ───────────────────────────────────────────────────────────

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function signSession(payload, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error("signSession requires a secret");
  const body = { ...payload, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS };
  const encoded = b64url(JSON.stringify(body));
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifySession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const encoded = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let body;
  try {
    body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  if (typeof body.exp !== "number" || body.exp <= nowSeconds) return null;
  return body;
}

// ─── COOKIE HELPERS ───────────────────────────────────────────────────────────

export function serializeSessionCookie(token, { secure = true, maxAge = SESSION_TTL_SECONDS } = {}) {
  const bits = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

export function clearSessionCookie({ secure = true } = {}) {
  return serializeSessionCookie("", { secure, maxAge: 0 });
}

export function readSessionCookie(cookieHeader) {
  if (typeof cookieHeader !== "string") return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      const v = part.slice(eq + 1).trim();
      return v.length ? v : null;
    }
  }
  return null;
}

// ─── RUNTIME CONFIGURATION ────────────────────────────────────────────────────

// Resolves the deployment's auth posture from the environment. Returns one of:
//   { mode: "demo" }                      no AURIX_USERS, public sandbox behaviour
//   { mode: "configured", users, secret } real auth, ready
//   { mode: "misconfigured", error }      present but unusable; refuse to serve
export function resolveAuthConfig(env = process.env) {
  const { configured, users, error } = parseUsers(env.AURIX_USERS);
  if (!configured) return { mode: "demo" };
  if (error) return { mode: "misconfigured", error };

  const secret = env.AURIX_SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    return {
      mode: "misconfigured",
      error:
        "AURIX_SESSION_SECRET must be set to at least 32 characters when AURIX_USERS is configured. Generate one with: openssl rand -base64 48",
    };
  }
  return { mode: "configured", users, secret };
}
