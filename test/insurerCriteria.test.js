// Stage 1, the deterministic criteria engine. These tests pin the published
// contract: five natively modeled payers, eleven therapeutic drug classes, an
// identical class set across every payer, and a documented fallback for payers
// that are not modeled individually.

import { describe, it, expect } from "vitest";
import {
  DRUG_CLASS_MAP,
  INSURER_CRITERIA,
  BASELINE_SOURCE,
  identifyDrugClass,
  getInsurerCriteria,
  hasNativeCriteria,
  performGapAnalysis,
} from "../lib/insurerCriteria.js";

const NATIVE_PAYERS = Object.keys(INSURER_CRITERIA).filter(
  (p) => INSURER_CRITERIA[p] && typeof INSURER_CRITERIA[p] === "object"
);
const FALLBACK_PAYERS = Object.keys(INSURER_CRITERIA).filter(
  (p) => !INSURER_CRITERIA[p]
);
const BASELINE_CLASSES = Object.keys(INSURER_CRITERIA[BASELINE_SOURCE]);

describe("published coverage contract", () => {
  it("models exactly five payers natively", () => {
    expect(NATIVE_PAYERS).toEqual([
      "UnitedHealthcare",
      "Aetna",
      "BlueCross BlueShield",
      "Cigna",
      "Medicare Advantage",
    ]);
  });

  it("carries eleven therapeutic drug classes", () => {
    expect(BASELINE_CLASSES).toHaveLength(11);
  });

  it("covers the identical class set for every native payer", () => {
    // A payer missing a class would silently return null from
    // getInsurerCriteria and degrade that request to the no-criteria path.
    for (const payer of NATIVE_PAYERS) {
      expect(Object.keys(INSURER_CRITERIA[payer]).sort()).toEqual(
        [...BASELINE_CLASSES].sort()
      );
    }
  });

  it("names UnitedHealthcare as the documented fallback baseline", () => {
    expect(BASELINE_SOURCE).toBe("UnitedHealthcare");
    expect(NATIVE_PAYERS).toContain(BASELINE_SOURCE);
  });

  it("leaves unmodeled payers null rather than part-populated", () => {
    expect(FALLBACK_PAYERS).toEqual(["Humana", "Medicaid"]);
  });
});

describe("criteria entry shape", () => {
  // performGapAnalysis reads criteria.stepTherapy.required without guarding the
  // intermediate, so a class entry lacking stepTherapy would throw at runtime.
  it("gives every payer and class a stepTherapy block", () => {
    for (const payer of NATIVE_PAYERS) {
      for (const [cls, entry] of Object.entries(INSURER_CRITERIA[payer])) {
        expect(entry, `${payer} / ${cls}`).toBeTruthy();
        expect(entry.stepTherapy, `${payer} / ${cls}`).toBeDefined();
      }
    }
  });

  it("gives every stepTherapy that requires trials a drug list and a minimum", () => {
    for (const payer of NATIVE_PAYERS) {
      for (const [cls, entry] of Object.entries(INSURER_CRITERIA[payer])) {
        if (!entry.stepTherapy.required) continue;
        const where = `${payer} / ${cls}`;
        expect(Array.isArray(entry.stepTherapy.drugs), where).toBe(true);
        expect(entry.stepTherapy.drugs.length, where).toBeGreaterThan(0);
        expect(typeof entry.stepTherapy.minTrials, where).toBe("number");
        expect(entry.stepTherapy.minTrials, where).toBeGreaterThan(0);
        // A minimum higher than the list length can never be satisfied.
        expect(entry.stepTherapy.minTrials, where).toBeLessThanOrEqual(
          entry.stepTherapy.drugs.length
        );
      }
    }
  });

  it("keeps every list-valued field an array when present", () => {
    const listFields = [
      "requiredLabs",
      "requiredImaging",
      "cptCodes",
      "commonDenialReasons",
    ];
    for (const payer of NATIVE_PAYERS) {
      for (const [cls, entry] of Object.entries(INSURER_CRITERIA[payer])) {
        for (const f of listFields) {
          if (entry[f] === undefined) continue;
          expect(Array.isArray(entry[f]), `${payer} / ${cls} / ${f}`).toBe(true);
        }
      }
    }
  });
});

