// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Appeal Letter Generation Pipeline (Stage 7)
// ═══════════════════════════════════════════════════════════════════════════════
// When a PA is denied, this generates a targeted appeal letter that directly
// addresses each denial reason with additional clinical evidence and arguments.
// Uses the same Stage 1 criteria engine + Stage 3 rubric scoring.
// ═══════════════════════════════════════════════════════════════════════════════

import { identifyDrugClass, getInsurerCriteria } from "../../lib/insurerCriteria";
import { scoreLetter, formatScoreForPrompt } from "../../lib/rubricScorer";
import { DENIAL_CODES as COMMON_DENIAL_CODES } from "../../lib/denialCodes";
import { buildDemoAppealLetter } from "../../lib/demoLetter";
import { checkRateLimit } from "../../lib/rateLimit";

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
      max_tokens: 3500,
      messages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new Error("The AI service rejected the request credentials.");
    if (status === 429) throw new Error("Rate limited. Please wait a moment and try again.");
    if (status === 529 || status === 503) throw new Error("AI service temporarily overloaded. Try again shortly.");
    throw new Error(`AI service error (${status}). Please try again.`);
  }

  const data = await response.json();
  return data.content.map(c => c.text || "").join("");
}

function buildAppealPrompt(patientData, denialReasons, originalLetter, enrichments, customDenialText) {
  let prompt = `You are a medical prior authorization appeal specialist. A prior authorization request has been DENIED. Generate a compelling, evidence-based appeal letter that directly addresses each denial reason.

PATIENT INFORMATION:
- Name: ${patientData.name}
- Date of Birth: ${patientData.dob}
- Insurance: ${patientData.insurance}
- Diagnosis: ${patientData.diagnosis} (ICD-10: ${patientData.icd10})
- Current Medications: ${patientData.currentMedications}
- Medical History: ${patientData.medicalHistory}

REQUESTED TREATMENT: ${patientData.requestedTreatment || patientData.treatment}
CLINICAL JUSTIFICATION: ${patientData.clinicalJustification || patientData.justification}
PRIOR TREATMENTS: ${patientData.stepTherapy || "See medical history"}

═══ DENIAL REASONS TO ADDRESS ═══
`;

  if (denialReasons && denialReasons.length > 0) {
    denialReasons.forEach((reason, i) => {
      const denialInfo = COMMON_DENIAL_CODES.find(c => c.code === reason);
      prompt += `${i + 1}. ${denialInfo ? denialInfo.label : reason}: ${denialInfo ? denialInfo.description : "Address this denial reason"}\n`;
    });
  }

  if (customDenialText) {
    prompt += `\nAdditional denial details from insurer: "${customDenialText}"\n`;
  }

  // Add insurer-specific enrichments
  if (enrichments) {
    prompt += `\n═══ INSURER-SPECIFIC DATA (from Aurix criteria engine) ═══\n`;

    if (enrichments.cptCodes && enrichments.cptCodes.length > 0) {
      prompt += `Billing Codes: ${enrichments.cptCodes.join(", ")}\n`;
    }
    if (enrichments.costAvoidance) {
      prompt += `Cost-Avoidance Data: ${enrichments.costAvoidance}\n`;
    }
    if (enrichments.commonDenialReasons && enrichments.commonDenialReasons.length > 0) {
      prompt += `Known Denial Patterns for ${patientData.insurance}:\n`;
      enrichments.commonDenialReasons.forEach((r, i) => {
        prompt += `  ${i + 1}. ${r}\n`;
      });
    }
  }

  if (originalLetter) {
    prompt += `\n═══ ORIGINAL PA LETTER (for reference) ═══\n${originalLetter.slice(0, 2000)}\n`;
  }

  prompt += `
APPEAL LETTER REQUIREMENTS:
1. Open with "APPEAL OF PRIOR AUTHORIZATION DENIAL" header and reference the original PA request
2. State the denial was received and list each denial reason
3. For EACH denial reason, provide a dedicated section that:
   a. Restates the insurer's objection
   b. Provides specific clinical evidence refuting the objection
   c. Cites relevant clinical guidelines (AMA, ACR, NCCN, ADA, etc.)
   d. References published literature supporting the treatment choice
   e. Explains why the denial puts the patient at medical risk
4. Include a section on the regulatory and legal basis for appeal (ERISA, state prompt-pay laws, CMS guidelines if applicable)
5. Add a strong cost-effectiveness argument showing that denying this treatment will likely result in higher downstream costs
6. Request expedited review if clinically appropriate
7. Request a peer-to-peer review with a board-certified specialist in the relevant field
8. Close with physician signature block and explicit statement that the physician is willing to participate in peer-to-peer discussion
9. Include CPT/HCPCS codes, requested authorization duration, and place of service
10. Maintain a firm but professional tone throughout

The appeal must be MORE detailed and MORE evidence-heavy than the original PA letter. Each denied point needs to be addressed with overwhelming clinical justification.

Return only the appeal letter text, properly formatted. Do not include any meta-commentary.`;

  return prompt;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Demo mode: with no API key configured, generate a deterministic appeal draft
  // instead of surfacing an error.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let demoMode = !apiKey;

  const { patientData, denialReasons, customDenialText, originalLetter } = req.body;
  if (!patientData || !denialReasons || denialReasons.length === 0) {
    return res.status(400).json({ error: "Patient data and at least one denial reason required" });
  }

  // Protect the shared API key on the public demo: throttle real LLM usage.
  if (!demoMode && !checkRateLimit(req).allowed) {
    demoMode = true;
  }

  const startTime = Date.now();

  try {
    // Get insurer criteria enrichments
    const drugMatch = identifyDrugClass(patientData.requestedTreatment || patientData.treatment || "");
    let enrichments = null;
    if (drugMatch) {
      const criteria = getInsurerCriteria(patientData.insurance, drugMatch.drugClass);
      if (criteria) {
        enrichments = {
          cptCodes: criteria.cptCodes,
          costAvoidance: criteria.costAvoidance,
          commonDenialReasons: criteria.commonDenialReasons,
          monitoringSchedule: criteria.monitoringSchedule,
          authDuration: criteria.authDuration,
          placeOfService: criteria.placeOfService,
        };
      }
    }

    // Generate appeal letter. When the LLM is unavailable (no key, exhausted
    // credit, upstream error) fall back to a deterministic appeal draft.
    const denialInfoLookup = (code) => COMMON_DENIAL_CODES.find(c => c.code === code);
    let appealLetter = null;
    let iterations = 1;
    let fallbackNotice = null;

    if (demoMode) {
      appealLetter = buildDemoAppealLetter(patientData, denialReasons, enrichments, denialInfoLookup);
    } else {
      const prompt = buildAppealPrompt(patientData, denialReasons, originalLetter, enrichments, customDenialText);
      try {
        appealLetter = await callClaude([{ role: "user", content: prompt }], apiKey);

        // If below threshold, regenerate with feedback (one iteration for appeals)
        const scoreResult = scoreLetter(appealLetter);
        if (!scoreResult.passed) {
          const feedback = formatScoreForPrompt(scoreResult);
          const retryPrompt = prompt + "\n\n" + feedback + "\nIMPORTANT: Address ALL quality gate feedback in this revision.";
          appealLetter = await callClaude([{ role: "user", content: retryPrompt }], apiKey);
          iterations = 2;
        }
      } catch (err) {
        demoMode = true;
        fallbackNotice = err.message;
        appealLetter = buildDemoAppealLetter(patientData, denialReasons, enrichments, denialInfoLookup);
      }
    }

    const finalScore = scoreLetter(appealLetter);

    return res.status(200).json({
      appealLetter,
      denialReasons: denialReasons.map(code => {
        const info = COMMON_DENIAL_CODES.find(c => c.code === code);
        return { code, label: info?.label || code, description: info?.description || "" };
      }),
      score: {
        totalScore: finalScore.totalScore,
        maxScore: finalScore.maxScore,
        percentage: finalScore.percentage,
        passed: finalScore.passed,
        criteria: finalScore.criteria,
      },
      iterations,
      demoMode,
      notice: fallbackNotice || undefined,
      duration: Date.now() - startTime,
      wordCount: appealLetter.split(/\s+/).length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
