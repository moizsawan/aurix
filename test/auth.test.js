// Authentication. The properties worth testing here are the ones whose failure
// is silent: a hash that verifies something it should not, a session signature
// that can be forged, an expiry that is not enforced, and a misconfiguration
// that falls back to the published demo accounts instead of refusing.

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  parseUsers,
  findUser,
  signSession,
  verifySession,
  serializeSessionCookie,
  clearSessionCookie,
  readSessionCookie,
  resolveAuthConfig,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "../lib/auth.js";

const SECRET = "x".repeat(48);

describe("hashPassword", () => {
  it("produces a self-describing scrypt string", () => {
    const h = hashPassword("correct horse battery staple");
    const parts = h.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(32768);
    expect(parts).toHaveLength(6);
  });

  it("salts, so the same password hashes differently every time", () => {
    expect(hashPassword("same password")).not.toBe(hashPassword("same password"));
  });

  it("refuses an empty password", () => {
    expect(() => hashPassword("")).toThrow();
    expect(() => hashPassword(null)).toThrow();
  });
});

describe("verifyPassword", () => {
  const stored = hashPassword("correct horse battery staple");

  it("accepts the right password", () => {
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects the wrong password", () => {
    expect(verifyPassword("Correct horse battery staple", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
    expect(verifyPassword("correct horse battery stapl", stored)).toBe(false);
  });

  it("rejects malformed stored values instead of throwing", () => {
    for (const bad of [
      "",
      "notahash",
      "scrypt$32768$8$1$onlyfivefields",
      "bcrypt$32768$8$1$c2FsdA==$a2V5",
      "scrypt$notanumber$8$1$c2FsdA==$a2V5",
      null,
      undefined,
      12345,
    ]) {
      expect(verifyPassword("anything", bad), String(bad)).toBe(false);
    }
  });

  it("rejects absurd cost parameters rather than computing them", () => {
    // A crafted hash string must not be able to pin the process in a
    // memory-hard computation.
    const parts = hashPassword("pw").split("$");
    parts[1] = "4294967296";
    expect(verifyPassword("pw", parts.join("$"))).toBe(false);
  });

  it("rejects an empty salt or key", () => {
    const parts = hashPassword("pw").split("$");
    expect(verifyPassword("pw", [...parts.slice(0, 4), "", parts[5]].join("$"))).toBe(false);
    expect(verifyPassword("pw", [...parts.slice(0, 5), ""].join("$"))).toBe(false);
  });

  it("round-trips a password containing unicode and whitespace", () => {
    const pw = "  pâssword with spaces and émoji 🔐  ";
    expect(verifyPassword(pw, hashPassword(pw))).toBe(true);
    expect(verifyPassword(pw.trim(), hashPassword(pw))).toBe(false);
  });
});

describe("parseUsers", () => {
  const hash = hashPassword("a password that is long");

  it("reports not configured for empty input", () => {
    for (const v of [undefined, null, "", "   "]) {
      expect(parseUsers(v)).toEqual({ configured: false, users: [], error: null });
    }
  });

  it("parses a valid directory and normalizes the address", () => {
    const { configured, users, error } = parseUsers(
      JSON.stringify([{ email: "Dr.Patel@Practice.COM", name: "Dr A Patel", role: "clinician", hash }])
    );
    expect(configured).toBe(true);
    expect(error).toBeNull();
    expect(users[0].email).toBe("dr.patel@practice.com");
    expect(users[0].role).toBe("clinician");
  });

  it("defaults an unrecognized role to clinician rather than guessing", () => {
    const { users } = parseUsers(JSON.stringify([{ email: "a@b.com", role: "admin", hash }]));
    expect(users[0].role).toBe("clinician");
  });

  it("keeps patientId only for patient accounts", () => {
    const asPatient = parseUsers(JSON.stringify([{ email: "a@b.com", role: "patient", patientId: "p1", hash }]));
    expect(asPatient.users[0].patientId).toBe("p1");
    const asClinician = parseUsers(JSON.stringify([{ email: "a@b.com", role: "clinician", patientId: "p1", hash }]));
    expect(asClinician.users[0].patientId).toBeUndefined();
  });

  it("reports an error and no users for every malformed shape", () => {
    const bad = [
      "{not json",
      JSON.stringify({ email: "a@b.com" }),
      JSON.stringify([]),
      JSON.stringify([null]),
      JSON.stringify([{ name: "no email", hash }]),
      JSON.stringify([{ email: "noatsign", hash }]),
      JSON.stringify([{ email: "a@b.com" }]),
      JSON.stringify([{ email: "a@b.com", hash: "plaintextpassword" }]),
    ];
    for (const raw of bad) {
      const r = parseUsers(raw);
      expect(r.configured, raw.slice(0, 40)).toBe(true);
      expect(r.error, raw.slice(0, 40)).toBeTruthy();
      expect(r.users, raw.slice(0, 40)).toEqual([]);
    }
  });

  it("rejects a directory holding a plaintext password", () => {
    // The most likely operator mistake, and the one that must never load.
    const r = parseUsers(JSON.stringify([{ email: "a@b.com", hash: "doctor123" }]));
    expect(r.users).toEqual([]);
    expect(r.error).toContain("scrypt hash");
  });
});

describe("findUser", () => {
  const users = parseUsers(
    JSON.stringify([{ email: "dr.patel@practice.com", hash: hashPassword("password one") }])
  ).users;

  it("matches regardless of case and surrounding space", () => {
    expect(findUser(users, "  DR.PATEL@practice.com ").email).toBe("dr.patel@practice.com");
  });

  it("returns null for an unknown address or bad input", () => {
    expect(findUser(users, "nobody@practice.com")).toBeNull();
    expect(findUser(users, null)).toBeNull();
    expect(findUser([], "dr.patel@practice.com")).toBeNull();
  });
});

describe("session tokens", () => {
  it("round-trips a payload", () => {
    const t = signSession({ email: "a@b.com", role: "clinician" }, SECRET);
    const body = verifySession(t, SECRET);
    expect(body.email).toBe("a@b.com");
    expect(body.role).toBe("clinician");
  });

  it("sets an expiry one TTL ahead", () => {
    const now = 1_700_000_000;
    const body = verifySession(signSession({ email: "a@b.com" }, SECRET, now), SECRET, now);
    expect(body.exp).toBe(now + SESSION_TTL_SECONDS);
    expect(body.iat).toBe(now);
  });

  it("rejects a token signed with a different secret", () => {
    const t = signSession({ email: "a@b.com" }, SECRET);
    expect(verifySession(t, "y".repeat(48))).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const t = signSession({ email: "a@b.com", role: "patient" }, SECRET);
    const [, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({
      email: "a@b.com", role: "clinician", exp: 9_999_999_999,
    })).toString("base64url");
    expect(verifySession(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = 1_700_000_000;
    const t = signSession({ email: "a@b.com" }, SECRET, now);
    expect(verifySession(t, SECRET, now + SESSION_TTL_SECONDS + 1)).toBeNull();
    expect(verifySession(t, SECRET, now + SESSION_TTL_SECONDS)).toBeNull();
  });

  it("rejects structurally broken tokens without throwing", () => {
    for (const t of ["", ".", "nodot", "a.", ".b", "a.b.c", null, undefined, 42]) {
      expect(verifySession(t, SECRET), String(t)).toBeNull();
    }
  });

  it("refuses to sign or verify without a secret", () => {
    expect(() => signSession({ email: "a@b.com" }, "")).toThrow();
    expect(verifySession("anything.atall", "")).toBeNull();
  });
});

describe("session cookie", () => {
  it("is httpOnly, scoped and SameSite by default", () => {
    const c = serializeSessionCookie("tok");
    expect(c).toContain(`${SESSION_COOKIE}=tok`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toContain("Secure");
  });

  it("omits Secure when asked, for plain-HTTP local development", () => {
    expect(serializeSessionCookie("tok", { secure: false })).not.toContain("Secure");
  });

  it("clears by expiring immediately", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("reads its own cookie out of a crowded header", () => {
    expect(readSessionCookie(`foo=1; ${SESSION_COOKIE}=abc123; bar=2`)).toBe("abc123");
    expect(readSessionCookie(`${SESSION_COOKIE}=abc123`)).toBe("abc123");
  });

  it("returns null when absent, empty or unparseable", () => {
    expect(readSessionCookie("foo=1; bar=2")).toBeNull();
    expect(readSessionCookie(`${SESSION_COOKIE}=`)).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
    expect(readSessionCookie("")).toBeNull();
  });
});

describe("resolveAuthConfig", () => {
  const hash = hashPassword("a password that is long");
  const directory = JSON.stringify([{ email: "a@b.com", hash }]);

  it("is demo mode when no directory is configured", () => {
    expect(resolveAuthConfig({})).toEqual({ mode: "demo" });
    expect(resolveAuthConfig({ AURIX_USERS: "" })).toEqual({ mode: "demo" });
  });

  it("is configured when a directory and a long secret are both present", () => {
    const c = resolveAuthConfig({ AURIX_USERS: directory, AURIX_SESSION_SECRET: SECRET });
    expect(c.mode).toBe("configured");
    expect(c.users).toHaveLength(1);
    expect(c.secret).toBe(SECRET);
  });

  // The important one. A deployment that looks configured must never serve the
  // published demo accounts, so every broken configuration fails closed.
  it("is misconfigured, never demo, when the directory is present but unusable", () => {
    const cases = [
      { AURIX_USERS: directory },
      { AURIX_USERS: directory, AURIX_SESSION_SECRET: "tooshort" },
      { AURIX_USERS: directory, AURIX_SESSION_SECRET: "x".repeat(31) },
      { AURIX_USERS: "{not json", AURIX_SESSION_SECRET: SECRET },
      { AURIX_USERS: "[]", AURIX_SESSION_SECRET: SECRET },
      { AURIX_USERS: JSON.stringify([{ email: "a@b.com", hash: "doctor123" }]), AURIX_SESSION_SECRET: SECRET },
    ];
    for (const env of cases) {
      const c = resolveAuthConfig(env);
      expect(c.mode, JSON.stringify(env).slice(0, 60)).toBe("misconfigured");
      expect(c.error).toBeTruthy();
    }
  });

  it("accepts a secret of exactly the minimum length", () => {
    const c = resolveAuthConfig({ AURIX_USERS: directory, AURIX_SESSION_SECRET: "x".repeat(32) });
    expect(c.mode).toBe("configured");
  });
});

describe("shell-mangled hashes are diagnosed, not merely rejected", () => {
  // The hash format uses $ as a separator, so AURIX_USERS set inside double
  // quotes loses part of every hash to parameter expansion. The operator sees a
  // valid hash rejected, which is baffling without a specific message.
  it("names double quotes as the cause when the separators are gone", () => {
    const r = parseUsers(JSON.stringify([{ email: "a@b.com", hash: "scryptEK+W957S1l48Rkm" }]));
    expect(r.users).toEqual([]);
    expect(r.error).toContain("single quotes");
    expect(r.error).toContain("DOUBLE quotes");
  });

  it("catches a partially eaten hash that still has some separators", () => {
    const r = parseUsers(JSON.stringify([{ email: "a@b.com", hash: "scrypt$8$1$c2FsdA==" }]));
    expect(r.users).toEqual([]);
    expect(r.error).toContain("fields instead of 6");
  });

  it("still gives the plain message for something that is not a hash at all", () => {
    const r = parseUsers(JSON.stringify([{ email: "a@b.com", hash: "doctor123" }]));
    expect(r.error).toContain("scrypt hash");
    expect(r.error).not.toContain("single quotes");
  });
});
