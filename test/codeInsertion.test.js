// Deterministic billing-code assembly. The point of this module is that the
// codes are present and format-checked even when the language model output
// varies, so these tests cover the validator's boundaries and the guarantee
// that a billing block is always produced with a line for every field.

import { describe, it, expect } from "vitest";
import { validateIcd10, assembleBillingBlock } from "../lib/codeInsertion.js";

describe("validateIcd10", () => {
  it("accepts a three-character code", () => {
    expect(validateIcd10("J45")).toEqual({ raw: "J45", valid: true });
  });

  it("accepts a code with a decimal extension", () => {
    expect(validateIcd10("J45.909").valid).toBe(true);
    expect(validateIcd10("M05.79").valid).toBe(true);
    expect(validateIcd10("E11.9").valid).toBe(true);
  });

  it("accepts the four-character extension ceiling", () => {
    expect(validateIcd10("S72.001A").valid).toBe(true);
  });

  it("rejects an extension longer than four characters", () => {
    expect(validateIcd10("S72.001ABC").valid).toBe(false);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(validateIcd10("  j45.909  ")).toEqual({
      raw: "J45.909",
      valid: true,
    });
  });

  it("treats empty and missing input as invalid without throwing", () => {
    expect(validateIcd10("")).toEqual({ raw: "", valid: false });
    expect(validateIcd10(null)).toEqual({ raw: "", valid: false });
    expect(validateIcd10(undefined)).toEqual({ raw: "", valid: false });
    expect(validateIcd10("   ")).toEqual({ raw: "", valid: false });
  });

  it("excludes U, which ICD-10-CM reserves", () => {
    expect(validateIcd10("U07.1").valid).toBe(false);
  });

  it("requires a digit in the second position", () => {
    expect(validateIcd10("JA5").valid).toBe(false);
  });

  it("allows only a digit, A or B in the third position", () => {
    expect(validateIcd10("J4A").valid).toBe(true);
    expect(validateIcd10("J4B").valid).toBe(true);
    expect(validateIcd10("J4C").valid).toBe(false);
  });

  it("rejects a trailing dot with no extension", () => {
    expect(validateIcd10("J45.").valid).toBe(false);
  });

  it("rejects codes carrying separators or spaces", () => {
    expect(validateIcd10("J45 909").valid).toBe(false);
    expect(validateIcd10("J45-909").valid).toBe(false);
  });
});

describe("assembleBillingBlock", () => {
  it("renders a valid code with no warning attached", () => {
    const b = assembleBillingBlock({ icd10: "J45.909" }, { cptCodes: ["J2357"] });
    expect(b.icd10).toEqual({ raw: "J45.909", valid: true });
    expect(b.text).toContain("ICD-10 diagnosis code: J45.909");
    expect(b.text).not.toContain("format not recognized");
  });

  it("surfaces a malformed code rather than dropping it", () => {
    // The code still reaches the letter, flagged, so the clinician can correct
    // it. Silently omitting it would be the dangerous behavior here.
    const b = assembleBillingBlock({ icd10: "ZZZZZ" }, {});
    expect(b.icd10.valid).toBe(false);
    expect(b.text).toContain("ZZZZZ");
    expect(b.text).toContain("format not recognized");
  });

  it("states plainly when no diagnosis code was provided", () => {
    const b = assembleBillingBlock({}, {});
    expect(b.text).toContain("not provided — required before submission");
  });

  it("lists procedure codes when the criteria engine mapped them", () => {
    const b = assembleBillingBlock({ icd10: "J45" }, { cptCodes: ["J2357", "96372"] });
    expect(b.procedureCodes).toEqual(["J2357", "96372"]);
    expect(b.text).toContain("Procedure / HCPCS codes: J2357, 96372");
  });

  it("says so explicitly when no procedure codes are mapped", () => {
    const b = assembleBillingBlock({ icd10: "J45" }, { cptCodes: [] });
    expect(b.text).toContain("none mapped for this therapy");
  });

  it("copies rather than aliases the incoming code array", () => {
    // A caller mutating enrichments afterwards must not change the block.
    const enrichments = { cptCodes: ["J2357"] };
    const b = assembleBillingBlock({ icd10: "J45" }, enrichments);
    enrichments.cptCodes.push("99999");
    expect(b.procedureCodes).toEqual(["J2357"]);
  });

  it("includes duration and place of service only when supplied", () => {
    const withBoth = assembleBillingBlock(
      { icd10: "J45" },
      { authDuration: "12 months", placeOfService: "Outpatient clinic" }
    );
    expect(withBoth.text).toContain("Requested authorization duration: 12 months");
    expect(withBoth.text).toContain("Place of service: Outpatient clinic");

    const withNeither = assembleBillingBlock({ icd10: "J45" }, {});
    expect(withNeither.authDuration).toBeNull();
    expect(withNeither.placeOfService).toBeNull();
    expect(withNeither.text).not.toContain("Requested authorization duration");
    expect(withNeither.text).not.toContain("Place of service");
  });

  it("always produces a block, even with both arguments missing", () => {
    const b = assembleBillingBlock(null, null);
    expect(b.text.startsWith("BILLING & CODING")).toBe(true);
    expect(b.procedureCodes).toEqual([]);
    expect(b.icd10).toEqual({ raw: "", valid: false });
  });

  it("emits the diagnosis and procedure lines on every path", () => {
    const cases = [
      [{ icd10: "J45.909" }, { cptCodes: ["J2357"] }],
      [{ icd10: "bad" }, {}],
      [{}, { cptCodes: [] }],
      [null, null],
    ];
    for (const [p, e] of cases) {
      const text = assembleBillingBlock(p, e).text;
      expect(text).toContain("ICD-10 diagnosis code:");
      expect(text).toContain("Procedure / HCPCS codes:");
    }
  });
});
