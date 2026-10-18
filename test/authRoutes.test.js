// Exercises the real route handlers against mock req/res objects. The unit
// tests cover the crypto; these cover the decisions the endpoints make, which is
// where a mistake would actually let someone in.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import loginHandler from "../pages/api/auth/login.js";
import sessionHandler from "../pages/api/auth/session.js";
import logoutHandler from "../pages/api/auth/logout.js";
import { hashPassword, SESSION_COOKIE, verifySession } from "../lib/auth.js";

const PASSWORD = "a sufficiently long password";
const SECRET = "s".repeat(48);
const HASH = hashPassword(PASSWORD);
const DIRECTORY = JSON.stringify([
  { email: "dr.patel@practice.com", name: "Dr A Patel", role: "clinician", title: "Rheumatology", hash: HASH },
  { email: "pat@practice.com", name: "Pat Jones", role: "patient", patientId: "p1", hash: HASH },
]);

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
  };
}
const post = (body, cookie) => ({ method: "POST", body, headers: cookie ? { cookie } : {} });
const get = (cookie) => ({ method: "GET", headers: cookie ? { cookie } : {} });

let saved;
beforeEach(() => { saved = { ...process.env }; });
afterEach(() => {
  for (const k of ["AURIX_USERS", "AURIX_SESSION_SECRET", "NODE_ENV"]) delete process.env[k];
  Object.assign(process.env, saved);
});

function configure() {
  process.env.AURIX_USERS = DIRECTORY;
  process.env.AURIX_SESSION_SECRET = SECRET;
}

describe("POST /api/auth/login — demo deployment", () => {
  it("reports demo mode without verifying anything server-side", () => {
    delete process.env.AURIX_USERS;
    const res = mockRes();
    loginHandler(post({ email: "dr.smith@clinic.com", password: "doctor123" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ mode: "demo" });
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });
});

describe("POST /api/auth/login — configured deployment", () => {
  beforeEach(configure);

  it("accepts correct credentials and sets a signed httpOnly cookie", () => {
    const res = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: PASSWORD }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.mode).toBe("configured");
    expect(res.body.user).toEqual({
      email: "dr.patel@practice.com",
      name: "Dr A Patel",
      role: "clinician",
      title: "Rheumatology",
    });

    const cookie = res.headers["Set-Cookie"];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const token = cookie.split(";")[0].slice(SESSION_COOKIE.length + 1);
    expect(verifySession(token, SECRET).email).toBe("dr.patel@practice.com");
  });

  it("never returns the password hash to the client", () => {
    const res = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: PASSWORD }), res);
    expect(JSON.stringify(res.body)).not.toContain("scrypt$");
    expect(res.body.user.hash).toBeUndefined();
  });

  it("rejects a wrong password with no cookie", () => {
    const res = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: "wrong" }), res);
    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("rejects the published demo credentials outright", () => {
    // The whole point of configured mode. dr.smith must not get in.
    const res = mockRes();
    loginHandler(post({ email: "dr.smith@clinic.com", password: "doctor123" }), res);
    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("gives the same message for unknown user and wrong password", () => {
    const unknown = mockRes();
    loginHandler(post({ email: "nobody@practice.com", password: PASSWORD }), unknown);
    const wrong = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: "wrong" }), wrong);
    expect(unknown.statusCode).toBe(wrong.statusCode);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it("rejects non-string credentials without throwing", () => {
    for (const body of [{}, null, { email: 1, password: 2 }, { email: "a@b.com" }, { password: "x" }]) {
      const res = mockRes();
      expect(() => loginHandler(post(body), res)).not.toThrow();
      expect([400, 401]).toContain(res.statusCode);
      expect(res.headers["Set-Cookie"]).toBeUndefined();
    }
  });

  it("carries patientId through for a patient account", () => {
    const res = mockRes();
    loginHandler(post({ email: "pat@practice.com", password: PASSWORD }), res);
    expect(res.body.user.role).toBe("patient");
    expect(res.body.user.patientId).toBe("p1");
  });

  it("only accepts POST", () => {
    const res = mockRes();
    loginHandler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("POST /api/auth/login — misconfigured deployment fails closed", () => {
  const broken = [
    { label: "directory with no secret", env: { AURIX_USERS: DIRECTORY } },
    { label: "secret too short", env: { AURIX_USERS: DIRECTORY, AURIX_SESSION_SECRET: "short" } },
    { label: "directory not JSON", env: { AURIX_USERS: "{nope", AURIX_SESSION_SECRET: SECRET } },
    {
      label: "plaintext password in directory",
      env: {
        AURIX_USERS: JSON.stringify([{ email: "a@b.com", hash: "doctor123" }]),
        AURIX_SESSION_SECRET: SECRET,
      },
    },
  ];

  for (const { label, env } of broken) {
    it(`refuses rather than falling back to demo: ${label}`, () => {
      delete process.env.AURIX_USERS;
      delete process.env.AURIX_SESSION_SECRET;
      Object.assign(process.env, env);

      const res = mockRes();
      loginHandler(post({ email: "dr.smith@clinic.com", password: "doctor123" }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.mode).toBeUndefined();
      expect(res.headers["Set-Cookie"]).toBeUndefined();

      // And the session route must agree, so the client cannot route around it.
      const sres = mockRes();
      sessionHandler(get(), sres);
      expect(sres.statusCode).toBe(503);
    });
  }
});

describe("GET /api/auth/session", () => {
  it("reports demo mode with no user on a sandbox deployment", () => {
    delete process.env.AURIX_USERS;
    const res = mockRes();
    sessionHandler(get(), res);
    expect(res.body).toEqual({ mode: "demo", user: null });
  });

  it("returns the user for a valid cookie", () => {
    configure();
    const login = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: PASSWORD }), login);
    const cookie = login.headers["Set-Cookie"].split(";")[0];

    const res = mockRes();
    sessionHandler(get(cookie), res);
    expect(res.body.mode).toBe("configured");
    expect(res.body.user.email).toBe("dr.patel@practice.com");
  });

  it("returns no user for a missing, forged or truncated cookie", () => {
    configure();
    for (const cookie of [
      undefined,
      `${SESSION_COOKIE}=garbage`,
      `${SESSION_COOKIE}=a.b`,
      "other=1",
    ]) {
      const res = mockRes();
      sessionHandler(get(cookie), res);
      expect(res.body.user, String(cookie)).toBeNull();
    }
  });

  it("returns no user when the cookie is signed with another secret", () => {
    configure();
    const login = mockRes();
    loginHandler(post({ email: "dr.patel@practice.com", password: PASSWORD }), login);
    const cookie = login.headers["Set-Cookie"].split(";")[0];

    process.env.AURIX_SESSION_SECRET = "d".repeat(48); // key rotated
    const res = mockRes();
    sessionHandler(get(cookie), res);
    expect(res.body.user).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("expires the cookie immediately", () => {
    const res = mockRes();
    logoutHandler(post({}), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Set-Cookie"]).toContain("Max-Age=0");
  });

  it("is harmless in demo mode", () => {
    delete process.env.AURIX_USERS;
    const res = mockRes();
    expect(() => logoutHandler(post({}), res)).not.toThrow();
    expect(res.statusCode).toBe(200);
  });

  it("only accepts POST", () => {
    const res = mockRes();
    logoutHandler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