describe("drug class taxonomy", () => {
  it("maps every drug name to a non-empty class string", () => {
    for (const [drug, cls] of Object.entries(DRUG_CLASS_MAP)) {
      expect(typeof cls, drug).toBe("string");
      expect(cls.length, drug).toBeGreaterThan(0);
    }
  });

  it("uses lowercase keys, which identifyDrugClass depends on", () => {
    // identifyDrugClass lowercases its input and substring-matches the raw key,
    // so an uppercase key could never match.
    for (const drug of Object.keys(DRUG_CLASS_MAP)) {
      expect(drug, drug).toBe(drug.toLowerCase());
    }
  });

  // KNOWN GAP, documented rather than asserted away. Three classes exist in the
  // taxonomy with no criteria under any payer. Requests for those drugs are
  // recognized and then fall through to the no-criteria path. Closing this is
  // the coverage-extension work; this test records the exact present state so
  // that closing it is a visible, deliberate change.
  it("has three taxonomy classes still awaiting criteria", () => {
    const taxonomy = new Set(Object.values(DRUG_CLASS_MAP));
    const orphans = [...taxonomy].filter((c) => !BASELINE_CLASSES.includes(c));
    expect(orphans.sort()).toEqual([
      "anticoagulants",
      "car_t",
      "sglt2_inhibitors",
    ]);
  });
});

describe("identifyDrugClass", () => {
  it("resolves a brand name", () => {
    expect(identifyDrugClass("Humira 40mg")).toEqual({
      drugName: "humira",
      drugClass: "biologics_rheum",
    });
  });

  it("resolves a generic name", () => {
    expect(identifyDrugClass("adalimumab")).toEqual({
      drugName: "adalimumab",
      drugClass: "biologics_rheum",
    });
  });

  it("is case insensitive and tolerates punctuation", () => {
    expect(identifyDrugClass("DUPIXENT (dupilumab), 300 mg/2mL").drugClass).toBe(
      "biologics_derm"
    );
  });

  it("returns null for an unrecognized therapy", () => {
    expect(identifyDrugClass("amoxicillin 500mg")).toBeNull();
  });

  // Matching walks DRUG_CLASS_MAP in insertion order and returns on the first
  // hit, so with two recognized drugs present the winner is decided by map
  // order, not by position in the text. Pinned so a map reordering is caught.
  it("returns the first taxonomy match, not the first textual match", () => {
    const result = identifyDrugClass("patient is on dupixent, previously humira");
    expect(result.drugName).toBe("humira");
  });

  // KNOWN ROBUSTNESS GAP: no null guard, unlike performGapAnalysis which has
  // one. Recorded so a later guard is a deliberate, reviewed change.
  it("throws on null input rather than returning null", () => {
    expect(() => identifyDrugClass(null)).toThrow();
    expect(() => identifyDrugClass(undefined)).toThrow();
  });
});

describe("getInsurerCriteria and hasNativeCriteria", () => {
  it("returns a payer-specific entry for a modeled payer and class", () => {
    const c = getInsurerCriteria("Aetna", "biologics_rheum");
    expect(c).toBeTruthy();
    expect(c.stepTherapy).toBeDefined();
  });

  it("falls back to the baseline for an unmodeled payer", () => {
    expect(getInsurerCriteria("Humana", "biologics_rheum")).toEqual(
      INSURER_CRITERIA[BASELINE_SOURCE].biologics_rheum
    );
  });

  it("falls back to the baseline for a payer it has never heard of", () => {
    expect(getInsurerCriteria("Some Regional Plan", "biologics_rheum")).toEqual(
      INSURER_CRITERIA[BASELINE_SOURCE].biologics_rheum
    );
  });

  it("returns null for a class with no criteria", () => {
    expect(getInsurerCriteria("Aetna", "car_t")).toBeNull();
    expect(getInsurerCriteria("Aetna", "not_a_real_class")).toBeNull();
  });

  it("reports native coverage truthfully, which is what labels the fallback", () => {
    expect(hasNativeCriteria("Cigna")).toBe(true);
    expect(hasNativeCriteria("Humana")).toBe(false);
    expect(hasNativeCriteria("Medicaid")).toBe(false);
    expect(hasNativeCriteria("Some Regional Plan")).toBe(false);
  });
});

