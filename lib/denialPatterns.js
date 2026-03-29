// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Denial Pattern Learning Engine (Stage 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Statistical model that learns from approval/denial outcomes to build
// insurer-specific probability estimates. Currently uses synthetic historical
// data. The METHOD is what's patentable — not the dataset size.
// ═══════════════════════════════════════════════════════════════════════════════

// Synthetic historical outcome data based on published PA denial rates
// Source patterns: AMA Prior Authorization Survey 2023, JAMA Health Forum 2022
const HISTORICAL_OUTCOMES = [
  // UnitedHealthcare - Biologics Rheum
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 11 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 8 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: true, letterScore: 9 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 10 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 6 },
  { insurer: "UnitedHealthcare", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: false, letterScore: 11 },

  // UnitedHealthcare - GLP-1
  { insurer: "UnitedHealthcare", drugClass: "glp1_agonists", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 7 },
  { insurer: "UnitedHealthcare", drugClass: "glp1_agonists", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: false, letterScore: 11 },
  { insurer: "UnitedHealthcare", drugClass: "glp1_agonists", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 8 },
  { insurer: "UnitedHealthcare", drugClass: "glp1_agonists", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: false, letterScore: 12 },
  { insurer: "UnitedHealthcare", drugClass: "glp1_agonists", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 5 },

  // UnitedHealthcare - Immunotherapy
  { insurer: "UnitedHealthcare", drugClass: "immunotherapy", outcome: "approved", hadStepTherapy: false, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "UnitedHealthcare", drugClass: "immunotherapy", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: true, letterScore: 9 },
  { insurer: "UnitedHealthcare", drugClass: "immunotherapy", outcome: "approved", hadStepTherapy: false, hadLabs: true, hadImaging: true, letterScore: 11 },

  // Aetna - Biologics Rheum
  { insurer: "Aetna", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 10 },
  { insurer: "Aetna", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "Aetna", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 7 },
  { insurer: "Aetna", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 11 },
  { insurer: "Aetna", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 5 },

  // Aetna - Biologics GI
  { insurer: "Aetna", drugClass: "biologics_gi", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "Aetna", drugClass: "biologics_gi", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 8 },
  { insurer: "Aetna", drugClass: "biologics_gi", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 11 },
  { insurer: "Aetna", drugClass: "biologics_gi", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: true, letterScore: 9 },

  // BlueCross BlueShield - Biologics Rheum
  { insurer: "BlueCross BlueShield", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 11 },
  { insurer: "BlueCross BlueShield", drugClass: "biologics_rheum", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "BlueCross BlueShield", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 7 },
  { insurer: "BlueCross BlueShield", drugClass: "biologics_rheum", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 8 },

  // BlueCross - GLP1
  { insurer: "BlueCross BlueShield", drugClass: "glp1_agonists", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: false, letterScore: 12 },
  { insurer: "BlueCross BlueShield", drugClass: "glp1_agonists", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 6 },
  { insurer: "BlueCross BlueShield", drugClass: "glp1_agonists", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: false, letterScore: 10 },

  // CGRP inhibitors - mixed
  { insurer: "UnitedHealthcare", drugClass: "cgrp_inhibitors", outcome: "approved", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 11 },
  { insurer: "UnitedHealthcare", drugClass: "cgrp_inhibitors", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 7 },
  { insurer: "Aetna", drugClass: "cgrp_inhibitors", outcome: "approved", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 12 },
  { insurer: "Aetna", drugClass: "cgrp_inhibitors", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 6 },

  // Viscosupplementation - high denial
  { insurer: "UnitedHealthcare", drugClass: "viscosupplementation", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: true, letterScore: 9 },
  { insurer: "UnitedHealthcare", drugClass: "viscosupplementation", outcome: "denied", hadStepTherapy: false, hadLabs: false, hadImaging: false, letterScore: 5 },
  { insurer: "UnitedHealthcare", drugClass: "viscosupplementation", outcome: "approved", hadStepTherapy: true, hadLabs: false, hadImaging: true, letterScore: 12 },
  { insurer: "Aetna", drugClass: "viscosupplementation", outcome: "denied", hadStepTherapy: true, hadLabs: false, hadImaging: false, letterScore: 8 },
  { insurer: "Aetna", drugClass: "viscosupplementation", outcome: "approved", hadStepTherapy: true, hadLabs: false, hadImaging: true, letterScore: 11 },

  // MS therapies
  { insurer: "UnitedHealthcare", drugClass: "ms_therapies", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 12 },
  { insurer: "UnitedHealthcare", drugClass: "ms_therapies", outcome: "denied", hadStepTherapy: false, hadLabs: true, hadImaging: false, letterScore: 8 },
  { insurer: "BlueCross BlueShield", drugClass: "ms_therapies", outcome: "approved", hadStepTherapy: true, hadLabs: true, hadImaging: true, letterScore: 11 },
];

// ─── STATISTICAL MODEL ───────────────────────────────────────────────────────

