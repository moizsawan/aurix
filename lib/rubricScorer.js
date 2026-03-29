// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Closed-Loop Rubric Scoring Engine (Stage 3)
// ═══════════════════════════════════════════════════════════════════════════════
// Converts the PA benchmarking paper's 6-criteria rubric into programmatic
// checks. Each criterion is scored 0-2. Total score out of 12.
// If score < threshold, Stage 4 regenerates with targeted feedback.
// ═══════════════════════════════════════════════════════════════════════════════

const RUBRIC_CRITERIA = [
  {
    id: "clinical_completeness",
    name: "Clinical Completeness",
    weight: 2,
    description: "Diagnosis, ICD-10, relevant history, current medications, prior treatments",
    checks: [
      { pattern: /ICD[- ]?10|[A-Z]\d{2}\.\d{1,2}/i, label: "ICD-10 code present", points: 0.5 },
      { pattern: /diagnosis|diagnosed|condition/i, label: "Diagnosis stated", points: 0.5 },
      { pattern: /history|prior|previous|failed|tried|attempted/i, label: "Medical history referenced", points: 0.5 },
      { pattern: /medication|drug|therapy|treatment|mg|dose/i, label: "Medications referenced", points: 0.5 },
    ]
  },
  {
    id: "medical_necessity",
    name: "Treatment Justification / Medical Necessity",
    weight: 2,
    description: "Clear argument for why the requested treatment is medically necessary",
    checks: [
      { pattern: /medically necessary|medical necessity|clinically indicated|clinically necessary/i, label: "Medical necessity statement", points: 0.5 },
      { pattern: /evidence|studies|clinical trial|guideline|literature|peer.reviewed/i, label: "Evidence cited", points: 0.5 },
      { pattern: /risk|complication|progression|deteriorat|worsen/i, label: "Risk of non-treatment", points: 0.5 },
      { pattern: /quality of life|functional|disability|impair/i, label: "Functional impact", points: 0.5 },
    ]
  },
  {
    id: "step_therapy",
    name: "Step Therapy Documentation",
    weight: 2,
    description: "Prior treatments tried, dosages, duration, and reasons for failure",
    checks: [
      { pattern: /failed|inadequate|intoleran|adverse|side effect|contraindicated/i, label: "Treatment failure documented", points: 0.5 },
      { pattern: /\d+\s*mg|\d+\s*week|\d+\s*month|\d+\s*day/i, label: "Dosage/duration specified", points: 0.5 },
      { pattern: /first.line|second.line|step therapy|conventional|prior/i, label: "Treatment sequence referenced", points: 0.5 },
      { pattern: /titrat|maximu?m?.tolerated|optimal|adequate.trial/i, label: "Adequate trial documented", points: 0.5 },
    ]
  },
  {
    id: "denial_anticipation",
    name: "Denial Anticipation",
    weight: 2,
    description: "Preemptively addresses common insurer objections and denial reasons",
    checks: [
      { pattern: /criteria|requirement|policy|coverage|formulary/i, label: "Insurer criteria referenced", points: 0.5 },
      { pattern: /alternative|preferred|formulary|tier|biosimilar/i, label: "Formulary considerations addressed", points: 0.5 },
      { pattern: /document|attach|enclosed|supporting|evidence/i, label: "Supporting documentation referenced", points: 0.5 },
      { pattern: /appeal|reconsider|peer.to.peer|review/i, label: "Appeals process awareness", points: 0.5 },
    ]
  },
  {
    id: "administrative_completeness",
    name: "Administrative Completeness",
    weight: 2,
    description: "CPT/HCPCS codes, authorization duration, place of service, monitoring plan",
    checks: [
      { pattern: /CPT|HCPCS|J\d{4}|billing code|procedure code/i, label: "Billing codes present", points: 0.5 },
      { pattern: /authorization.*(period|duration|month|year|week)|valid.for|approved.for.*month/i, label: "Authorization duration specified", points: 0.5 },
      { pattern: /place of service|office.based|infusion center|specialty pharmacy|outpatient|home.infusion/i, label: "Place of service stated", points: 0.5 },
      { pattern: /monitor|follow.up|lab.*schedule|assessment.*schedule|check.*every/i, label: "Monitoring plan included", points: 0.5 },
    ]
  },
  {
    id: "professional_formatting",
    name: "Professional Formatting & Structure",
    weight: 2,
    description: "Proper letter format, physician signature block, cost-effectiveness argument",
    checks: [
      { pattern: /dear|to whom|medical director|attention/i, label: "Proper salutation", points: 0.4 },
      { pattern: /sincerely|respectfully|regards|signature/i, label: "Professional closing", points: 0.3 },
      { pattern: /MD|M\.D\.|DO|D\.O\.|physician|provider|NPI/i, label: "Physician credentials", points: 0.3 },
      { pattern: /cost|economic|expense|saving|avoid.*hospitalization|financial/i, label: "Cost-effectiveness argument", points: 0.5 },
      { pattern: /phone|fax|contact|reach|questions/i, label: "Contact information", points: 0.5 },
    ]
  },
];

