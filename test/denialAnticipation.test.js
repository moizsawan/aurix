// The pre-submission denial screen. Its contract is three-valued: addressed,
// not addressed, or could not tell. The third value matters most clinically,
// because conflating "cannot tell" with "fine" is what would let a request go
// out with a known denial reason unanswered.

import { describe, it, expect } from "vitest";
import { anticipateDenials } from "../lib/denialAnticipation.js";
import {
  getInsurerCriteria,
  INSURER_CRITERIA,
  BASELINE_SOURCE,
} from "../lib/insurerCriteria.js";

describe("anticipateDenials", () => {
  it("returns nothing when the criteria carry no denial reasons", () => {
    expect(anticipateDenials({}, null)).toEqual([]);
    expect(anticipateDenials({}, {})).toEqual([]);
    expect(anticipateDenials({}, { commonDenialReasons: null })).toEqual([]);
  });

  it("returns one result per known denial reason, in order", () => {
    const criteria = {
      commonDenialReasons: ["Step therapy not documented", "TB screening missing"],
    };
    const out = anticipateDenials({}, criteria);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.reason)).toEqual(criteria.commonDenialReasons);
  });

  it("marks a reason addressed when matching evidence is in the record", () => {
    const out = anticipateDenials(
      { stepTherapy: "Failed methotrexate after a 3 month trial" },
      { commonDenialReasons: ["Step therapy not documented"] }
    );
    expect(out[0].addressed).toBe(true);
    expect(out[0].note).toBe("Appears addressed in the record");
  });

  it("marks a reason unaddressed when the record is silent on it", () => {
    const out = anticipateDenials(
      { medicalHistory: "Seen in clinic, stable" },
      { commonDenialReasons: ["Step therapy not documented"] }
    );
    expect(out[0].addressed).toBe(false);
    expect(out[0].note).toBe("No supporting evidence found in the record");
  });

  it("returns null, not false, when no signal matches the reason", () => {
    // The important distinction: the screen does not know, so it must ask for
    // review rather than imply the reason is unanswered.
    const out = anticipateDenials(
      { medicalHistory: "anything" },
      { commonDenialReasons: ["Plan excludes this benefit category entirely"] }
    );
    expect(out[0].addressed).toBeNull();
    expect(out[0].note).toBe("Manual review recommended");
  });

  it("searches every clinical field of the record", () => {
    const fields = [
      "currentMedications",
      "stepTherapy",
      "medicalHistory",
      "clinicalJustification",
      "currentTreatmentInadequacy",
    ];
    for (const f of fields) {
      const out = anticipateDenials(
        { [f]: "quantiferon negative" },
        { commonDenialReasons: ["TB screening missing"] }
      );
      expect(out[0].addressed, f).toBe(true);
    }
  });

  it("matches evidence case insensitively", () => {
    const out = anticipateDenials(
      { medicalHistory: "QuantiFERON Negative, HEPATITIS panel clear" },
      { commonDenialReasons: ["TB screening missing", "Hepatitis screening missing"] }
    );
    expect(out[0].addressed).toBe(true);
    expect(out[1].addressed).toBe(true);
  });

  it("recognizes disease-activity score evidence", () => {
    const out = anticipateDenials(
      { clinicalJustification: "DAS28 of 5.4 documented at last visit" },
      { commonDenialReasons: ["No disease activity score recorded"] }
    );
    expect(out[0].addressed).toBe(true);
  });

  it("recognizes a migraine diary for a headache-day requirement", () => {
    const out = anticipateDenials(
      { medicalHistory: "Headache diary shows 9 migraine days per month" },
      { commonDenialReasons: ["Insufficient monthly migraine days documented"] }
    );
    expect(out[0].addressed).toBe(true);
  });

  it("tolerates an empty or missing patient record", () => {
    const criteria = { commonDenialReasons: ["Step therapy not documented"] };
    expect(() => anticipateDenials(null, criteria)).not.toThrow();
    expect(() => anticipateDenials(undefined, criteria)).not.toThrow();
    expect(anticipateDenials(null, criteria)[0].addressed).toBe(false);
  });

  it("runs clean against every real payer and class in the library", () => {
    const payers = Object.keys(INSURER_CRITERIA);
    const classes = Object.keys(INSURER_CRITERIA[BASELINE_SOURCE]);
    for (const payer of payers) {
      for (const cls of classes) {
        const criteria = getInsurerCriteria(payer, cls);
        if (!criteria) continue;
        const out = anticipateDenials(
          { stepTherapy: "failed methotrexate", medicalHistory: "quantiferon negative" },
          criteria
        );
        expect(Array.isArray(out), `${payer} / ${cls}`).toBe(true);
        for (const row of out) {
          expect(typeof row.reason, `${payer} / ${cls}`).toBe("string");
          expect([true, false, null], `${payer} / ${cls}`).toContain(row.addressed);
          expect(row.note, `${payer} / ${cls}`).toBeTruthy();
        }
      }
    }
  });
});
