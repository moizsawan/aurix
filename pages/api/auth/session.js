// Returns the current session, if the cookie carries a valid signature that has
// not expired. The client calls this on load instead of trusting localStorage.

import {
  resolveAuthConfig,
  readSessionCookie,
  verifySession,
} from "../../../lib/auth";

export default function handler(req, res) {
  const config = resolveAuthConfig();

  if (config.mode === "misconfigured") {
    return res.status(503).json({ error: "Authentication is not correctly configured." });
  }
  if (config.mode === "demo") {
    return res.status(200).json({ mode: "demo", user: null });
  }

  const token = readSessionCookie(req.headers.cookie);
  const body = verifySession(token, config.secret);
  if (!body) return res.status(200).json({ mode: "configured", user: null });

  const { email, name, role, title, patientId } = body;
  return res.status(200).json({
    mode: "configured",
    user: {
      email,
      name,
      role,
      ...(title ? { title } : {}),
      ...(patientId ? { patientId } : {}),
    },
  });
}
