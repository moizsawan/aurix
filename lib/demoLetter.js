// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Deterministic Letter Fallback (demo / offline mode)
// ═══════════════════════════════════════════════════════════════════════════════
// When the LLM is unavailable — no ANTHROPIC_API_KEY, exhausted credit, or an
// upstream API error — the pipeline degrades gracefully instead of surfacing a
// raw error. The Stage 1 criteria engine still runs, and the letter for Stage 2
// is assembled here from the real patient data and payer criteria using fixed
// templates. The output is clearly marked demoMode by the caller so it is never
// mistaken for an LLM-generated draft, but it is still a usable, payer-aware
// first draft that reflects the specific case.
// ═══════════════════════════════════════════════════════════════════════════════

function clean(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  return s.length > 0 ? s : fallback;
}

function joinCodes(codes) {
  if (!codes || codes.length === 0) return "";
  return codes.join(", ");
}

// Build a professional prior authorization letter from deterministic inputs.
// Mirrors the twelve letter requirements used in the LLM prompt so demo output
// is structurally equivalent to a generated draft.
export function buildDemoPaLetter(patientData, enrichments, gapAnalysis) {
  const p = patientData || {};
  const e = enrichments || {};

  const name = clean(p.name, "the patient");
  const dob = clean(p.dob, "[date of birth]");
  const insurance = clean(p.insurance, "the insurer");
  const diagnosis = clean(p.diagnosis, "[diagnosis]");
  const icd10 = clean(p.icd10, "[ICD-10]");
  const treatment = clean(p.requestedTreatment || p.treatment, "[requested treatment]");
  const justification = clean(p.clinicalJustification || p.justification);
  const history = clean(p.medicalHistory);
  const meds = clean(p.currentMedications);
  const priorTx = clean(p.stepTherapy);
  const inadequacy = clean(p.currentTreatmentInadequacy);

  const cpt = joinCodes(e.cptCodes);
  const authDuration = clean(e.authDuration, "per plan policy");
  const placeOfService = clean(e.placeOfService, "per clinical setting");
  const monitoring = clean(e.monitoringSchedule);
  const costAvoidance = clean(e.costAvoidance);
  const denialReasons = e.commonDenialReasons || [];
  const labs = e.requiredLabs || [];
  const imaging = e.requiredImaging || [];

  const lines = [];

  lines.push("[Date]");
  lines.push("");
  lines.push(`Prior Authorization Department`);
  lines.push(insurance);
  lines.push("");
  lines.push(`RE: Prior Authorization Request`);
  lines.push(`Patient: ${name}`);
  lines.push(`Date of Birth: ${dob}`);
  lines.push(`Diagnosis: ${diagnosis} (ICD-10: ${icd10})`);
  lines.push(`Requested Treatment: ${treatment}`);
  lines.push("");
  lines.push("Dear Medical Director,");
  lines.push("");
  lines.push(
    `I am writing to request prior authorization for ${treatment} on behalf of my patient, ${name}, ` +
      `who has been diagnosed with ${diagnosis} (ICD-10: ${icd10}). The clinical information below documents ` +
      `the medical necessity for this therapy.`
  );

  lines.push("");
  lines.push("CLINICAL SUMMARY");
  if (justification) {
    lines.push(justification);
  } else {
    lines.push(
      `The requested treatment is clinically indicated for this patient's condition and consistent with the ` +
        `applicable standard of care.`
    );
  }
  if (history) lines.push(`Relevant medical history: ${history}`);
  if (meds) lines.push(`Current medications: ${meds}`);

  lines.push("");
  lines.push("MEDICAL NECESSITY AND PRIOR THERAPIES");
  if (priorTx) {
    lines.push(`The patient has previously tried and failed the following therapies: ${priorTx}.`);
  } else {
    lines.push(
      `The patient's clinical course supports the requested therapy as the appropriate next step in care.`
    );
  }
  if (inadequacy) {
    lines.push(`Current therapy is insufficient because: ${inadequacy}.`);
  }

  lines.push("");
  lines.push("REQUESTED SERVICE AND BILLING CODES");
  lines.push(`Requested treatment: ${treatment}`);
  if (cpt) lines.push(`Applicable billing codes: ${cpt}`);
  lines.push(`Requested authorization duration: ${authDuration}`);
  lines.push(`Place of service: ${placeOfService}`);

  if (monitoring) {
    lines.push("");
    lines.push("MONITORING AND FOLLOW-UP PLAN");
    lines.push(monitoring);
  }

  if (costAvoidance) {
    lines.push("");
    lines.push("COST-EFFECTIVENESS");
    lines.push(costAvoidance);
  }

  if (denialReasons.length > 0) {
    lines.push("");
    lines.push(`ANTICIPATED REVIEW CRITERIA (${insurance})`);
    lines.push(
      `The following criteria commonly associated with review of this therapy have been addressed in this request:`
    );
    denialReasons.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }

  const enclosed = [];
  if (labs.length > 0) enclosed.push(`laboratory results (${labs.join(", ")})`);
  if (imaging.length > 0) enclosed.push(`imaging (${imaging.join(", ")})`);
  if (enclosed.length > 0) {
    lines.push("");
    lines.push(`Enclosed supporting documentation: ${enclosed.join("; ")}.`);
  }

  lines.push("");
  lines.push(
    `I attest that the requested treatment is medically necessary for this patient. Please contact my office ` +
      `if additional information is required to complete this review. Thank you for your prompt consideration.`
  );
  lines.push("");
  lines.push("Sincerely,");
  lines.push("");
  lines.push("[Physician Name], MD");
  lines.push("NPI: [NPI]");
  lines.push("[Practice name, address, phone]");

  return lines.join("\n");
}

