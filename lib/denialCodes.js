// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Shared Denial Reason Codes
// ═══════════════════════════════════════════════════════════════════════════════
// Single source of truth for denial reason codes used by both
// the frontend UI and the appeal generation API.
// ═══════════════════════════════════════════════════════════════════════════════

export const DENIAL_CODES = [
  { code: "NOT_MEDICALLY_NECESSARY", label: "Not medically necessary", description: "Insurer determined the treatment is not medically necessary based on submitted documentation" },
  { code: "STEP_THERAPY_INCOMPLETE", label: "Step therapy requirements not met", description: "Required prior treatments were not adequately documented or completed" },
  { code: "MISSING_DOCUMENTATION", label: "Missing required documentation", description: "Required labs, imaging, or clinical documentation was not included" },
  { code: "PREFERRED_ALTERNATIVE", label: "Preferred alternative available", description: "Insurer requires trial of a preferred formulary alternative first" },
  { code: "EXPERIMENTAL", label: "Treatment considered experimental", description: "Insurer considers the treatment experimental or investigational for this indication" },
  { code: "DOSAGE_EXCEEDS", label: "Dosage exceeds limits", description: "Requested dosage or frequency exceeds insurer's approved limits" },
  { code: "OFF_LABEL", label: "Off-label use", description: "Treatment is being used for an off-label indication" },
  { code: "INSUFFICIENT_SEVERITY", label: "Insufficient disease severity", description: "Documented disease severity does not meet threshold for requested treatment" },
  { code: "CRITERIA_NOT_MET", label: "Coverage criteria not met", description: "One or more specific coverage criteria were not satisfied" },
  { code: "OTHER", label: "Other denial reason", description: "Denial reason not listed above" },
];
