// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Deterministic Billing-Code Assembly
// ═══════════════════════════════════════════════════════════════════════════════
// Guarantees a validated, structured billing block on every submission,
// independent of the language model: the procedure / HCPCS codes come from the
// deterministic criteria engine, and the ICD-10 diagnosis code comes from the
// patient record and is format-checked. This is the "automated insertion of
// HCPCS and ICD-10 codes" step of the roadmap, implemented so the codes
// are present and validated even when the LLM output varies.
// ═══════════════════════════════════════════════════════════════════════════════

// ICD-10-CM shape: a letter, two characters (digit, then digit / A / B), and an
// optional dot with up to four alphanumerics. This is a format check, not a
// coverage check against the code set.
const ICD10_RE = /^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$/;

export function validateIcd10(raw) {
  const code = (raw || "").trim().toUpperCase();
  return { raw: code, valid: code.length > 0 && ICD10_RE.test(code) };
}

export function assembleBillingBlock(patientData, enrichments) {
  const p = patientData || {};
  const e = enrichments || {};

  const icd10 = validateIcd10(p.icd10);
  const procedureCodes = (e.cptCodes || []).slice();

  const lines = ["BILLING & CODING"];
  if (icd10.raw) {
    lines.push(
      `ICD-10 diagnosis code: ${icd10.raw}` +
        (icd10.valid ? "" : " (format not recognized — verify before submission)")
    );
  } else {
    lines.push("ICD-10 diagnosis code: not provided — required before submission");
  }
  if (procedureCodes.length > 0) {
    lines.push(`Procedure / HCPCS codes: ${procedureCodes.join(", ")}`);
  } else {
    lines.push("Procedure / HCPCS codes: none mapped for this therapy");
  }
  if (e.authDuration) lines.push(`Requested authorization duration: ${e.authDuration}`);
  if (e.placeOfService) lines.push(`Place of service: ${e.placeOfService}`);

  return {
    icd10,
    procedureCodes,
    authDuration: e.authDuration || null,
    placeOfService: e.placeOfService || null,
    text: lines.join("\n"),
  };
}
