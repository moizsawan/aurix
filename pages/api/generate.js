// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — 7-Stage PA Letter Generation Pipeline
// ═══════════════════════════════════════════════════════════════════════════════
// Stage 1: Insurer Criteria Matching (deterministic)
// Stage 2: LLM Letter Generation (with enriched context)
// Stage 3: Rubric Scoring (programmatic quality gate)
// Stage 4: Iterative Self-Correction (if below threshold)
// Stage 5: Denial Probability Scoring (statistical)
// Stage 6: Pre-Submission Readiness Scoring (separate endpoint)
// Stage 7: Appeal Letter Generation (separate endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

import { identifyDrugClass, getInsurerCriteria, performGapAnalysis } from "../../lib/insurerCriteria";
import { scoreLetter, formatScoreForPrompt } from "../../lib/rubricScorer";
import { computeDenialProbability } from "../../lib/denialPatterns";
import { buildDemoPaLetter } from "../../lib/demoLetter";
import { checkRateLimit } from "../../lib/rateLimit";

const MAX_ITERATIONS = 3;
const SCORE_THRESHOLD = 10; // out of 12

async function callClaude(messages, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    let errText = "";
    try { errText = await response.text(); } catch {}

    if (status === 401) {
      throw new Error("The AI service rejected the request credentials.");
    } else if (status === 429) {
      throw new Error("Rate limited by the AI service. Please wait a moment and try again.");
    } else if (status === 529 || status === 503) {
      throw new Error("The AI service is temporarily overloaded. Please try again in a few seconds.");
    } else if (status === 400) {
      throw new Error("Invalid request sent to AI service. This may be a bug — please report it.");
    } else {
      throw new Error(`AI service returned error ${status}. Please try again.`);
    }
  }

  const data = await response.json();
  return data.content.map(c => c.text || "").join("");
}

