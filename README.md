# Aurix

Aurix is a provider-side prior authorization (PA) tool for independent physician
practices. It helps a clinician turn a patient case into a payer-ready prior
authorization letter, and an appeal letter when a request is denied, by running
the case through a deterministic insurer-criteria engine and a language model in
a multi-stage pipeline.

Aurix is **provider-side**: it helps physicians obtain approvals for their
patients. It is distinct from payer-side automation that denies claims.

**Live demo:** https://aurix-orcin.vercel.app/

> Aurix is a working prototype. The patient records in the demo are synthetic.
> It is not a medical device and is not intended for clinical use.

## The 7-stage pipeline

1. **Insurer Criteria Matching** — deterministic. Identifies the drug class and
   cross-references the patient data against payer-specific criteria before any
   model call, producing a documentation gap analysis.
2. **LLM Letter Generation** — generates the PA letter with the Stage 1 criteria
   (required codes, step therapy, labs, denial patterns) injected as context.
3. **Rubric Scoring** — a programmatic 12-point quality gate.
4. **Iterative Self-Correction** — regenerates with targeted feedback when the
   letter falls below the quality threshold.
5. **Denial Probability Scoring** — a statistical estimate of denial risk with
   contributing factors.
6. **Pre-Submission Readiness Scoring** — a 100-point readiness grade with
   specific action items.
7. **Appeal Letter Generation** — generates a targeted appeal that addresses
   each denial reason.

Alongside the pipeline, two deterministic pre-submission features run on every
case: **billing-code assembly** (validated procedure/HCPCS codes plus a
format-checked ICD-10 diagnosis) and a **denial-anticipation check** that maps
each known denial reason for the payer and therapy to evidence in the record and
flags what is missing.

## Supported payers

Payer-specific criteria are implemented for **UnitedHealthcare, Aetna,
BlueCross BlueShield, Cigna, and Medicare Advantage**, across eleven drug
classes each (rheumatology, GI, dermatology, and pulmonology biologics; GLP-1
agonists; oncology immunotherapy; CGRP inhibitors; MS therapies; psychiatry;
cardiology; viscosupplementation).

Payers without a native ruleset fall back to a documented UnitedHealthcare
baseline, and the output states plainly when that baseline was applied rather
than presenting it as payer-specific.

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Demo mode vs. live AI

Aurix runs **with no configuration**. If no `ANTHROPIC_API_KEY` is set (or the
key is out of credit, rate limited, or the API errors), the pipeline degrades to
**demo mode**: Stage 1 still runs and the letter is assembled deterministically
from the criteria engine, clearly labeled as a sample. This keeps the public
demo working end to end and means a visitor never hits a broken screen.

To enable full AI generation and iterative self-correction, copy
`.env.example` to `.env.local` and set your key:

```bash
cp .env.example .env.local
# then edit .env.local and set ANTHROPIC_API_KEY=...
```

Real LLM usage is rate limited per IP and globally to protect the key on the
public deployment; a throttled request degrades to the deterministic draft.

## How to try it (reviewers)

1. Open the app and sign in with the demo clinician account shown on the login
   screen: `dr.smith@clinic.com` / `doctor123`.
2. Pick one of the seeded sample patients (for example a rheumatoid arthritis
   case on Aetna) or enter your own case, then run the pipeline.
3. Review the generated letter, the stage-by-stage output, the billing block,
   the denial-anticipation checklist, the denial-risk score, and the appeal
   generator.

No API key is required to try the full flow in demo mode.

## Tech stack

Next.js (pages router) with API routes for the pipeline stages
(`pages/api/generate.js`, `pages/api/readiness.js`, `pages/api/appeal.js`) and a
deterministic criteria/rules engine in `lib/`.
