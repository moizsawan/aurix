// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Denial-Anticipation Check
// ═══════════════════════════════════════════════════════════════════════════════
// For each denial pattern the criteria engine knows for this payer and therapy,
// heuristically decide whether the patient record appears to address it, and
// flag the ones it does not. This is the "denial-anticipation check that flags
// missing required elements before submission" step of the roadmap. It is a
// deterministic pre-submission screen, distinct from the Stage 6 readiness
// score: it maps each known denial reason to concrete evidence in the record.
// ═══════════════════════════════════════════════════════════════════════════════

function recordText(patientData) {
  const p = patientData || {};
  return [
    p.currentMedications,
    p.stepTherapy,
    p.medicalHistory,
    p.clinicalJustification,
    p.currentTreatmentInadequacy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Keyword that may appear in a denial reason -> evidence terms to look for in
// the patient record. Used to infer whether a given denial reason is addressed.
const SIGNALS = [
  { key: "step therapy", terms: ["fail", "tried", "trial", "inadequate", "intoleran", "not tried"] },
  { key: "trial", terms: ["fail", "tried", "trial", "inadequate", "intoleran"] },
  { key: "hepatitis", terms: ["hepatitis", "hbv", "hcv"] },
  { key: "tb", terms: ["tb", "tuberculosis", "quantiferon", "ppd"] },
  { key: "score", terms: ["das28", "cdai", "phq", "ham-d", "hamd", "edss", "act ", "bsa", "pasi", "nyha", "harvey"] },
  { key: "diary", terms: ["diary", "migraine day", "headache"] },
  { key: "migraine days", terms: ["diary", "migraine day", "headache"] },
  { key: "eosinophil", terms: ["eosinophil"] },
  { key: "lvef", terms: ["lvef", "ejection fraction"] },
  { key: "endoscop", terms: ["endoscop", "colonoscopy"] },
  { key: "imaging", terms: ["x-ray", "xray", "radiograph", "mri", "ct ", "echocardiogram", "colonoscopy", "endoscop"] },
  { key: "biomarker", terms: ["pd-l1", "pdl1", "msi", "mmr", "tmb"] },
  { key: "staging", terms: ["stage", "staging", "pet", "ct "] },
];

// Returns [{ reason, addressed: true|false|null, note }]. `null` means the check
// could not infer an answer and manual review is recommended.
export function anticipateDenials(patientData, criteria) {
  if (!criteria || !Array.isArray(criteria.commonDenialReasons)) return [];
  const text = recordText(patientData);

  return criteria.commonDenialReasons.map((reason) => {
    const r = reason.toLowerCase();
    let addressed = null;
    for (const sig of SIGNALS) {
      if (r.includes(sig.key)) {
        addressed = sig.terms.some((t) => text.includes(t));
        break;
      }
    }
    return {
      reason,
      addressed,
      note:
        addressed === false
          ? "No supporting evidence found in the record"
          : addressed === true
          ? "Appears addressed in the record"
          : "Manual review recommended",
    };
  });
}
