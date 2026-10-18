# Deploying Aurix in a physician practice

This document is for a practice considering using Aurix on real cases, and for
whoever sets it up for them. It describes exactly where patient data goes, what
has to be true before protected health information (PHI) touches the software,
and how to run an instance the practice controls.

It is deliberately specific about what Aurix does **not** yet do. A practice
cannot assess the risk of a tool whose documentation only lists its strengths.

---

## Read this first

> **The public demo at `aurix-orcin.vercel.app` must never receive real patient
> information.** It exists so that reviewers can exercise the full pipeline
> against synthetic records. Its sign-in credentials are published in this
> repository and compiled into the browser bundle, so anyone can sign in. Treat
> it as a public sandbox, because that is what it is.

Any clinical use requires an instance the practice runs itself, on
infrastructure the practice controls, after the gate below is satisfied.

---

## Where data actually goes

Verified against the source rather than described from intent.

### In the browser

Patient records and prior authorization requests are held in the browser's
`localStorage` under the keys `ax_patients`, `ax_requests` and `ax_user`
(`pages/index.jsx`). This means:

- The data is stored **unencrypted on that device**, under the origin serving
  the app.
- It persists until the browser's site data is cleared. Signing out clears
  `ax_user` only; the patient and request records remain.
- It is **not** synchronised anywhere, so it is readable by anyone with access
  to that browser profile. On a shared clinic workstation, that is every person
  who uses that profile.

### On the server

The three API routes (`pages/api/generate.js`, `readiness.js`, `appeal.js`) are
stateless. They build a response in memory and return it. **Aurix has no
database and writes no patient data to disk.** There is nothing to purge
server-side because nothing is kept there.

### To the model provider

When a letter or appeal is generated, the case data in the request body is sent
to the Anthropic Messages API (`https://api.anthropic.com/v1/messages`) using the
`ANTHROPIC_API_KEY` configured on the deployment. Everything in the case
narrative that the pipeline needs for drafting leaves your infrastructure at
this point and is processed by a third party under that provider's terms.

Stage 1, the deterministic criteria engine, runs entirely locally and makes no
network call. With no API key configured, Aurix degrades to demo mode and
assembles the letter deterministically, so **no data leaves the deployment at
all in that mode**.

---

## The gate: what must be true before any PHI is entered

These are prerequisites, not recommendations. Aurix does not currently meet
them out of the box, and the project says so plainly.

| # | Requirement | Current state |
|---|---|---|
| 1 | **Real authentication.** Per-user accounts with individually issued credentials. | **Not met.** Sign-in matches against a credential map hardcoded in `pages/index.jsx` and shipped in the client bundle. Passwords are in plaintext in the source. This is demo scaffolding, not an access control. |
| 2 | **A Business Associate Agreement with the model provider**, covering PHI processed through the Messages API. | **Your responsibility.** Aurix cannot establish this for you. Arrange it directly with the provider before enabling live generation on real cases, or run in demo mode, where no data leaves the deployment. |
| 3 | **An instance the practice controls**, on its own hosting and its own domain, with its own API key. | Supported. See below. |
| 4 | **A decision about browser storage.** `localStorage` on a shared workstation is not an appropriate resting place for PHI. | **Not met.** Aurix has no alternative storage backend today. Mitigate with per-clinician OS accounts and browser profiles, or treat the browser as ephemeral and clear site data between sessions. |
| 5 | **Clinician review of every generated letter** before submission. | Supported by design. Nothing is auto-submitted; Aurix produces drafts. |

If items 1, 2 and 4 cannot be satisfied, the honest answer is that the practice
should run Aurix in demo mode against synthetic or de-identified cases to
evaluate it, and wait for real authentication before putting PHI through it.

---

## Running an instance you control

### Option A: your own Vercel project

1. Fork this repository to the practice's own GitHub account or organisation.
2. Create a new Vercel project pointed at that fork.
3. Set `ANTHROPIC_API_KEY` in the project's environment variables. Leave it
   unset to run in demo mode with no external calls.
4. Deploy. Put the result behind the practice's own domain and access controls.

### Option B: on the practice's own machine or server

```bash
git clone https://github.com/<your-org>/aurix.git
cd aurix
npm install
cp .env.example .env.local        # then set ANTHROPIC_API_KEY, or leave unset
npm run build
npm start                         # serves on port 3000
```

Run it behind a reverse proxy that terminates TLS and enforces the practice's
own authentication until item 1 above is resolved. An HTTP basic auth layer at
the proxy is a crude but genuine improvement over the built-in demo sign-in.

### Verifying a deployment before you trust it

```bash
npm test          # the deterministic engine's test suite
npm run build     # must complete without error
```

Then, in the running instance, confirm with a synthetic case that the payer
shown in the output matches the payer you selected, and that when you choose a
payer without a native ruleset, the output says the baseline was applied rather
than presenting it as payer-specific.

---

## What Aurix produces, and what it does not decide

Aurix drafts. A clinician decides.

- Stage 1 cross-references the case against the payer's published criteria and
  reports documentation gaps. It does not judge medical necessity.
- The billing block carries procedure and HCPCS codes from the criteria engine
  and a **format-checked** ICD-10 code. Format checking is not coverage
  checking: a well-formed code can still be the wrong code, and the output says
  so when the format is unrecognised rather than silently dropping it.
- The denial-anticipation screen is three-valued. "Manual review recommended"
  means the screen could not infer an answer, not that the item is satisfied.
  Treat it as an open question.
- The readiness and denial-risk scores are heuristics for prioritising review
  effort. They are not predictions of the payer's decision, and the denial-risk
  reference data is synthetic.

Eleven drug classes have payer-specific criteria. Three classes in the drug
taxonomy (`anticoagulants`, `car_t`, `sglt2_inhibitors`) are recognised but have
no criteria under any payer yet, so cases involving those drugs fall through to
a no-criteria path and score zero. Extending that coverage is active work.

---

## Reporting a problem

Clinical or safety concerns, and anything that looks like a security issue,
should go through the process in [SECURITY.md](../SECURITY.md). Please do not
include patient information in a report.
