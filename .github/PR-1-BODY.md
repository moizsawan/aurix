## What this adds

A Vitest suite (61 tests) over the three modules that run **before** the language model does, plus GitHub Actions CI that runs tests and the production build on every push and PR.

Those three modules are where correctness is independent of model output, so they are the ones worth pinning first:

| Module | Tests | What is covered |
|---|---|---|
| `lib/insurerCriteria.js` | 30 | Coverage contract, entry shape, taxonomy, gap analysis and scoring |
| `lib/codeInsertion.js` | 20 | ICD-10 format validation boundaries, billing-block assembly |
| `lib/denialAnticipation.js` | 11 | The three-valued addressed / not addressed / cannot tell contract |

## The published contract is now asserted

The suite checks the coverage claims directly rather than trusting them:

- Exactly five natively modelled payers: UnitedHealthcare, Aetna, BlueCross BlueShield, Cigna, Medicare Advantage
- Eleven therapeutic drug classes
- An **identical class set across every payer**. A payer silently missing a class would otherwise degrade those requests to the no-criteria path with no warning.
- UnitedHealthcare as the documented fallback, with Humana and Medicaid left `null` rather than part-populated
- Every payer and class entry carries a `stepTherapy` block, which `performGapAnalysis` reads without guarding the intermediate
- No `minTrials` exceeds the length of its own drug list, which would make it unsatisfiable

## Three known gaps recorded rather than asserted away

Each is marked in a comment at the test, so closing any of them is a deliberate, visible change rather than a silent one.

1. **Three taxonomy classes have no criteria under any payer**: `anticoagulants`, `car_t`, `sglt2_inhibitors`. Twelve drug names resolve to them, including Eliquis, Xarelto, Jardiance and Farxiga. Those requests are recognized and then fall through to the no-criteria path, scoring 0. It degrades gracefully rather than crashing, but a clinician entering Eliquis gets nothing useful.
2. **`identifyDrugClass` throws on null input**, where `performGapAnalysis` guards. An inconsistency worth a guard later.
3. **Classes defining `requiredLabs` cannot reach a perfect readiness score**, because the labs gap is pushed whenever the class defines them, regardless of the record. That is reminder behaviour rather than a record check.

## Production impact: none

- `lib/`, `pages/` and `styles/` are **byte-identical to `main`**
- The only tracked change is `package.json`: one script, one devDependency
- Vitest is a devDependency, so it is absent from the deployed bundle
- `npm run build` verified locally and in CI; route table unchanged

## Not for merge yet

Holding this branch unmerged deliberately. `aurix-orcin.vercel.app` is cited in a pending filing, so `main` stays frozen until that resolves. The preview deployment is the place to exercise this.
