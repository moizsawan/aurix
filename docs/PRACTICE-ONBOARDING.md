# Practice onboarding

A sequence for a practice evaluating Aurix, from first look to a structured
pilot. It is written to be worked through in order. Steps 1 and 2 need nothing
but a browser. Step 3 is where real patient information becomes a question, and
it has a gate in front of it.

Allow about forty minutes for steps 1 and 2.

---

## Step 1 — Try the pipeline on a synthetic case

Nothing to install. Nothing to configure.

1. Open <https://aurix-orcin.vercel.app/>
2. Sign in as the demo clinician: `dr.smith@clinic.com` / `doctor123`
3. Open one of the seeded patients, for example the rheumatoid arthritis case
   on Aetna
4. Run the pipeline and read the output in this order:
   - **The gap analysis** first. This is the deterministic part, and it is the
     part that runs before any model is involved.
   - **The billing block.** Check the ICD-10 code and the procedure codes.
   - **The denial-anticipation checklist.** Note which rows say *manual review
     recommended*. That means the screen could not tell, not that the item is
     satisfied.
   - **The letter** last, so you judge the reasoning before the prose.
5. Then generate an appeal against a denial reason and read that too.

> Every record in the demo is synthetic. Do not type a real patient into it.
> The sign-in credentials above are published, so anyone can read what is
> entered there.

**What to ask yourself at the end of step 1:** would this draft have saved time
against how your staff writes this letter today, and did it get the payer's
requirements right for a case you know well?

---

## Step 2 — Check it against a case you already know the answer to

The most informative test is a request your practice has already submitted and
had decided, re-entered from memory or from your own notes **with identifiers
removed**.

Use initials or nothing at all, approximate the dates, and keep the clinical
substance: the drug, the payer, the prior therapies and their outcomes, the
relevant scores, the comorbidities.

Then compare:

- Did the gap analysis flag the same things the payer actually questioned?
- If the real request was denied, does the denial-anticipation screen catch the
  reason it was denied for?
- Where the payer has no native ruleset in Aurix, does the output say so rather
  than presenting a baseline as payer-specific?

A tool that agrees with you on a case you already understand is worth more than
one that produces a confident letter on a case you cannot check.

---

## Step 3 — Before any real patient information

**Stop here and read
[PRACTICE-DEPLOYMENT.md](PRACTICE-DEPLOYMENT.md) in full.**

Aurix does not currently satisfy the prerequisites for handling PHI out of the
box. Specifically, its sign-in is demonstration scaffolding with credentials
compiled into the browser bundle, and patient records sit unencrypted in browser
storage that survives sign-out.

The deployment guide lists all five prerequisites, which of them Aurix meets
today, and what a practice has to arrange itself, including a Business Associate
Agreement with the model provider.

The practical conclusion for most practices evaluating Aurix right now: stay in
demo mode on synthetic and de-identified cases, which makes no external network
call at all, and revisit real-case use when authentication lands.

---

## Step 4 — A structured pilot

For a practice willing to run a measured pilot, these are the figures worth
capturing. They are the metrics the project's own evaluation plan uses, so a
pilot recorded this way feeds directly into the published results.

| Measure | How to capture it | Why it matters |
|---|---|---|
| **Time to first draft** | Wall clock, from opening the case to having a letter you would be willing to edit. Compare against your current process for the same request type. | The whole claim rests on this. If it does not save time, nothing else matters. |
| **Physician edit rate** | Of the generated letter, roughly what fraction did you change? Record it per letter, not as an impression. | Distinguishes a usable draft from a starting point that needs rewriting. |
| **Gap analysis accuracy** | Did it flag what the payer actually asked for? Note both misses and false alarms. | A screen that cries wolf gets ignored, which is worse than no screen. |
| **Appeal generator usage** | How often, following a denial, was the automated appeal actually used rather than written from scratch? | Stage 7 is unproven in practice and this is the measure of it. |
| **Outcome** | Approved, denied, or approved on appeal, with the payer and drug class. | The only measure that is not a proxy. |

Record these per request in whatever your practice already uses. A spreadsheet
is fine. Twenty requests is more useful than two hundred impressions.

### Specialties with the strongest coverage today

Prior authorizations driven by **medications and biologics** are where Aurix's
criteria library is deepest: rheumatology, gastroenterology, dermatology and
pulmonology biologics, GLP-1 agonists, oncology immunotherapy, CGRP inhibitors,
MS therapies, psychiatry, cardiology and viscosupplementation.

Requests that turn on **devices, imaging or procedures** are not covered. Nor
are anticoagulants, CAR-T therapies or SGLT2 inhibitors, which the drug
taxonomy recognises but for which no payer criteria exist yet. A pilot will get
cleaner signal if it is scoped to the covered classes.

---

## Getting help

Open an issue at <https://github.com/moizsawan/aurix/issues> for anything
functional. Security and safety concerns go through
[SECURITY.md](../SECURITY.md) instead. In either case, please keep patient
information out of the report, including screenshots.
