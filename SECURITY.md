# Security

## Reporting a vulnerability

Report security issues privately through GitHub's advisory form:
<https://github.com/moizsawan/aurix/security/advisories/new>

Please do not open a public issue for a security problem, and **please do not
include patient information** in any report, including screenshots. A synthetic
case that reproduces the problem is always sufficient.

Expect an acknowledgement within a week. This is a single-maintainer project,
so please allow reasonable time for a fix before any public disclosure.

## The security model, stated plainly

Aurix is a working prototype. Several things that a clinical system would need
are deliberately absent rather than merely untested, and a practice evaluating
it should know which.

**Authentication is demo scaffolding.** `pages/index.jsx` matches sign-ins
against a credential map that is hardcoded in the source and compiled into the
client bundle, with plaintext passwords. It distinguishes the clinician view
from the patient view for demonstration purposes. It is not an access control
and must not be treated as one.

**Patient data in the browser is unencrypted.** Records live in `localStorage`
under `ax_patients`, `ax_requests` and `ax_user`. They persist after sign-out
and are readable by anyone with access to that browser profile.

**The server stores nothing.** The API routes are stateless, hold the case in
memory for the duration of the request, and write nothing to disk. There is no
database.

**Case data reaches a third party when live generation is enabled.** With
`ANTHROPIC_API_KEY` set, case narratives are sent to the Anthropic Messages API.
Without a key, Aurix runs in demo mode and makes no external call, so no data
leaves the deployment.

**The public demo is a public sandbox.** Its credentials are published in this
repository. Anyone can sign in. It must never receive real patient information.

## Before clinical use

[docs/PRACTICE-DEPLOYMENT.md](docs/PRACTICE-DEPLOYMENT.md) sets out the
prerequisites in full, including the ones Aurix does not currently satisfy. The
short version: run your own instance, arrange a Business Associate Agreement
with the model provider or stay in demo mode, and wait for real authentication
before entering PHI.

## Secrets

`ANTHROPIC_API_KEY` is read server-side only and is never exposed to the client.
`.env.local` is gitignored. On the public deployment, live model usage is rate
limited per IP and globally (`lib/rateLimit.js`); a throttled request degrades to
the deterministic draft rather than failing.

If you believe a key has been exposed, rotate it with the provider first, then
report the exposure through the advisory form above.
