// Clears the session cookie. Safe to call in demo mode, where it is a no-op.

import { clearSessionCookie } from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader(
    "Set-Cookie",
    clearSessionCookie({ secure: process.env.NODE_ENV === "production" })
  );
  return res.status(200).json({ ok: true });
}