function scoreLetter(letterText) {
  const results = [];
  let totalScore = 0;

  for (const criterion of RUBRIC_CRITERIA) {
    let criterionScore = 0;
    const checkResults = [];

    for (const check of criterion.checks) {
      const passed = check.pattern.test(letterText);
      if (passed) {
        criterionScore += check.points;
      }
      checkResults.push({
        label: check.label,
        passed,
        points: passed ? check.points : 0,
        maxPoints: check.points,
      });
    }

    // Cap at the criterion weight
    criterionScore = Math.min(criterionScore, criterion.weight);
    totalScore += criterionScore;

    results.push({
      id: criterion.id,
      name: criterion.name,
      score: Math.round(criterionScore * 100) / 100,
      maxScore: criterion.weight,
      checks: checkResults,
      passed: criterionScore >= criterion.weight * 0.75, // 75% threshold per criterion
    });
  }

  totalScore = Math.round(totalScore * 100) / 100;

  return {
    totalScore,
    maxScore: 12,
    percentage: Math.round((totalScore / 12) * 100),
    criteria: results,
    passed: totalScore >= 10, // Overall threshold: 10/12
    failedCriteria: results.filter(r => !r.passed),
  };
}

function generateFeedback(scoreResult) {
  const feedback = [];

  for (const criterion of scoreResult.failedCriteria) {
    const failedChecks = criterion.checks.filter(c => !c.passed);
    if (failedChecks.length > 0) {
      feedback.push({
        criterion: criterion.name,
        criterionId: criterion.id,
        score: criterion.score,
        maxScore: criterion.maxScore,
        missingElements: failedChecks.map(c => c.label),
        instruction: generateCriterionInstruction(criterion.id, failedChecks),
      });
    }
  }

  return feedback;
}

function generateCriterionInstruction(criterionId, failedChecks) {
  const instructions = {
    clinical_completeness: "Add the patient's ICD-10 diagnostic code, explicitly state the diagnosis, reference relevant medical history including comorbidities, and list current medications with dosages.",
    medical_necessity: "Include a clear medical necessity statement. Cite clinical guidelines or evidence supporting this treatment. Explain risks of non-treatment including disease progression. Address impact on patient's functional status and quality of life.",
    step_therapy: "Document each prior treatment tried with specific dosages and duration. Explain why each failed (inadequate response, adverse effects, contraindication). Use terms like 'maximum tolerated dose' and 'adequate trial period'.",
    denial_anticipation: "Reference the specific insurer's coverage criteria. Address formulary tier and whether preferred alternatives were considered. Mention that supporting documentation is enclosed. Reference willingness for peer-to-peer review.",
    administrative_completeness: "Include the CPT/HCPCS billing code for the requested treatment. Specify the requested authorization duration. State the place of service. Include a monitoring and follow-up schedule.",
    professional_formatting: "Ensure proper letter salutation addressed to the medical director. Include a professional closing with physician signature block and credentials. Add a cost-effectiveness or cost-avoidance argument. Include physician contact information.",
  };

  return instructions[criterionId] || "Improve this section with more detail and specificity.";
}

function formatScoreForPrompt(scoreResult) {
  let prompt = `QUALITY GATE FEEDBACK — Score: ${scoreResult.totalScore}/${scoreResult.maxScore} (${scoreResult.percentage}%)\n`;
  prompt += `Status: ${scoreResult.passed ? "PASSED" : "BELOW THRESHOLD — REGENERATION REQUIRED"}\n\n`;

  if (!scoreResult.passed) {
    prompt += "The following criteria need improvement:\n\n";
    const feedback = generateFeedback(scoreResult);
    for (const fb of feedback) {
      prompt += `--- ${fb.criterion} (${fb.score}/${fb.maxScore}) ---\n`;
      prompt += `Missing: ${fb.missingElements.join(", ")}\n`;
      prompt += `Action: ${fb.instruction}\n\n`;
    }
  }

  return prompt;
}

export {
  RUBRIC_CRITERIA,
  scoreLetter,
  generateFeedback,
  formatScoreForPrompt,
};