function computeDenialProbability(insurer, drugClass, features) {
  // Filter relevant historical data
  let pool = HISTORICAL_OUTCOMES.filter(o => o.drugClass === drugClass);

  // Prefer insurer-specific data, fall back to all-insurer data for that drug class
  const insurerPool = pool.filter(o => o.insurer === insurer);
  if (insurerPool.length >= 3) {
    pool = insurerPool;
  }

  if (pool.length === 0) {
    return { probability: 0.35, confidence: "low", sampleSize: 0, factors: [] };
  }

  // Base denial rate for this insurer + drug class
  const denials = pool.filter(o => o.outcome === "denied");
  let baseDenialRate = denials.length / pool.length;

  // Adjust based on features
  const factors = [];
  let adjustedRate = baseDenialRate;

  // Step therapy factor
  if (!features.hadStepTherapy) {
    const noStepDenials = pool.filter(o => !o.hadStepTherapy && o.outcome === "denied").length;
    const noStepTotal = pool.filter(o => !o.hadStepTherapy).length;
    if (noStepTotal > 0) {
      const noStepDenialRate = noStepDenials / noStepTotal;
      adjustedRate = Math.max(adjustedRate, noStepDenialRate);
      if (noStepDenialRate > baseDenialRate) {
        factors.push({
          factor: "Missing step therapy documentation",
          impact: `+${Math.round((noStepDenialRate - baseDenialRate) * 100)}% denial risk`,
          severity: "HIGH"
        });
      }
    }
  } else {
    const withStepApprovals = pool.filter(o => o.hadStepTherapy && o.outcome === "approved").length;
    const withStepTotal = pool.filter(o => o.hadStepTherapy).length;
    if (withStepTotal > 0) {
      const withStepApprovalRate = withStepApprovals / withStepTotal;
      factors.push({
        factor: "Step therapy documented",
        impact: `${Math.round(withStepApprovalRate * 100)}% historical approval rate when documented`,
        severity: "POSITIVE"
      });
    }
  }

  // Labs factor
  if (!features.hadLabs) {
    const noLabsDenials = pool.filter(o => !o.hadLabs && o.outcome === "denied").length;
    const noLabsTotal = pool.filter(o => !o.hadLabs).length;
    if (noLabsTotal > 0) {
      const noLabsDenialRate = noLabsDenials / noLabsTotal;
      adjustedRate = Math.max(adjustedRate, noLabsDenialRate * 0.8 + adjustedRate * 0.2);
      if (noLabsDenialRate > baseDenialRate) {
        factors.push({
          factor: "Missing required lab documentation",
          impact: `+${Math.round((noLabsDenialRate - baseDenialRate) * 100)}% denial risk`,
          severity: "HIGH"
        });
      }
    }
  }

  // Letter quality factor
  if (features.letterScore !== undefined) {
    const highScoreApprovals = pool.filter(o => o.letterScore >= 10 && o.outcome === "approved").length;
    const highScoreTotal = pool.filter(o => o.letterScore >= 10).length;
    const lowScoreDenials = pool.filter(o => o.letterScore < 10 && o.outcome === "denied").length;
    const lowScoreTotal = pool.filter(o => o.letterScore < 10).length;

    if (features.letterScore >= 10 && highScoreTotal > 0) {
      const highScoreApprovalRate = highScoreApprovals / highScoreTotal;
      adjustedRate *= (1 - highScoreApprovalRate * 0.3);
      factors.push({
        factor: "High letter quality score",
        impact: `Letters scoring 10+ have ${Math.round(highScoreApprovalRate * 100)}% approval rate`,
        severity: "POSITIVE"
      });
    } else if (features.letterScore < 10 && lowScoreTotal > 0) {
      const lowScoreDenialRate = lowScoreDenials / lowScoreTotal;
      adjustedRate = Math.max(adjustedRate, lowScoreDenialRate * 0.5 + adjustedRate * 0.5);
      factors.push({
        factor: "Below-threshold letter quality",
        impact: `Letters scoring <10 have ${Math.round(lowScoreDenialRate * 100)}% denial rate`,
        severity: "MEDIUM"
      });
    }
  }

  // Clamp probability
  adjustedRate = Math.max(0.05, Math.min(0.95, adjustedRate));

  // Confidence based on sample size
  let confidence = "low";
  if (pool.length >= 10) confidence = "high";
  else if (pool.length >= 5) confidence = "medium";

  return {
    probability: Math.round(adjustedRate * 100) / 100,
    confidence,
    sampleSize: pool.length,
    baseDenialRate: Math.round(baseDenialRate * 100) / 100,
    factors,
    recommendation: adjustedRate > 0.5
      ? "HIGH RISK — Consider strengthening documentation before submission"
      : adjustedRate > 0.3
      ? "MODERATE RISK — Review flagged items to improve approval chances"
      : "LOW RISK — Documentation appears strong for this insurer/drug combination",
  };
}

// Record a new outcome (for learning over time)
function recordOutcome(outcome) {
  HISTORICAL_OUTCOMES.push(outcome);
  return HISTORICAL_OUTCOMES.length;
}

export {
  computeDenialProbability,
  recordOutcome,
  HISTORICAL_OUTCOMES,
};