describe("performGapAnalysis", () => {
  const criteria = getInsurerCriteria("UnitedHealthcare", "biologics_rheum");

  it("degrades gracefully when there are no criteria", () => {
    const r = performGapAnalysis({}, null);
    expect(r.score).toBe(0);
    expect(r.gaps).toEqual([
      "No insurer-specific criteria found for this drug class",
    ]);
    expect(r.met).toEqual([]);
  });

  it("flags step therapy as HIGH severity when nothing is documented", () => {
    const r = performGapAnalysis({ currentMedications: "", stepTherapy: "" }, criteria);
    const step = r.gaps.find((g) => g.type === "step_therapy");
    expect(step).toBeTruthy();
    expect(step.severity).toBe("HIGH");
    expect(step.message).toContain("none documented");
  });

  it("credits step therapy when enough prior trials appear in the record", () => {
    const needed = criteria.stepTherapy.drugs.slice(
      0,
      criteria.stepTherapy.minTrials
    );
    const r = performGapAnalysis(
      { currentMedications: needed.join(", "), stepTherapy: "" },
      criteria
    );
    expect(r.gaps.find((g) => g.type === "step_therapy")).toBeUndefined();
    expect(r.met.join(" ")).toContain("Step therapy requirement met");
  });

  it("reads prior trials from either medications or step therapy field", () => {
    const needed = criteria.stepTherapy.drugs.slice(
      0,
      criteria.stepTherapy.minTrials
    );
    const r = performGapAnalysis({ stepTherapy: needed.join(", ") }, criteria);
    expect(r.gaps.find((g) => g.type === "step_therapy")).toBeUndefined();
  });

  it("always injects the administrative enrichment block", () => {
    const r = performGapAnalysis({}, criteria);
    expect(r.enrichments.cptCodes).toBeDefined();
    expect(r.enrichments.authDuration).toBeTruthy();
    expect(r.enrichments.placeOfService).toBeTruthy();
    expect(Array.isArray(r.enrichments.commonDenialReasons)).toBe(true);
  });

  it("scores 100 minus 30 per HIGH gap and 10 per MEDIUM, floored at zero", () => {
    const r = performGapAnalysis({}, criteria);
    const high = r.gaps.filter((g) => g.severity === "HIGH").length;
    const med = r.gaps.filter((g) => g.severity === "MEDIUM").length;
    expect(r.score).toBe(Math.max(0, 100 - high * 30 - med * 10));
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("tolerates a patient record with no fields at all", () => {
    for (const payer of NATIVE_PAYERS) {
      for (const cls of BASELINE_CLASSES) {
        const c = getInsurerCriteria(payer, cls);
        expect(() => performGapAnalysis({}, c), `${payer} / ${cls}`).not.toThrow();
      }
    }
  });

  // Required labs push a MEDIUM gap whenever the class defines them, regardless
  // of what the record contains, so those classes cannot reach 100. This is a
  // reminder-style gap rather than a record check. Pinned deliberately.
  it("never reaches a perfect score for a class that requires labs", () => {
    const withLabs = BASELINE_CLASSES.filter((cls) => {
      const c = getInsurerCriteria(BASELINE_SOURCE, cls);
      return c && c.requiredLabs && c.requiredLabs.length > 0;
    });
    expect(withLabs.length).toBeGreaterThan(0);
    for (const cls of withLabs) {
      const c = getInsurerCriteria(BASELINE_SOURCE, cls);
      const needed = c.stepTherapy.required
        ? c.stepTherapy.drugs.slice(0, c.stepTherapy.minTrials).join(", ")
        : "";
      const r = performGapAnalysis({ currentMedications: needed }, c);
      expect(r.score, cls).toBeLessThan(100);
    }
  });
});