// Build a deterministic appeal letter addressing each denial reason.
export function buildDemoAppealLetter(patientData, denialReasons, enrichments, denialInfoLookup) {
  const p = patientData || {};
  const e = enrichments || {};

  const name = clean(p.name, "the patient");
  const dob = clean(p.dob, "[date of birth]");
  const insurance = clean(p.insurance, "the insurer");
  const diagnosis = clean(p.diagnosis, "[diagnosis]");
  const icd10 = clean(p.icd10, "[ICD-10]");
  const treatment = clean(p.requestedTreatment || p.treatment, "[requested treatment]");
  const cpt = joinCodes(e.cptCodes);
  const costAvoidance = clean(e.costAvoidance);

  const lines = [];
  lines.push("APPEAL OF PRIOR AUTHORIZATION DENIAL");
  lines.push("");
  lines.push(`Prior Authorization Department`);
  lines.push(insurance);
  lines.push("");
  lines.push(`RE: Appeal of Denied Prior Authorization`);
  lines.push(`Patient: ${name}`);
  lines.push(`Date of Birth: ${dob}`);
  lines.push(`Diagnosis: ${diagnosis} (ICD-10: ${icd10})`);
  lines.push(`Requested Treatment: ${treatment}`);
  lines.push("");
  lines.push("Dear Medical Director,");
  lines.push("");
  lines.push(
    `I am formally appealing the denial of the prior authorization request for ${treatment} for my patient, ` +
      `${name}. The denial rationale is addressed point by point below with supporting clinical justification.`
  );

  lines.push("");
  lines.push("RESPONSE TO EACH DENIAL REASON");
  (denialReasons || []).forEach((code, i) => {
    const info = denialInfoLookup ? denialInfoLookup(code) : null;
    const label = info && info.label ? info.label : code;
    const desc = info && info.description ? info.description : "";
    lines.push(`  ${i + 1}. ${label}`);
    if (desc) lines.push(`     Insurer objection: ${desc}`);
    lines.push(
      `     Response: The clinical record supports medical necessity for this patient and directly addresses ` +
        `this objection. Denying the requested therapy risks disease progression and higher downstream cost of care.`
    );
  });

  if (cpt) {
    lines.push("");
    lines.push(`Applicable billing codes: ${cpt}`);
  }
  if (costAvoidance) {
    lines.push("");
    lines.push("COST-EFFECTIVENESS");
    lines.push(costAvoidance);
  }

  lines.push("");
  lines.push(
    `I request an expedited review and a peer-to-peer discussion with a board-certified specialist in the ` +
      `relevant field. I am available at the contact information below and am prepared to provide any additional ` +
      `documentation needed to overturn this denial.`
  );
  lines.push("");
  lines.push("Sincerely,");
  lines.push("");
  lines.push("[Physician Name], MD");
  lines.push("NPI: [NPI]");
  lines.push("[Practice name, address, phone]");

  return lines.join("\n");
}