function buildGenerationPrompt(patientData, gapAnalysis, enrichments, feedbackFromScoring) {
  let prompt = `You are a medical prior authorization specialist with deep knowledge of insurer-specific requirements. Generate a complete, professional prior authorization request letter for the following case.

PATIENT INFORMATION:
- Name: ${patientData.name}
- Date of Birth: ${patientData.dob}
- Insurance: ${patientData.insurance}
- Diagnosis: ${patientData.diagnosis} (ICD-10: ${patientData.icd10})
- Current Medications: ${patientData.currentMedications}
- Medical History: ${patientData.medicalHistory}

REQUESTED TREATMENT: ${patientData.requestedTreatment}
CLINICAL JUSTIFICATION: ${patientData.clinicalJustification}
PRIOR TREATMENTS TRIED AND FAILED: ${patientData.stepTherapy || "Not specified"}
REASON CURRENT TREATMENT IS INSUFFICIENT: ${patientData.currentTreatmentInadequacy || "Not specified"}

`;

  // Stage 1 enrichments — deterministic data injected
  if (enrichments) {
    prompt += `\n═══ INSURER-SPECIFIC REQUIREMENTS (from Aurix criteria engine) ═══\n`;

    if (enrichments.cptCodes && enrichments.cptCodes.length > 0) {
      prompt += `BILLING CODES — You MUST include these in the letter: ${enrichments.cptCodes.join(", ")}\n`;
    }

    if (enrichments.authDuration) {
      prompt += `AUTHORIZATION DURATION — Specify in the letter: ${enrichments.authDuration}\n`;
    }

    if (enrichments.placeOfService) {
      prompt += `PLACE OF SERVICE — Include in the letter: ${enrichments.placeOfService}\n`;
    }

    if (enrichments.monitoringSchedule) {
      prompt += `MONITORING PLAN — Include this follow-up schedule: ${enrichments.monitoringSchedule}\n`;
    }

    if (enrichments.costAvoidance) {
      prompt += `COST-EFFECTIVENESS ARGUMENT — Use this data: ${enrichments.costAvoidance}\n`;
    }

    if (enrichments.commonDenialReasons && enrichments.commonDenialReasons.length > 0) {
      prompt += `\nCOMMON DENIAL REASONS FOR THIS INSURER — Proactively address ALL of these:\n`;
      enrichments.commonDenialReasons.forEach((r, i) => {
        prompt += `  ${i + 1}. ${r}\n`;
      });
    }

    if (enrichments.requiredLabs && enrichments.requiredLabs.length > 0) {
      prompt += `\nREQUIRED LABS — Reference these as enclosed/available: ${enrichments.requiredLabs.join(", ")}\n`;
    }

    if (enrichments.requiredImaging && enrichments.requiredImaging.length > 0) {
      prompt += `\nREQUIRED IMAGING — Reference as enclosed/available: ${enrichments.requiredImaging.join(", ")}\n`;
    }
  }

  // Gap analysis results
  if (gapAnalysis && gapAnalysis.gaps && gapAnalysis.gaps.length > 0) {
    prompt += `\n═══ DOCUMENTATION GAP ANALYSIS ═══\n`;
    prompt += `The following gaps were identified between patient data and insurer requirements:\n`;
    gapAnalysis.gaps.forEach((g, i) => {
      if (typeof g === "object") {
        prompt += `  ${i + 1}. [${g.severity}] ${g.message}\n     Recommendation: ${g.recommendation}\n`;
      } else {
        prompt += `  ${i + 1}. ${g}\n`;
      }
    });
    prompt += `\nAddress these gaps in the letter where possible, and flag items that require additional documentation from the physician.\n`;
  }

  // Stage 4 — Feedback from previous scoring iteration
  if (feedbackFromScoring) {
    prompt += `\n═══ QUALITY GATE FEEDBACK FROM PREVIOUS ITERATION ═══\n`;
    prompt += feedbackFromScoring;
    prompt += `\nIMPORTANT: Your previous letter did not meet the quality threshold. Address ALL of the above feedback in this revision. Do not omit any of the required elements.\n`;
  }

  prompt += `
LETTER REQUIREMENTS:
1. Open with proper salutation to the insurance medical director
2. Include patient demographics, diagnosis with ICD-10 code
3. State medical necessity clearly with supporting evidence
4. Document all prior treatments tried, with dosages, duration, and reasons for failure
5. Include CPT/HCPCS billing codes for the requested treatment
6. Specify the requested authorization duration
7. State the place of service
8. Include a monitoring and follow-up plan
9. Add a cost-effectiveness/cost-avoidance argument
10. Preemptively address common denial reasons for this insurer
11. Reference all enclosed supporting documentation
12. Close with physician signature block, credentials (MD), NPI placeholder, and contact information

Return only the letter text, properly formatted. Do not include any meta-commentary.`;

  return prompt;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Demo mode: when no API key is configured, the pipeline still runs end to end
  // and produces a deterministic, payer-aware draft instead of surfacing an error.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let demoMode = !apiKey;

  const { patientData } = req.body;
  if (!patientData) {
    return res.status(400).json({ error: "Patient data required" });
  }

  // Protect the shared API key on the public demo: throttle real LLM usage.
  // A throttled request degrades to a deterministic draft rather than erroring.
  if (!demoMode && !checkRateLimit(req).allowed) {
    demoMode = true;
  }

  const pipeline = {
    stages: [],
    iterations: 0,
    finalScore: null,
    denialProbability: null,
    letter: null,
    startTime: Date.now(),
  };

  try {
    // ═══ STAGE 1: Insurer Criteria Matching ═══
    const stage1Start = Date.now();
    const drugMatch = identifyDrugClass(patientData.requestedTreatment || "");
    let criteria = null;
    let gapAnalysis = null;
    let enrichments = null;

    if (drugMatch) {
      criteria = getInsurerCriteria(patientData.insurance, drugMatch.drugClass);
      if (criteria) {
        gapAnalysis = performGapAnalysis(patientData, criteria);
        enrichments = gapAnalysis.enrichments;
      }
    }

    pipeline.stages.push({
      stage: 1,
      name: "Insurer Criteria Matching",
      duration: Date.now() - stage1Start,
      result: {
        drugIdentified: drugMatch ? drugMatch.drugName : null,
        drugClass: drugMatch ? drugMatch.drugClass : null,
        criteriaFound: !!criteria,
        gapCount: gapAnalysis ? gapAnalysis.gaps.length : 0,
        gapScore: gapAnalysis ? gapAnalysis.score : null,
        gaps: gapAnalysis ? gapAnalysis.gaps : [],
        met: gapAnalysis ? gapAnalysis.met : [],
        enrichments: enrichments ? {
          cptCodes: enrichments.cptCodes,
          authDuration: enrichments.authDuration,
          placeOfService: enrichments.placeOfService,
          monitoringSchedule: enrichments.monitoringSchedule,
          costAvoidance: enrichments.costAvoidance,
          commonDenialReasons: enrichments.commonDenialReasons,
        } : null,
      },
    });

    // ═══ STAGE 2 + 3 + 4: Generate, Score, Iterate ═══
    let letter = null;
    let scoreResult = null;
    let feedbackPrompt = null;
    let iteration = 0;
    let fallbackNotice = null;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const genStart = Date.now();

      // Stage 2: Generate
      if (demoMode) {
        letter = buildDemoPaLetter(patientData, enrichments, gapAnalysis);
      } else {
        const prompt = buildGenerationPrompt(patientData, gapAnalysis, enrichments, feedbackPrompt);
        try {
          letter = await callClaude([{ role: "user", content: prompt }], apiKey);
        } catch (err) {
          // Graceful fallback mid-request: switch to a deterministic draft so the
          // pipeline still returns a usable result instead of a raw error.
          demoMode = true;
          fallbackNotice = err.message;
          letter = buildDemoPaLetter(patientData, enrichments, gapAnalysis);
        }
      }

      const genDuration = Date.now() - genStart;

      // Stage 3: Score
      const scoreStart = Date.now();
      scoreResult = scoreLetter(letter);
      const scoreDuration = Date.now() - scoreStart;

      pipeline.stages.push({
        stage: iteration === 1 ? 2 : 4,
        name: iteration === 1
          ? (demoMode ? "Letter Generation (demo mode)" : "LLM Letter Generation")
          : `Self-Correction (Iteration ${iteration})`,
        duration: genDuration,
        result: { wordCount: letter.split(/\s+/).length, demoMode },
      });

      pipeline.stages.push({
        stage: 3,
        name: `Rubric Scoring${iteration > 1 ? ` (Iteration ${iteration})` : ""}`,
        duration: scoreDuration,
        result: {
          totalScore: scoreResult.totalScore,
          maxScore: scoreResult.maxScore,
          percentage: scoreResult.percentage,
          passed: scoreResult.passed,
          criteria: scoreResult.criteria.map(c => ({
            name: c.name,
            score: c.score,
            maxScore: c.maxScore,
            passed: c.passed,
          })),
        },
      });

      // In demo mode the deterministic draft is stable, so there is nothing to
      // iterate on. Otherwise stop once the quality gate passes or iterations run out.
      if (demoMode || scoreResult.passed || iteration >= MAX_ITERATIONS) {
        break;
      }

      // Stage 4: Generate feedback for next iteration
      feedbackPrompt = formatScoreForPrompt(scoreResult);
    }

    pipeline.iterations = iteration;
    pipeline.letter = letter;
    pipeline.demoMode = demoMode;
    if (fallbackNotice) pipeline.notice = fallbackNotice;
    pipeline.finalScore = {
      totalScore: scoreResult.totalScore,
      maxScore: scoreResult.maxScore,
      percentage: scoreResult.percentage,
      passed: scoreResult.passed,
      criteria: scoreResult.criteria,
    };

    // ═══ STAGE 5: Denial Pattern Scoring ═══
    const stage5Start = Date.now();
    const denialResult = computeDenialProbability(
      patientData.insurance,
      drugMatch ? drugMatch.drugClass : "unknown",
      {
        hadStepTherapy: !!(patientData.stepTherapy && patientData.stepTherapy.trim()),
        hadLabs: true, // Assume labs available since they're referenced
        hadImaging: criteria ? (criteria.requiredImaging && criteria.requiredImaging.length > 0) : false,
        letterScore: scoreResult.totalScore,
      }
    );

    pipeline.stages.push({
      stage: 5,
      name: "Denial Pattern Analysis",
      duration: Date.now() - stage5Start,
      result: denialResult,
    });

    pipeline.denialProbability = denialResult;
    pipeline.totalDuration = Date.now() - pipeline.startTime;

    return res.status(200).json(pipeline);

  } catch (err) {
    pipeline.error = err.message;
    pipeline.totalDuration = Date.now() - pipeline.startTime;
    return res.status(500).json({ error: err.message, pipeline });
  }
}
