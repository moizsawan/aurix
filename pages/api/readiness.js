// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Pre-Submission Readiness Scoring (Stage 6)
// ═══════════════════════════════════════════════════════════════════════════════
// Before the clinician even generates a letter, this module analyzes the
// patient data against insurer criteria and produces a readiness score with
// specific actionable recommendations to improve first-pass approval odds.
// ═══════════════════════════════════════════════════════════════════════════════

import { identifyDrugClass, getInsurerCriteria, performGapAnalysis } from "../../lib/insurerCriteria";
import { computeDenialProbability } from "../../lib/denialPatterns";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { patientData } = req.body;
  if (!patientData) {
    return res.status(400).json({ error: "Patient data required" });
  }

  const result = {
    readinessScore: 0,
    maxScore: 100,
    grade: "F",
    projectedApproval: 0,
    drugMatch: null,
    criteriaFound: false,
    categories: [],
    actionItems: [],
    improvementPotential: 0,
  };

  // Identify drug and get criteria
  const drugMatch = identifyDrugClass(patientData.requestedTreatment || "");
  if (!drugMatch) {
    result.readinessScore = 50;
    result.grade = "C";
    result.projectedApproval = 50;
    result.categories.push({
      name: "Drug Identification",
      score: 0,
      maxScore: 10,
      status: "warning",
      detail: "Could not identify drug class from treatment description. Ensure you include the drug name or generic name.",
    });
    return res.status(200).json(result);
  }

  result.drugMatch = { name: drugMatch.drugName, class: drugMatch.drugClass };
  const criteria = getInsurerCriteria(patientData.insurance, drugMatch.drugClass);

  if (!criteria) {
    result.readinessScore = 40;
    result.grade = "D";
    result.projectedApproval = 40;
    result.criteriaFound = false;
    result.categories.push({
      name: "Insurer Criteria",
      score: 0,
      maxScore: 10,
      status: "warning",
      detail: "No insurer-specific criteria found for this drug class. The letter will use general best practices.",
    });
    return res.status(200).json(result);
  }

  result.criteriaFound = true;
  let totalPoints = 0;
  let maxPoints = 0;

  // ── Category 1: Step Therapy Documentation (30 points) ──────────────────
  const stepCategory = { name: "Step Therapy Documentation", score: 0, maxScore: 30, status: "fail", detail: "", checks: [] };

  if (criteria.stepTherapy.required) {
    const priorMeds = ((patientData.currentMedications || "") + " " + (patientData.stepTherapy || "")).toLowerCase();
    const triedDrugs = criteria.stepTherapy.drugs.filter(d => priorMeds.includes(d.replace(/_/g, " ")));
    const trialsMet = triedDrugs.length >= criteria.stepTherapy.minTrials;

    if (trialsMet) {
      stepCategory.score = 25;
      stepCategory.status = "pass";
      stepCategory.detail = `${triedDrugs.length} of ${criteria.stepTherapy.minTrials} required prior treatments documented: ${triedDrugs.join(", ")}`;
      stepCategory.checks.push({ label: `Required trials (${criteria.stepTherapy.minTrials}+)`, passed: true });
    } else {
      stepCategory.score = triedDrugs.length > 0 ? 10 : 0;
      stepCategory.status = "fail";
      stepCategory.detail = `Only ${triedDrugs.length} of ${criteria.stepTherapy.minTrials} required prior treatments found`;
      stepCategory.checks.push({ label: `Required trials (${criteria.stepTherapy.minTrials}+)`, passed: false });

      const missing = criteria.stepTherapy.drugs.filter(d => !priorMeds.includes(d.replace(/_/g, " ")));
      result.actionItems.push({
        priority: "HIGH",
        category: "Step Therapy",
        action: `Document trial of at least ${criteria.stepTherapy.minTrials} of: ${missing.slice(0, 3).join(", ")}`,
        impact: "+15-20% approval probability",
        detail: criteria.stepTherapy.documentationNeeded,
      });
    }

    // Check if duration is documented
    const hasDuration = /\d+\s*(week|month|day|year)/i.test(patientData.stepTherapy || "");
    if (hasDuration) {
      stepCategory.score = Math.min(stepCategory.score + 5, 30);
      stepCategory.checks.push({ label: "Treatment duration documented", passed: true });
    } else {
      stepCategory.checks.push({ label: "Treatment duration documented", passed: false });
      result.actionItems.push({
        priority: "MEDIUM",
        category: "Step Therapy",
        action: "Add specific duration for each prior treatment (e.g., 'methotrexate 15mg weekly for 6 months')",
        impact: "+5% approval probability",
      });
    }
  } else {
    stepCategory.score = 30;
    stepCategory.status = "pass";
    stepCategory.detail = "No step therapy required for this drug class";
  }

  totalPoints += stepCategory.score;
  maxPoints += stepCategory.maxScore;
  result.categories.push(stepCategory);

  // ── Category 2: Clinical Documentation (25 points) ──────────────────────
  const clinCategory = { name: "Clinical Documentation", score: 0, maxScore: 25, status: "fail", detail: "", checks: [] };

  const hasDiagnosis = !!(patientData.diagnosis && patientData.diagnosis.trim());
  const hasICD10 = !!(patientData.icd10 && patientData.icd10.trim());
  const hasMedHistory = !!(patientData.medicalHistory && patientData.medicalHistory.length > 20);
  const hasMeds = !!(patientData.currentMedications && patientData.currentMedications.length > 5);
  const hasJustification = !!(patientData.clinicalJustification && patientData.clinicalJustification.length > 20);

  if (hasDiagnosis) clinCategory.score += 5;
  if (hasICD10) clinCategory.score += 5;
  if (hasMedHistory) clinCategory.score += 5;
  if (hasMeds) clinCategory.score += 5;
  if (hasJustification) clinCategory.score += 5;

  clinCategory.checks = [
    { label: "Primary diagnosis", passed: hasDiagnosis },
    { label: "ICD-10 code", passed: hasICD10 },
    { label: "Medical history", passed: hasMedHistory },
    { label: "Current medications", passed: hasMeds },
    { label: "Clinical justification", passed: hasJustification },
  ];

  clinCategory.status = clinCategory.score >= 20 ? "pass" : clinCategory.score >= 10 ? "warning" : "fail";
  clinCategory.detail = `${clinCategory.checks.filter(c => c.passed).length} of 5 clinical elements documented`;

  if (!hasJustification) {
    result.actionItems.push({
      priority: "HIGH",
      category: "Clinical Documentation",
      action: "Add detailed clinical justification explaining why this specific treatment is medically necessary",
      impact: "+10% approval probability",
    });
  }

  if (!hasICD10) {
    result.actionItems.push({
      priority: "HIGH",
      category: "Clinical Documentation",
      action: "Add the ICD-10 diagnostic code for the primary condition",
      impact: "+5% approval probability",
    });
  }

  totalPoints += clinCategory.score;
  maxPoints += clinCategory.maxScore;
  result.categories.push(clinCategory);

  // ── Category 3: Required Labs (15 points) ───────────────────────────────
  const labCategory = { name: "Required Labs", score: 0, maxScore: 15, status: "warning", detail: "", checks: [] };

  if (criteria.requiredLabs && criteria.requiredLabs.length > 0) {
    // We can't verify labs from text alone, but we flag what's needed
    labCategory.detail = `${criteria.requiredLabs.length} lab tests required by this insurer`;
    labCategory.score = 8; // Partial credit - we assume some may be available
    labCategory.status = "warning";
    labCategory.checks = criteria.requiredLabs.map(lab => ({
      label: lab,
      passed: null, // Unknown - requires manual verification
    }));

    result.actionItems.push({
      priority: "MEDIUM",
      category: "Labs",
      action: `Ensure these labs are current and attached: ${criteria.requiredLabs.join(", ")}`,
      impact: "+7% approval probability",
    });
  } else {
    labCategory.score = 15;
    labCategory.status = "pass";
    labCategory.detail = "No specific labs required";
  }

  totalPoints += labCategory.score;
  maxPoints += labCategory.maxScore;
  result.categories.push(labCategory);

  // ── Category 4: Required Imaging (10 points) ───────────────────────────
  const imgCategory = { name: "Required Imaging", score: 0, maxScore: 10, status: "warning", detail: "", checks: [] };

  if (criteria.requiredImaging && criteria.requiredImaging.length > 0) {
    imgCategory.detail = `${criteria.requiredImaging.length} imaging study required`;
    imgCategory.score = 5;
    imgCategory.status = "warning";
    imgCategory.checks = criteria.requiredImaging.map(img => ({
      label: img,
      passed: null,
    }));

    result.actionItems.push({
      priority: "MEDIUM",
      category: "Imaging",
      action: `Ensure imaging is recent and attached: ${criteria.requiredImaging.join(", ")}`,
      impact: "+5% approval probability",
    });
  } else {
    imgCategory.score = 10;
    imgCategory.status = "pass";
    imgCategory.detail = "No specific imaging required";
  }

  totalPoints += imgCategory.score;
  maxPoints += imgCategory.maxScore;
  result.categories.push(imgCategory);

  // ── Category 5: Insurer-Specific Preparedness (20 points) ──────────────
  const insCategory = { name: "Insurer-Specific Preparedness", score: 0, maxScore: 20, status: "fail", detail: "", checks: [] };

  // Check if denial reasons are pre-addressable
  const denialReasons = criteria.commonDenialReasons || [];
  const addressableCount = denialReasons.length;
  insCategory.score = Math.min(20, Math.round((criteria.cptCodes ? 5 : 0) + (criteria.authDuration ? 5 : 0) + (criteria.placeOfService ? 5 : 0) + (criteria.monitoringSchedule ? 5 : 0)));
  insCategory.status = insCategory.score >= 15 ? "pass" : "warning";
  insCategory.detail = `Aurix has ${denialReasons.length} common denial reasons mapped for ${patientData.insurance}`;

  insCategory.checks = [
    { label: "CPT/HCPCS codes available", passed: !!(criteria.cptCodes && criteria.cptCodes.length > 0) },
    { label: "Auth duration mapped", passed: !!criteria.authDuration },
    { label: "Place of service mapped", passed: !!criteria.placeOfService },
    { label: "Monitoring schedule mapped", passed: !!criteria.monitoringSchedule },
    { label: "Denial patterns mapped", passed: denialReasons.length > 0 },
  ];

  totalPoints += insCategory.score;
  maxPoints += insCategory.maxScore;
  result.categories.push(insCategory);

  // ── Calculate final score ───────────────────────────────────────────────
  result.readinessScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  if (result.readinessScore >= 90) result.grade = "A";
  else if (result.readinessScore >= 80) result.grade = "B+";
  else if (result.readinessScore >= 70) result.grade = "B";
  else if (result.readinessScore >= 60) result.grade = "C+";
  else if (result.readinessScore >= 50) result.grade = "C";
  else if (result.readinessScore >= 40) result.grade = "D";
  else result.grade = "F";

  // Compute denial probability
  const denialProb = computeDenialProbability(
    patientData.insurance,
    drugMatch.drugClass,
    {
      hadStepTherapy: stepCategory.score >= 20,
      hadLabs: labCategory.score >= 10,
      hadImaging: imgCategory.score >= 7,
      letterScore: Math.round(result.readinessScore / 100 * 12),
    }
  );

  result.projectedApproval = Math.round((1 - denialProb.probability) * 100);

  // Calculate improvement potential
  const highItems = result.actionItems.filter(a => a.priority === "HIGH").length;
  const medItems = result.actionItems.filter(a => a.priority === "MEDIUM").length;
  result.improvementPotential = Math.min(40, highItems * 15 + medItems * 5);

  // Sort action items by priority
  result.actionItems.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.priority] || 2) - (order[b.priority] || 2);
  });

  return res.status(200).json(result);
}
