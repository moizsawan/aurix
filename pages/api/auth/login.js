// Credential verification. This is the only place a password is checked, and it
// runs on the server, so no credential material reaches the browser bundle.

import {
  resolveAuthConfig,
  findUser,
  verifyPassword,
  signSession,
  serializeSessionCookie,
} from "../../../lib/auth";

// Deliberately uniform. Distinguishing "no such user" from "wrong password"
// hands an attacker a user-enumeration oracle for free.
const INVALID = "Invalid credentials";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = resolveAuthConfig();

  if (config.mode === "misconfigured") {
    // Fail closed. Falling back to the published demo accounts on a deployment
    // that looks configured is the dangerous outcome.
    console.error("[auth] refusing to authenticate:", config.error);
    return res.status(503).json({
      error: "Authentication is not correctly configured on this deployment.",
      detail: config.error,
    });
  }

  if (config.mode === "demo") {
    // The public sandbox verifies on the client against published accounts, as
    // it always has. Saying so explicitly keeps the client from assuming a
    // server session exists.
    return res.status(200).json({ mode: "demo" });
  }

  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: INVALID });
  }

  const user = findUser(config.users, email);

  // Verify against a decoy hash when the user is unknown so that the response
  // time does not reveal whether the address exists.
  const stored = user
    ? user.hash
    : "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(88);

  const ok = verifyPassword(password, stored);

  if (!user || !ok) {
    return res.status(401).json({ error: INVALID });
  }

  const token = signSession(
    {
      email: user.email,
      name: user.name,
      role: user.role,
      ...(user.title ? { title: user.title } : {}),
      ...(user.patientId ? { patientId: user.patientId } : {}),
    },
    config.secret
  );

  res.setHeader(
    "Set-Cookie",
    serializeSessionCookie(token, { secure: process.env.NODE_ENV === "production" })
  );

  return res.status(200).json({
    mode: "configured",
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
      ...(user.title ? { title: user.title } : {}),
      ...(user.patientId ? { patientId: user.patientId } : {}),
    },
  });
}
