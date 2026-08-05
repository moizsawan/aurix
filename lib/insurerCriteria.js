// ═══════════════════════════════════════════════════════════════════════════════
// AURIX — Insurer Criteria Matching Engine (Stage 1)
// ═══════════════════════════════════════════════════════════════════════════════
// A deterministic rules engine that cross-references patient clinical data
// against insurer-specific PA requirements BEFORE the LLM generates anything.
// The output is a structured gap analysis that feeds into Stage 2.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DRUG CLASS TAXONOMY ──────────────────────────────────────────────────────
// Maps common drug names to their therapeutic class for criteria lookup
const DRUG_CLASS_MAP = {
  // Biologics - Rheumatology
  "humira": "biologics_rheum", "adalimumab": "biologics_rheum",
  "enbrel": "biologics_rheum", "etanercept": "biologics_rheum",
  "remicade": "biologics_rheum", "infliximab": "biologics_rheum",
  "rinvoq": "biologics_rheum", "upadacitinib": "biologics_rheum",
  "xeljanz": "biologics_rheum", "tofacitinib": "biologics_rheum",
  "orencia": "biologics_rheum", "abatacept": "biologics_rheum",
  "kevzara": "biologics_rheum", "sarilumab": "biologics_rheum",
  "actemra": "biologics_rheum", "tocilizumab": "biologics_rheum",

  // Biologics - GI
  "entyvio": "biologics_gi", "vedolizumab": "biologics_gi",
  "stelara": "biologics_gi", "ustekinumab": "biologics_gi",
  "skyrizi": "biologics_gi", "risankizumab": "biologics_gi",

  // Biologics - Dermatology
  "dupixent": "biologics_derm", "dupilumab": "biologics_derm",
  "cosentyx": "biologics_derm", "secukinumab": "biologics_derm",
  "taltz": "biologics_derm", "ixekizumab": "biologics_derm",
  "tremfya": "biologics_derm", "guselkumab": "biologics_derm",

  // Diabetes - Advanced
  "ozempic": "glp1_agonists", "semaglutide": "glp1_agonists",
  "mounjaro": "glp1_agonists", "tirzepatide": "glp1_agonists",
  "trulicity": "glp1_agonists", "dulaglutide": "glp1_agonists",
  "jardiance": "sglt2_inhibitors", "empagliflozin": "sglt2_inhibitors",
  "farxiga": "sglt2_inhibitors", "dapagliflozin": "sglt2_inhibitors",
  "invokana": "sglt2_inhibitors", "canagliflozin": "sglt2_inhibitors",

  // Oncology
  "keytruda": "immunotherapy", "pembrolizumab": "immunotherapy",
  "opdivo": "immunotherapy", "nivolumab": "immunotherapy",
  "tecentriq": "immunotherapy", "atezolizumab": "immunotherapy",
  "yescarta": "car_t", "kymriah": "car_t",

  // Cardiology
  "entresto": "cardiology_specialty", "sacubitril_valsartan": "cardiology_specialty",
  "mavacamten": "cardiology_specialty", "camzyos": "cardiology_specialty",
  "eliquis": "anticoagulants", "apixaban": "anticoagulants",
  "xarelto": "anticoagulants", "rivaroxaban": "anticoagulants",

  // Neurology
  "aimovig": "cgrp_inhibitors", "erenumab": "cgrp_inhibitors",
  "ajovy": "cgrp_inhibitors", "fremanezumab": "cgrp_inhibitors",
  "emgality": "cgrp_inhibitors", "galcanezumab": "cgrp_inhibitors",
  "nurtec": "cgrp_inhibitors", "rimegepant": "cgrp_inhibitors",
  "tecfidera": "ms_therapies", "dimethyl_fumarate": "ms_therapies",
  "ocrevus": "ms_therapies", "ocrelizumab": "ms_therapies",
  "tysabri": "ms_therapies", "natalizumab": "ms_therapies",
  "kesimpta": "ms_therapies", "ofatumumab": "ms_therapies",

  // Psychiatry
  "spravato": "psych_specialty", "esketamine": "psych_specialty",
  "clozapine": "psych_specialty", "clozaril": "psych_specialty",

  // Orthopedic
  "synvisc": "viscosupplementation", "euflexxa": "viscosupplementation",
  "hyalgan": "viscosupplementation",

  // Pulmonology
  "nucala": "biologics_pulm", "mepolizumab": "biologics_pulm",
  "fasenra": "biologics_pulm", "benralizumab": "biologics_pulm",
  "xolair": "biologics_pulm", "omalizumab": "biologics_pulm",
  "tezspire": "biologics_pulm", "tezepelumab": "biologics_pulm",
  "dupixent_asthma": "biologics_pulm",
};

// ─── INSURER-SPECIFIC CRITERIA DATABASE ───────────────────────────────────────
const INSURER_CRITERIA = {
  "UnitedHealthcare": {
    biologics_rheum: {
      stepTherapy: {
        required: true,
        drugs: ["methotrexate", "hydroxychloroquine", "sulfasalazine", "leflunomide"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Chart notes showing dates of initiation, dose titration, and documented inadequate response or adverse effects"
      },
      requiredLabs: ["Anti-CCP antibody", "Rheumatoid Factor (RF)", "ESR", "CRP", "CBC", "LFTs", "Hepatitis B/C screening"],
      requiredImaging: ["X-rays of affected joints within 12 months"],
      cptCodes: ["J0135 (adalimumab)", "J1745 (infliximab)", "J3357 (upadacitinib)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Specialty pharmacy (SC) or office-based infusion (IV)",
      monitoringSchedule: "CBC every 4 weeks x3, then every 12 weeks. LFTs every 8 weeks. TB screening annually.",
      costAvoidance: "Delayed biologic initiation in active RA results in average $14,800/year in ER visits, hospitalizations, and joint replacement surgeries",
      commonDenialReasons: [
        "Insufficient step therapy documentation",
        "Missing lab results (especially hepatitis screening)",
        "No documented DAS28 or CDAI score",
        "Failure to demonstrate radiographic progression"
      ]
    },
    biologics_gi: {
      stepTherapy: {
        required: true,
        drugs: ["mesalamine", "budesonide", "prednisone", "azathioprine", "6-mercaptopurine", "methotrexate"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Documented failure of conventional therapy with endoscopic evidence of active disease"
      },
      requiredLabs: ["CBC", "CMP", "CRP", "Fecal calprotectin", "TB screening", "Hepatitis B/C screening"],
      requiredImaging: ["Colonoscopy or CT enterography within 12 months"],
      cptCodes: ["J3380 (vedolizumab)", "J3357 (ustekinumab)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Office-based infusion center or specialty pharmacy",
      monitoringSchedule: "CBC and LFTs every 8 weeks. CRP and fecal calprotectin every 3 months.",
      costAvoidance: "Uncontrolled Crohn's disease leads to average $28,000/year in hospitalization costs. Timely biologic initiation reduces surgical resection rates by 50%",
      commonDenialReasons: [
        "No recent endoscopic documentation",
        "Insufficient conventional therapy trials",
        "Missing TB screening",
        "No documented Harvey-Bradshaw Index or CDAI score"
      ]
    },
    glp1_agonists: {
      stepTherapy: {
        required: true,
        drugs: ["metformin", "sulfonylurea", "pioglitazone"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "HbA1c above target despite maximally tolerated doses of first-line agents"
      },
      requiredLabs: ["HbA1c within 3 months", "Fasting glucose", "eGFR", "Lipid panel"],
      requiredImaging: [],
      cptCodes: ["J3490 (semaglutide)", "J3491 (tirzepatide)"],
      authDuration: "12 months",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "HbA1c every 3 months. Renal function every 6 months.",
      costAvoidance: "Uncontrolled T2DM costs $9,600/year in complications. GLP-1 RA reduce cardiovascular events by 14% and hospitalization for heart failure by 35%",
      commonDenialReasons: [
        "HbA1c not sufficiently elevated (varies by plan, typically >7%)",
        "Insufficient metformin trial duration",
        "BMI requirements not met for weight-indication",
        "Preferred agent on formulary not tried first"
      ]
    },
    immunotherapy: {
      stepTherapy: { required: false, drugs: [], minTrials: 0, minDurationWeeks: 0, documentationNeeded: "NCCN guideline-concordant treatment" },
      requiredLabs: ["PD-L1 expression (TPS or CPS)", "MSI/MMR status", "TMB if applicable", "CBC", "CMP", "LDH", "TSH"],
      requiredImaging: ["CT or PET scan within 30 days confirming measurable disease"],
      cptCodes: ["J9271 (pembrolizumab)", "J9299 (nivolumab)"],
      authDuration: "3 months initial, then per NCCN guidelines",
      placeOfService: "Hospital outpatient infusion center",
      monitoringSchedule: "CBC and CMP before each cycle. TSH every 6 weeks. CT restaging every 9-12 weeks.",
      costAvoidance: "Delayed immunotherapy initiation in eligible patients associated with 15% reduction in overall survival per month of delay",
      commonDenialReasons: [
        "Missing PD-L1 or biomarker testing",
        "Treatment not concordant with NCCN guidelines",
        "No pathology report confirming histologic diagnosis",
        "Missing staging workup"
      ]
    },
    cgrp_inhibitors: {
      stepTherapy: {
        required: true,
        drugs: ["topiramate", "propranolol", "amitriptyline", "venlafaxine", "valproate"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Documented failure or intolerance of at least 2 preventive medications from different classes"
      },
      requiredLabs: [],
      requiredImaging: [],
      cptCodes: ["J3032 (erenumab)", "J3031 (fremanezumab)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "Headache diary review every 3 months. Assess 50% responder rate at 3 months.",
      costAvoidance: "Chronic migraine costs $8,500/year in lost productivity and ER visits. CGRP inhibitors reduce monthly migraine days by 50% in 60% of patients",
      commonDenialReasons: [
        "Insufficient preventive medication trials",
        "No headache diary documenting frequency",
        "Episodic migraine (less than 15 days/month) for some plans",
        "Preferred CGRP agent not tried first"
      ]
    },
    viscosupplementation: {
      stepTherapy: {
        required: true,
        drugs: ["acetaminophen", "NSAIDs", "corticosteroid_injection", "physical_therapy"],
        minTrials: 3,
        minDurationWeeks: 6,
        documentationNeeded: "Failed conservative management including PT and at least one intra-articular corticosteroid injection"
      },
      requiredLabs: [],
      requiredImaging: ["Weight-bearing knee X-rays showing Kellgren-Lawrence Grade 2-4"],
      cptCodes: ["J7325 (Synvisc)", "J7323 (Euflexxa)"],
      authDuration: "Single treatment course (3-5 injections)",
      placeOfService: "Office-based procedure",
      monitoringSchedule: "Follow-up at 4 weeks post-completion. Reassess at 6 months.",
      costAvoidance: "Viscosupplementation can delay total knee arthroplasty by 2-3 years, avoiding $35,000-$50,000 surgical cost",
      commonDenialReasons: [
        "No documented corticosteroid injection trial",
        "No documented physical therapy course",
        "Imaging not showing sufficient OA severity",
        "Medicare: specific brand restrictions apply"
      ]
    },
    ms_therapies: {
      stepTherapy: {
        required: true,
        drugs: ["interferon_beta", "glatiramer_acetate", "dimethyl_fumarate", "teriflunomide"],
        minTrials: 1,
        minDurationWeeks: 24,
        documentationNeeded: "Documented breakthrough disease activity on first-line DMT or high-efficacy initial therapy for aggressive presentation"
      },
      requiredLabs: ["CBC", "LFTs", "JC virus antibody index", "Hepatitis B/C screening", "Varicella titer"],
      requiredImaging: ["Brain MRI with and without contrast within 3 months"],
      cptCodes: ["J2323 (natalizumab)", "J2350 (ocrelizumab)"],
      authDuration: "12 months",
      placeOfService: "Hospital outpatient or office-based infusion center",
      monitoringSchedule: "CBC every 3 months. LFTs every 3 months. JCV antibody every 6 months (natalizumab). MRI every 6-12 months.",
      costAvoidance: "MS relapse costs average $18,000 per event. High-efficacy DMTs reduce annualized relapse rate by 50-70%",
      commonDenialReasons: [
        "No documented MRI showing disease activity",
        "Insufficient first-line DMT trial",
        "Missing JCV antibody for natalizumab",
        "No documented EDSS score"
      ]
    },
    psych_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["SSRI", "SNRI", "bupropion", "mirtazapine", "augmentation_with_antipsychotic"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Documented treatment-resistant depression: failure of at least 2 adequate antidepressant trials in current episode"
      },
      requiredLabs: ["UDS (for esketamine)", "Pregnancy test", "BP monitoring protocol"],
      requiredImaging: [],
      cptCodes: ["J3490 (esketamine nasal spray)"],
      authDuration: "6 months, with reauthorization based on documented response",
      placeOfService: "REMS-certified healthcare facility (in-office administration with 2-hour monitoring)",
      monitoringSchedule: "PHQ-9 at each session. Blood pressure monitoring pre- and post-dose. REMS compliance documentation.",
      costAvoidance: "Treatment-resistant depression costs $25,000/year in healthcare utilization and lost productivity. Esketamine achieves remission in 27% of TRD patients",
      commonDenialReasons: [
        "Insufficient prior antidepressant trials",
        "No PHQ-9 or HAM-D documenting severity",
        "REMS certification not confirmed",
        "No documentation of current major depressive episode"
      ]
    },
    cardiology_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["ACE_inhibitor_or_ARB", "beta_blocker", "diuretic", "MRA"],
        minTrials: 1,
        minDurationWeeks: 4,
        documentationNeeded: "Documented LVEF and current NYHA functional class with maximally tolerated GDMT"
      },
      requiredLabs: ["BNP or NT-proBNP", "eGFR", "Potassium", "LFTs"],
      requiredImaging: ["Echocardiogram within 6 months showing LVEF"],
      cptCodes: ["J3490 (sacubitril/valsartan)"],
      authDuration: "12 months",
      placeOfService: "Outpatient pharmacy",
      monitoringSchedule: "Renal function and potassium at 1-2 weeks after initiation, then every 3 months. BP monitoring.",
      costAvoidance: "HFrEF hospitalization costs $15,000-$25,000 per admission. Sacubitril/valsartan reduces HF hospitalization by 21%",
      commonDenialReasons: [
        "No documented LVEF",
        "ACE/ARB not tried first",
        "Missing renal function labs",
        "NYHA class not documented"
      ]
    },
    biologics_pulm: {
      stepTherapy: {
        required: true,
        drugs: ["ICS_high_dose", "LABA", "LAMA", "LTRA", "oral_corticosteroids"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Uncontrolled severe asthma despite high-dose ICS/LABA with documented exacerbations"
      },
      requiredLabs: ["IgE level (omalizumab)", "Eosinophil count", "FeNO if available"],
      requiredImaging: ["Chest X-ray or CT if diagnostic uncertainty"],
      cptCodes: ["J2182 (mepolizumab)", "J0517 (benralizumab)", "J2357 (omalizumab)"],
      authDuration: "12 months",
      placeOfService: "Office-based administration or specialty pharmacy (self-inject)",
      monitoringSchedule: "Spirometry every 3-6 months. ACT score at each visit. Exacerbation frequency tracking.",
      costAvoidance: "Severe asthma exacerbation requiring hospitalization costs $12,000-$20,000. Biologics reduce exacerbations by 50-70%",
      commonDenialReasons: [
        "Eosinophil count not meeting threshold",
        "Insufficient ICS/LABA optimization",
        "No documented exacerbation history",
        "Spirometry not showing obstruction"
      ]
    },
    biologics_derm: {
      stepTherapy: {
        required: true,
        drugs: ["topical_corticosteroids", "topical_calcineurin_inhibitors", "phototherapy", "methotrexate", "cyclosporine"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Moderate-to-severe disease (BSA >10% or PASI >10) with documented failure of conventional therapies"
      },
      requiredLabs: ["CBC", "CMP", "TB screening", "Hepatitis B/C"],
      requiredImaging: [],
      cptCodes: ["J3358 (dupilumab)", "J3590 (secukinumab)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "PASI/BSA assessment every 3 months. CBC annually.",
      costAvoidance: "Uncontrolled psoriasis/eczema results in $8,000/year in productivity loss and $5,000/year in healthcare costs",
      commonDenialReasons: [
        "BSA or PASI not documented",
        "Insufficient topical therapy trial",
        "Missing TB screening",
        "Preferred biologic not tried first"
      ]
    }
  },

  // ─── AETNA ────────────────────────────────────────────────────────────────────
  "Aetna": {
    biologics_rheum: {
      stepTherapy: {
        required: true,
        drugs: ["methotrexate", "leflunomide", "hydroxychloroquine"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "Documented inadequate response to methotrexate at maximum tolerated dose for at least 3 months"
      },
      requiredLabs: ["RF", "Anti-CCP", "ESR", "CRP", "CBC", "LFTs", "TB screening", "Hepatitis B surface antigen"],
      requiredImaging: ["X-rays of affected joints"],
      cptCodes: ["J0135 (adalimumab)", "J1745 (infliximab)", "J3357 (upadacitinib)"],
      authDuration: "12 months",
      placeOfService: "Specialty pharmacy or office-based infusion",
      monitoringSchedule: "CBC and LFTs every 3 months. Disease activity assessment every 6 months.",
      costAvoidance: "Delayed biologic initiation in active RA results in average $14,800/year in complications",
      commonDenialReasons: [
        "Preferred biosimilar not tried first",
        "Methotrexate trial insufficient duration",
        "Missing hepatitis B screening",
        "No disease activity score documented"
      ]
    },
    biologics_gi: {
      stepTherapy: {
        required: true,
        drugs: ["mesalamine", "budesonide", "prednisone", "immunomodulator"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Active disease confirmed by endoscopy with failure of conventional therapy"
      },
      requiredLabs: ["CBC", "CRP", "Fecal calprotectin", "TB screening", "Hepatitis panel"],
      requiredImaging: ["Colonoscopy or imaging within 12 months"],
      cptCodes: ["J3380 (vedolizumab)", "J3357 (ustekinumab)"],
      authDuration: "6 months initial, then 12 months",
      placeOfService: "Office-based infusion or specialty pharmacy",
      monitoringSchedule: "CBC and CRP every 3 months. Endoscopic reassessment per clinical judgment.",
      costAvoidance: "Hospitalization for Crohn's flare costs $15,000-$28,000. Biologic therapy reduces surgical rates by 50%",
      commonDenialReasons: [
        "Preferred TNF inhibitor not tried first",
        "No recent endoscopic confirmation",
        "Immunomodulator trial too short",
        "Missing TB screening"
      ]
    },
    glp1_agonists: {
      stepTherapy: {
        required: true,
        drugs: ["metformin", "sulfonylurea"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "HbA1c >7% despite metformin at maximum tolerated dose"
      },
      requiredLabs: ["HbA1c within 3 months", "eGFR", "Lipid panel"],
      requiredImaging: [],
      cptCodes: ["J3490 (semaglutide)", "J3491 (tirzepatide)"],
      authDuration: "12 months",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "HbA1c every 3 months. Renal function annually.",
      costAvoidance: "GLP-1 RAs reduce major cardiovascular events by 14% and all-cause mortality in T2DM patients with established CVD",
      commonDenialReasons: [
        "HbA1c below plan threshold",
        "Preferred GLP-1 not tried first",
        "Metformin contraindication not documented",
        "Weight management indication requires separate criteria"
      ]
    },
    cgrp_inhibitors: {
      stepTherapy: {
        required: true,
        drugs: ["topiramate", "propranolol", "amitriptyline", "venlafaxine"],
        minTrials: 2,
        minDurationWeeks: 6,
        documentationNeeded: "At least 4 migraine days/month with failure of 2+ preventive medications"
      },
      requiredLabs: [],
      requiredImaging: [],
      cptCodes: ["J3032 (erenumab)", "J3031 (fremanezumab)"],
      authDuration: "6 months",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "Monthly migraine day assessment. 50% responder rate evaluation at 3 months.",
      costAvoidance: "Chronic migraine costs $8,500/year in lost productivity and ER visits",
      commonDenialReasons: [
        "Fewer than 4 migraine days/month documented",
        "Only 1 preventive medication tried",
        "No headache diary",
        "Preferred CGRP not tried"
      ]
    },
    viscosupplementation: {
      stepTherapy: {
        required: true,
        drugs: ["acetaminophen", "NSAIDs", "physical_therapy", "corticosteroid_injection"],
        minTrials: 3,
        minDurationWeeks: 6,
        documentationNeeded: "Kellgren-Lawrence Grade 2+ with failed conservative management"
      },
      requiredLabs: [],
      requiredImaging: ["Weight-bearing knee X-rays"],
      cptCodes: ["J7325 (Synvisc)", "J7323 (Euflexxa)"],
      authDuration: "Single course",
      placeOfService: "Office-based procedure",
      monitoringSchedule: "Follow-up at 4-6 weeks post-completion.",
      costAvoidance: "Delays TKA by 2-3 years, avoiding $35,000-$50,000 surgical cost",
      commonDenialReasons: [
        "No documented PT course",
        "No corticosteroid injection documented",
        "X-ray not weight-bearing",
        "Previous viscosupplementation failed (some plans limit repeats)"
      ]
    },
    immunotherapy: {
      stepTherapy: { required: false, drugs: [], minTrials: 0, minDurationWeeks: 0, documentationNeeded: "NCCN guideline-concordant" },
      requiredLabs: ["PD-L1", "MSI/MMR", "CBC", "CMP", "TSH", "LDH"],
      requiredImaging: ["CT or PET within 30 days"],
      cptCodes: ["J9271 (pembrolizumab)", "J9299 (nivolumab)"],
      authDuration: "3 months, renewable",
      placeOfService: "Hospital outpatient infusion center",
      monitoringSchedule: "CBC/CMP before each cycle. TSH every 6 weeks. Restaging every 9-12 weeks.",
      costAvoidance: "Each month of immunotherapy delay associated with 15% OS reduction",
      commonDenialReasons: ["Missing biomarker testing", "Non-NCCN indication", "Missing pathology", "Incomplete staging"]
    },
    ms_therapies: {
      stepTherapy: {
        required: true,
        drugs: ["interferon_beta", "glatiramer_acetate", "dimethyl_fumarate"],
        minTrials: 1,
        minDurationWeeks: 24,
        documentationNeeded: "Breakthrough disease activity or high-efficacy initial therapy for aggressive MS"
      },
      requiredLabs: ["CBC", "LFTs", "JCV antibody", "Hepatitis panel", "Varicella titer"],
      requiredImaging: ["Brain MRI within 3 months"],
      cptCodes: ["J2323 (natalizumab)", "J2350 (ocrelizumab)"],
      authDuration: "12 months",
      placeOfService: "Infusion center",
      monitoringSchedule: "CBC every 3 months. JCV every 6 months. MRI every 12 months.",
      costAvoidance: "MS relapse hospitalization costs $18,000. High-efficacy DMTs reduce ARR by 50-70%",
      commonDenialReasons: ["No MRI evidence", "First-line DMT not tried", "Missing JCV antibody", "EDSS not documented"]
    },
    psych_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["SSRI", "SNRI", "bupropion", "mirtazapine"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Treatment-resistant depression with 2+ adequate antidepressant trials failed"
      },
      requiredLabs: ["UDS", "Pregnancy test"],
      requiredImaging: [],
      cptCodes: ["J3490 (esketamine)"],
      authDuration: "6 months",
      placeOfService: "REMS-certified facility",
      monitoringSchedule: "PHQ-9 at each session. BP monitoring. REMS documentation.",
      costAvoidance: "TRD costs $25,000/year. Esketamine achieves remission in 27% of TRD patients",
      commonDenialReasons: ["Insufficient AD trials", "No severity documentation", "REMS not confirmed", "No current MDE documented"]
    },
    cardiology_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["ACE_inhibitor_or_ARB", "beta_blocker", "diuretic"],
        minTrials: 1,
        minDurationWeeks: 4,
        documentationNeeded: "LVEF documented with NYHA class on maximally tolerated GDMT"
      },
      requiredLabs: ["BNP/NT-proBNP", "eGFR", "Potassium"],
      requiredImaging: ["Echocardiogram within 6 months"],
      cptCodes: ["J3490 (sacubitril/valsartan)"],
      authDuration: "12 months",
      placeOfService: "Outpatient pharmacy",
      monitoringSchedule: "Renal function and potassium at 1-2 weeks, then every 3 months.",
      costAvoidance: "HF hospitalization costs $15,000-$25,000. ARNI reduces HF hospitalization by 21%",
      commonDenialReasons: ["No LVEF documented", "ACE/ARB not tried", "Missing renal labs", "NYHA class missing"]
    },
    biologics_pulm: {
      stepTherapy: {
        required: true,
        drugs: ["ICS_high_dose", "LABA", "LAMA", "LTRA"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Uncontrolled severe asthma despite optimized ICS/LABA"
      },
      requiredLabs: ["Eosinophil count", "IgE level", "FeNO"],
      requiredImaging: [],
      cptCodes: ["J2182 (mepolizumab)", "J0517 (benralizumab)", "J2357 (omalizumab)"],
      authDuration: "12 months",
      placeOfService: "Office-based or specialty pharmacy",
      monitoringSchedule: "Spirometry every 6 months. ACT score each visit.",
      costAvoidance: "Severe asthma exacerbation hospitalization costs $12,000-$20,000. Biologics reduce exacerbations by 50-70%",
      commonDenialReasons: ["Eosinophil count below threshold", "ICS/LABA not optimized", "No exacerbation history documented", "Preferred biologic not tried"]
    },
    biologics_derm: {
      stepTherapy: {
        required: true,
        drugs: ["topical_corticosteroids", "phototherapy", "methotrexate"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "BSA >10% or PASI >10 with failed conventional therapy"
      },
      requiredLabs: ["CBC", "CMP", "TB screening", "Hepatitis panel"],
      requiredImaging: [],
      cptCodes: ["J3358 (dupilumab)", "J3590 (secukinumab)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Specialty pharmacy, self-administered",
      monitoringSchedule: "PASI/BSA every 3 months.",
      costAvoidance: "Uncontrolled psoriasis: $8,000/year productivity loss, $5,000/year healthcare costs",
      commonDenialReasons: ["BSA/PASI not documented", "Insufficient topical trial", "Missing TB", "Preferred biologic not tried"]
    }
  },

  // ─── BLUECROSS BLUESHIELD ─────────────────────────────────────────────────────
  "BlueCross BlueShield": {
    biologics_rheum: {
      stepTherapy: {
        required: true,
        drugs: ["methotrexate", "hydroxychloroquine", "sulfasalazine"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "Inadequate response to csDMARD with documented disease activity"
      },
      requiredLabs: ["RF", "Anti-CCP", "ESR", "CRP", "CBC", "LFTs", "TB", "Hepatitis B/C"],
      requiredImaging: ["Baseline joint X-rays"],
      cptCodes: ["J0135 (adalimumab)", "J1745 (infliximab)"],
      authDuration: "6 months initial, 12 months renewal",
      placeOfService: "Specialty pharmacy or infusion center",
      monitoringSchedule: "CBC/LFTs every 3 months. Disease activity every 6 months.",
      costAvoidance: "Delayed biologics: $14,800/year in RA complications",
      commonDenialReasons: ["Biosimilar preferred", "csDMARD trial too short", "Missing TB", "No DAS28"]
    },
    biologics_gi: {
      stepTherapy: {
        required: true,
        drugs: ["mesalamine", "corticosteroids", "immunomodulator"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Endoscopic evidence of active IBD with failed conventional therapy"
      },
      requiredLabs: ["CBC", "CRP", "Fecal calprotectin", "TB", "Hepatitis panel"],
      requiredImaging: ["Colonoscopy within 12 months"],
      cptCodes: ["J3380 (vedolizumab)", "J3357 (ustekinumab)"],
      authDuration: "6 months",
      placeOfService: "Infusion center or specialty pharmacy",
      monitoringSchedule: "CBC/CRP every 3 months.",
      costAvoidance: "Crohn's hospitalization: $15,000-$28,000. Biologics reduce surgery by 50%",
      commonDenialReasons: ["TNF inhibitor preferred first", "No endoscopy", "Missing TB", "Short immunomod trial"]
    },
    glp1_agonists: {
      stepTherapy: {
        required: true,
        drugs: ["metformin"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "HbA1c above target on metformin"
      },
      requiredLabs: ["HbA1c", "eGFR"],
      requiredImaging: [],
      cptCodes: ["J3490 (semaglutide)"],
      authDuration: "12 months",
      placeOfService: "Specialty pharmacy",
      monitoringSchedule: "HbA1c every 3 months.",
      costAvoidance: "T2DM complications: $9,600/year. GLP-1 RAs reduce CV events by 14%",
      commonDenialReasons: ["HbA1c not high enough", "Preferred agent not tried", "Metformin not maximized"]
    },
    immunotherapy: {
      stepTherapy: { required: false, drugs: [], minTrials: 0, minDurationWeeks: 0, documentationNeeded: "NCCN-concordant" },
      requiredLabs: ["PD-L1", "MSI/MMR", "CBC", "CMP", "TSH"],
      requiredImaging: ["CT/PET within 30 days"],
      cptCodes: ["J9271 (pembrolizumab)"],
      authDuration: "3 months",
      placeOfService: "Hospital outpatient",
      monitoringSchedule: "CBC/CMP each cycle. TSH every 6 weeks. Restaging every 9-12 weeks.",
      costAvoidance: "Delayed immunotherapy: 15% OS reduction per month",
      commonDenialReasons: ["Missing PD-L1", "Non-NCCN", "Missing pathology", "Staging incomplete"]
    },
    cgrp_inhibitors: {
      stepTherapy: {
        required: true,
        drugs: ["topiramate", "propranolol", "amitriptyline"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "4+ migraine days/month with 2+ preventive failures"
      },
      requiredLabs: [],
      requiredImaging: [],
      cptCodes: ["J3032 (erenumab)"],
      authDuration: "6 months",
      placeOfService: "Specialty pharmacy",
      monitoringSchedule: "Monthly migraine days. 50% responder evaluation at 3 months.",
      costAvoidance: "Chronic migraine: $8,500/year in lost productivity",
      commonDenialReasons: ["<4 migraine days/month", "Only 1 preventive tried", "No headache diary"]
    },
    viscosupplementation: {
      stepTherapy: {
        required: true,
        drugs: ["NSAIDs", "physical_therapy", "corticosteroid_injection"],
        minTrials: 3,
        minDurationWeeks: 6,
        documentationNeeded: "KL Grade 2+ with failed conservative treatment"
      },
      requiredLabs: [],
      requiredImaging: ["Weight-bearing knee X-rays"],
      cptCodes: ["J7325 (Synvisc)"],
      authDuration: "Single course",
      placeOfService: "Office-based",
      monitoringSchedule: "Follow-up at 4-6 weeks.",
      costAvoidance: "Delays TKA 2-3 years ($35-50K)",
      commonDenialReasons: ["No PT documented", "No steroid injection", "X-ray not weight-bearing"]
    },
    ms_therapies: {
      stepTherapy: {
        required: true,
        drugs: ["interferon_beta", "glatiramer_acetate"],
        minTrials: 1,
        minDurationWeeks: 24,
        documentationNeeded: "Breakthrough disease or aggressive presentation"
      },
      requiredLabs: ["CBC", "LFTs", "JCV antibody", "Hepatitis panel"],
      requiredImaging: ["Brain MRI within 3 months"],
      cptCodes: ["J2350 (ocrelizumab)"],
      authDuration: "12 months",
      placeOfService: "Infusion center",
      monitoringSchedule: "CBC every 3 months. MRI every 12 months.",
      costAvoidance: "MS relapse: $18,000. High-efficacy DMTs reduce ARR by 50-70%",
      commonDenialReasons: ["No MRI evidence", "First-line not tried", "Missing JCV", "EDSS not documented"]
    },
    psych_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["SSRI", "SNRI", "bupropion"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "TRD with 2+ adequate AD trials failed"
      },
      requiredLabs: ["UDS", "Pregnancy test"],
      requiredImaging: [],
      cptCodes: ["J3490 (esketamine)"],
      authDuration: "6 months",
      placeOfService: "REMS-certified facility",
      monitoringSchedule: "PHQ-9 each session. BP monitoring.",
      costAvoidance: "TRD: $25,000/year. Esketamine remission rate: 27%",
      commonDenialReasons: ["Insufficient AD trials", "No PHQ-9", "REMS not confirmed"]
    },
    cardiology_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["ACE_inhibitor_or_ARB", "beta_blocker"],
        minTrials: 1,
        minDurationWeeks: 4,
        documentationNeeded: "LVEF + NYHA on max tolerated GDMT"
      },
      requiredLabs: ["BNP", "eGFR", "Potassium"],
      requiredImaging: ["Echo within 6 months"],
      cptCodes: ["J3490 (sacubitril/valsartan)"],
      authDuration: "12 months",
      placeOfService: "Outpatient pharmacy",
      monitoringSchedule: "Renal/K+ at 1-2 weeks then every 3 months.",
      costAvoidance: "HF hospitalization: $15-25K. ARNI reduces HF hospitalization by 21%",
      commonDenialReasons: ["No LVEF", "ACE/ARB not tried", "Missing renal labs"]
    },
    biologics_pulm: {
      stepTherapy: {
        required: true,
        drugs: ["ICS_high_dose", "LABA", "LAMA"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Severe uncontrolled asthma on optimized ICS/LABA"
      },
      requiredLabs: ["Eosinophil count", "IgE"],
      requiredImaging: [],
      cptCodes: ["J2182 (mepolizumab)", "J2357 (omalizumab)"],
      authDuration: "12 months",
      placeOfService: "Office-based or specialty pharmacy",
      monitoringSchedule: "Spirometry every 6 months. ACT each visit.",
      costAvoidance: "Severe exacerbation: $12-20K. Biologics reduce exacerbations 50-70%",
      commonDenialReasons: ["Low eosinophils", "ICS/LABA not optimized", "No exacerbation history"]
    },
    biologics_derm: {
      stepTherapy: {
        required: true,
        drugs: ["topical_corticosteroids", "phototherapy", "methotrexate"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "BSA >10% or PASI >10 with failed conventional therapy"
      },
      requiredLabs: ["CBC", "TB screening"],
      requiredImaging: [],
      cptCodes: ["J3358 (dupilumab)"],
      authDuration: "6 months initial",
      placeOfService: "Specialty pharmacy",
      monitoringSchedule: "PASI/BSA every 3 months.",
      costAvoidance: "Uncontrolled psoriasis: $13K/year total costs",
      commonDenialReasons: ["BSA/PASI not documented", "Topical trial insufficient", "Missing TB"]
    }
  },

  // ─── CIGNA ────────────────────────────────────────────────────────────────────
  "Cigna": {
    biologics_rheum: {
      stepTherapy: {
        required: true,
        drugs: ["methotrexate", "sulfasalazine", "leflunomide", "hydroxychloroquine"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Chart notes documenting trial and inadequate response or intolerance to at least two conventional DMARDs, one of which is methotrexate at the maximum tolerated dose unless contraindicated"
      },
      requiredLabs: ["RF", "Anti-CCP", "ESR", "CRP", "CBC", "CMP", "TB screening (QuantiFERON or PPD)", "Hepatitis B and C serologies"],
      requiredImaging: ["Radiographs of affected joints within 12 months"],
      cptCodes: ["J0135 (adalimumab)", "J1745 (infliximab)", "J3357 (upadacitinib)"],
      authDuration: "6 months initial, 12 months reauthorization with documented response",
      placeOfService: "Cigna preferred specialty pharmacy (Accredo) or office/home infusion",
      monitoringSchedule: "CBC and LFTs every 3 months. DAS28 or CDAI documented at reauthorization.",
      costAvoidance: "Delayed control of active RA drives an estimated $14,800/year in avoidable ER visits, hospitalizations, and joint surgeries",
      commonDenialReasons: [
        "Preferred adalimumab biosimilar not tried first",
        "Fewer than two conventional DMARD trials documented",
        "Missing hepatitis or TB screening",
        "No baseline disease activity score (DAS28 or CDAI)"
      ]
    },
    biologics_gi: {
      stepTherapy: {
        required: true,
        drugs: ["mesalamine", "budesonide", "corticosteroids", "azathioprine", "6-mercaptopurine", "methotrexate"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Endoscopic confirmation of active disease with documented failure of a conventional agent and a preferred TNF inhibitor unless contraindicated"
      },
      requiredLabs: ["CBC", "CMP", "CRP", "Fecal calprotectin", "TB screening", "Hepatitis B and C serologies"],
      requiredImaging: ["Colonoscopy or CT/MR enterography within 12 months"],
      cptCodes: ["J3380 (vedolizumab)", "J3357 (ustekinumab)"],
      authDuration: "6 months initial, 12 months reauthorization",
      placeOfService: "Office-based infusion or Accredo specialty pharmacy",
      monitoringSchedule: "CBC and CRP every 3 months. Fecal calprotectin and endoscopic reassessment per clinical judgment.",
      costAvoidance: "Uncontrolled IBD leads to $15,000-$28,000/year in hospitalization; timely biologic therapy reduces surgical resection rates by roughly 50%",
      commonDenialReasons: [
        "Preferred TNF inhibitor not tried first",
        "No recent endoscopic documentation",
        "Insufficient conventional therapy trial",
        "Missing TB screening"
      ]
    },
    glp1_agonists: {
      stepTherapy: {
        required: true,
        drugs: ["metformin", "sulfonylurea", "sglt2_inhibitor"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "HbA1c above target despite metformin at the maximum tolerated dose; weight-loss indication requires separate criteria"
      },
      requiredLabs: ["HbA1c within 3 months", "eGFR", "Lipid panel"],
      requiredImaging: [],
      cptCodes: ["J3490 (semaglutide)", "J3491 (tirzepatide)"],
      authDuration: "12 months",
      placeOfService: "Accredo specialty pharmacy, self-administered",
      monitoringSchedule: "HbA1c every 3 months. Renal function every 6 months.",
      costAvoidance: "Uncontrolled T2DM costs about $9,600/year in complications; GLP-1 RAs reduce major cardiovascular events by roughly 14%",
      commonDenialReasons: [
        "HbA1c not above the plan threshold",
        "Preferred GLP-1 agent on formulary not tried first",
        "Metformin trial insufficient or contraindication not documented",
        "Weight-management indication billed without meeting BMI criteria"
      ]
    },
    immunotherapy: {
      stepTherapy: { required: false, drugs: [], minTrials: 0, minDurationWeeks: 0, documentationNeeded: "NCCN guideline-concordant treatment" },
      requiredLabs: ["PD-L1 expression (TPS or CPS)", "MSI/MMR status", "TMB if applicable", "CBC", "CMP", "LDH", "TSH"],
      requiredImaging: ["CT or PET within 30 days confirming measurable disease"],
      cptCodes: ["J9271 (pembrolizumab)", "J9299 (nivolumab)"],
      authDuration: "3 months initial, then per NCCN guidelines",
      placeOfService: "Hospital outpatient infusion center",
      monitoringSchedule: "CBC and CMP before each cycle. TSH every 6 weeks. CT restaging every 9-12 weeks.",
      costAvoidance: "Each month of delayed immunotherapy in eligible patients is associated with roughly a 15% reduction in overall survival",
      commonDenialReasons: [
        "Missing PD-L1 or biomarker testing",
        "Treatment not concordant with NCCN guidelines",
        "No pathology report confirming histologic diagnosis",
        "Incomplete staging workup"
      ]
    },
    cgrp_inhibitors: {
      stepTherapy: {
        required: true,
        drugs: ["topiramate", "propranolol", "amitriptyline", "venlafaxine", "valproate"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "At least 4 migraine days per month with documented failure or intolerance of two preventive medications from different classes"
      },
      requiredLabs: [],
      requiredImaging: [],
      cptCodes: ["J3032 (erenumab)", "J3031 (fremanezumab)"],
      authDuration: "6 months initial, 12 months reauthorization based on response",
      placeOfService: "Accredo specialty pharmacy, self-administered",
      monitoringSchedule: "Headache diary review every 3 months. Assess 50% responder rate at 3 months.",
      costAvoidance: "Chronic migraine costs about $8,500/year in lost productivity and ER visits; CGRP inhibitors halve monthly migraine days in a majority of responders",
      commonDenialReasons: [
        "Fewer than two preventive medication trials",
        "No headache diary documenting frequency",
        "Fewer than 4 migraine days per month documented",
        "Preferred CGRP agent not tried first"
      ]
    },
    viscosupplementation: {
      stepTherapy: {
        required: true,
        drugs: ["acetaminophen", "NSAIDs", "corticosteroid_injection", "physical_therapy"],
        minTrials: 3,
        minDurationWeeks: 6,
        documentationNeeded: "Failed conservative management including physical therapy and at least one intra-articular corticosteroid injection"
      },
      requiredLabs: [],
      requiredImaging: ["Weight-bearing knee radiographs showing Kellgren-Lawrence Grade 2-4"],
      cptCodes: ["J7325 (Synvisc)", "J7323 (Euflexxa)"],
      authDuration: "Single treatment course (3-5 injections)",
      placeOfService: "Office-based procedure",
      monitoringSchedule: "Follow-up at 4 weeks post-completion. Reassess at 6 months before any repeat course.",
      costAvoidance: "Viscosupplementation can delay total knee arthroplasty by 2-3 years, avoiding a $35,000-$50,000 surgical episode",
      commonDenialReasons: [
        "No documented corticosteroid injection trial",
        "No documented physical therapy course",
        "Imaging not showing sufficient osteoarthritis severity",
        "Repeat course requested without documented prior benefit"
      ]
    },
    ms_therapies: {
      stepTherapy: {
        required: true,
        drugs: ["interferon_beta", "glatiramer_acetate", "dimethyl_fumarate", "teriflunomide"],
        minTrials: 1,
        minDurationWeeks: 24,
        documentationNeeded: "Documented breakthrough disease activity on a first-line DMT, or high-efficacy initial therapy for an aggressive presentation"
      },
      requiredLabs: ["CBC", "LFTs", "JC virus antibody index", "Hepatitis B and C serologies", "Varicella titer"],
      requiredImaging: ["Brain MRI with and without contrast within 3 months"],
      cptCodes: ["J2323 (natalizumab)", "J2350 (ocrelizumab)"],
      authDuration: "12 months",
      placeOfService: "Hospital outpatient or office-based infusion center",
      monitoringSchedule: "CBC and LFTs every 3 months. JCV antibody every 6 months (natalizumab). MRI every 6-12 months.",
      costAvoidance: "An MS relapse averages $18,000 per event; high-efficacy DMTs reduce the annualized relapse rate by 50-70%",
      commonDenialReasons: [
        "No MRI documenting disease activity",
        "Insufficient first-line DMT trial",
        "Missing JCV antibody for natalizumab",
        "No documented EDSS score"
      ]
    },
    psych_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["SSRI", "SNRI", "bupropion", "mirtazapine", "augmentation_with_antipsychotic"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Treatment-resistant depression: documented failure of at least two adequate antidepressant trials in the current episode"
      },
      requiredLabs: ["UDS (for esketamine)", "Pregnancy test", "Blood pressure monitoring protocol"],
      requiredImaging: [],
      cptCodes: ["J3490 (esketamine nasal spray)"],
      authDuration: "6 months, with reauthorization based on documented response",
      placeOfService: "REMS-certified healthcare facility with 2-hour post-dose monitoring",
      monitoringSchedule: "PHQ-9 at each session. Blood pressure pre- and post-dose. REMS compliance documentation.",
      costAvoidance: "Treatment-resistant depression costs about $25,000/year in healthcare utilization and lost productivity; esketamine achieves remission in roughly 27% of patients",
      commonDenialReasons: [
        "Insufficient prior antidepressant trials",
        "No PHQ-9 or HAM-D documenting severity",
        "REMS certification not confirmed",
        "No documentation of a current major depressive episode"
      ]
    },
    cardiology_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["ACE_inhibitor_or_ARB", "beta_blocker", "diuretic", "MRA"],
        minTrials: 1,
        minDurationWeeks: 4,
        documentationNeeded: "Documented LVEF and current NYHA functional class on maximally tolerated guideline-directed medical therapy"
      },
      requiredLabs: ["BNP or NT-proBNP", "eGFR", "Potassium", "LFTs"],
      requiredImaging: ["Echocardiogram within 6 months documenting LVEF"],
      cptCodes: ["J3490 (sacubitril/valsartan)"],
      authDuration: "12 months",
      placeOfService: "Outpatient pharmacy",
      monitoringSchedule: "Renal function and potassium at 1-2 weeks after initiation, then every 3 months.",
      costAvoidance: "An HFrEF hospitalization costs $15,000-$25,000; sacubitril/valsartan reduces heart-failure hospitalization by roughly 21%",
      commonDenialReasons: [
        "No documented LVEF",
        "ACE inhibitor or ARB not tried first",
        "Missing renal function labs",
        "NYHA class not documented"
      ]
    },
    biologics_pulm: {
      stepTherapy: {
        required: true,
        drugs: ["ICS_high_dose", "LABA", "LAMA", "LTRA", "oral_corticosteroids"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Uncontrolled severe asthma despite high-dose ICS/LABA with documented exacerbations and a qualifying eosinophil or IgE profile"
      },
      requiredLabs: ["IgE level (omalizumab)", "Blood eosinophil count", "FeNO if available"],
      requiredImaging: ["Chest X-ray or CT if diagnostic uncertainty"],
      cptCodes: ["J2182 (mepolizumab)", "J0517 (benralizumab)", "J2357 (omalizumab)"],
      authDuration: "12 months",
      placeOfService: "Office-based administration or Accredo specialty pharmacy",
      monitoringSchedule: "Spirometry every 3-6 months. Asthma Control Test at each visit. Exacerbation tracking.",
      costAvoidance: "A severe asthma exacerbation requiring hospitalization costs $12,000-$20,000; biologics reduce exacerbations by 50-70%",
      commonDenialReasons: [
        "Eosinophil count not meeting the phenotype threshold",
        "Insufficient ICS/LABA optimization",
        "No documented exacerbation history",
        "Spirometry not showing obstruction"
      ]
    },
    biologics_derm: {
      stepTherapy: {
        required: true,
        drugs: ["topical_corticosteroids", "topical_calcineurin_inhibitors", "phototherapy", "methotrexate", "cyclosporine"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Moderate-to-severe disease (BSA over 10% or PASI over 10) with documented failure of conventional therapies"
      },
      requiredLabs: ["CBC", "CMP", "TB screening", "Hepatitis B and C serologies"],
      requiredImaging: [],
      cptCodes: ["J3358 (dupilumab)", "J3590 (secukinumab)"],
      authDuration: "6 months initial, 12 months reauthorization",
      placeOfService: "Accredo specialty pharmacy, self-administered",
      monitoringSchedule: "PASI or BSA assessment every 3 months. CBC annually.",
      costAvoidance: "Uncontrolled psoriasis or atopic dermatitis results in about $8,000/year in productivity loss and $5,000/year in healthcare costs",
      commonDenialReasons: [
        "BSA or PASI not documented",
        "Insufficient topical therapy trial",
        "Missing TB screening",
        "Preferred biologic not tried first"
      ]
    }
  },

  "Humana": null,

  // ─── MEDICARE ADVANTAGE ───────────────────────────────────────────────────────
  // Criteria reflect CMS national and local coverage determinations (NCD/LCD).
  // Step therapy is applied consistent with the 2019 CMS guidance permitting
  // Part B step therapy for Medicare Advantage plans.
  "Medicare Advantage": {
    biologics_rheum: {
      stepTherapy: {
        required: true,
        drugs: ["methotrexate", "hydroxychloroquine", "sulfasalazine", "leflunomide"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "Documented inadequate response or intolerance to methotrexate at the maximum tolerated dose, consistent with the plan's Part B step therapy policy"
      },
      requiredLabs: ["RF", "Anti-CCP", "ESR", "CRP", "CBC", "LFTs", "TB screening", "Hepatitis B and C serologies"],
      requiredImaging: ["Radiographs of affected joints"],
      cptCodes: ["J0135 (adalimumab)", "J1745 (infliximab)", "J3357 (upadacitinib)"],
      authDuration: "12 months, subject to the applicable LCD",
      placeOfService: "Part B: office or facility infusion. Self-administered agents fall under Part D.",
      monitoringSchedule: "CBC and LFTs every 3 months. Disease activity assessment every 6 months.",
      costAvoidance: "Delayed control of active RA drives an estimated $14,800/year in avoidable ER, hospitalization, and surgical costs",
      commonDenialReasons: [
        "Step therapy requirement under the plan's Part B policy not met",
        "Service not supported by the applicable NCD/LCD",
        "Missing hepatitis or TB screening",
        "No documented disease activity score"
      ]
    },
    biologics_gi: {
      stepTherapy: {
        required: true,
        drugs: ["mesalamine", "budesonide", "corticosteroids", "immunomodulator"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Endoscopic evidence of active disease with documented failure of conventional therapy, per the applicable coverage determination"
      },
      requiredLabs: ["CBC", "CMP", "CRP", "Fecal calprotectin", "TB screening", "Hepatitis panel"],
      requiredImaging: ["Colonoscopy or enterography within 12 months"],
      cptCodes: ["J3380 (vedolizumab)", "J3357 (ustekinumab)"],
      authDuration: "12 months, subject to the applicable LCD",
      placeOfService: "Part B office or facility infusion center",
      monitoringSchedule: "CBC and CRP every 3 months. Endoscopic reassessment per clinical judgment.",
      costAvoidance: "Uncontrolled IBD leads to $15,000-$28,000/year in hospitalization; timely biologic therapy reduces surgical resection rates by roughly 50%",
      commonDenialReasons: [
        "No recent endoscopic confirmation",
        "Conventional therapy trial insufficient",
        "Service not supported by the applicable NCD/LCD",
        "Missing TB screening"
      ]
    },
    glp1_agonists: {
      stepTherapy: {
        required: true,
        drugs: ["metformin", "sulfonylurea"],
        minTrials: 1,
        minDurationWeeks: 12,
        documentationNeeded: "HbA1c above target on metformin at the maximum tolerated dose; note that weight-loss-only indications are excluded from Medicare Part D coverage"
      },
      requiredLabs: ["HbA1c within 3 months", "eGFR"],
      requiredImaging: [],
      cptCodes: ["J3490 (semaglutide)", "J3491 (tirzepatide)"],
      authDuration: "12 months (Part D)",
      placeOfService: "Part D pharmacy benefit, self-administered",
      monitoringSchedule: "HbA1c every 3 months. Renal function annually.",
      costAvoidance: "Uncontrolled T2DM costs about $9,600/year in complications; GLP-1 RAs reduce major cardiovascular events by roughly 14%",
      commonDenialReasons: [
        "HbA1c not above the plan threshold",
        "Requested for a weight-loss-only indication (excluded under Part D)",
        "Metformin trial insufficient or contraindication not documented",
        "Preferred formulary agent not tried first"
      ]
    },
    immunotherapy: {
      stepTherapy: { required: false, drugs: [], minTrials: 0, minDurationWeeks: 0, documentationNeeded: "NCCN guideline-concordant treatment, consistent with the applicable NCD/LCD" },
      requiredLabs: ["PD-L1 expression", "MSI/MMR status", "CBC", "CMP", "LDH", "TSH"],
      requiredImaging: ["CT or PET within 30 days confirming measurable disease"],
      cptCodes: ["J9271 (pembrolizumab)", "J9299 (nivolumab)"],
      authDuration: "3 months initial, then per NCCN and the applicable LCD",
      placeOfService: "Hospital outpatient infusion center (Part B)",
      monitoringSchedule: "CBC and CMP before each cycle. TSH every 6 weeks. CT restaging every 9-12 weeks.",
      costAvoidance: "Each month of delayed immunotherapy in eligible patients is associated with roughly a 15% reduction in overall survival",
      commonDenialReasons: [
        "Missing PD-L1 or biomarker testing",
        "Indication not concordant with NCCN or the applicable NCD/LCD",
        "No pathology report confirming histologic diagnosis",
        "Incomplete staging workup"
      ]
    },
    cgrp_inhibitors: {
      stepTherapy: {
        required: true,
        drugs: ["topiramate", "propranolol", "amitriptyline", "venlafaxine"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "At least 4 migraine days per month with documented failure of two preventive medications, per the plan's formulary policy"
      },
      requiredLabs: [],
      requiredImaging: [],
      cptCodes: ["J3032 (erenumab)", "J3031 (fremanezumab)"],
      authDuration: "12 months",
      placeOfService: "Part D pharmacy benefit (self-administered) or Part B for provider-administered agents",
      monitoringSchedule: "Headache diary review every 3 months. Assess 50% responder rate at 3 months.",
      costAvoidance: "Chronic migraine costs about $8,500/year in lost productivity and ER visits; CGRP inhibitors halve monthly migraine days in a majority of responders",
      commonDenialReasons: [
        "Fewer than two preventive medication trials",
        "Fewer than 4 migraine days per month documented",
        "No headache diary",
        "Preferred formulary agent not tried first"
      ]
    },
    viscosupplementation: {
      stepTherapy: {
        required: true,
        drugs: ["acetaminophen", "NSAIDs", "corticosteroid_injection", "physical_therapy"],
        minTrials: 3,
        minDurationWeeks: 6,
        documentationNeeded: "Failed conservative management including physical therapy and corticosteroid injection; note Medicare brand and frequency restrictions per the applicable LCD"
      },
      requiredLabs: [],
      requiredImaging: ["Weight-bearing knee radiographs showing Kellgren-Lawrence Grade 2-4"],
      cptCodes: ["J7325 (Synvisc)", "J7323 (Euflexxa)"],
      authDuration: "Single treatment course per the applicable LCD",
      placeOfService: "Office-based procedure (Part B)",
      monitoringSchedule: "Follow-up at 4 weeks post-completion. Reassess at 6 months before any repeat course.",
      costAvoidance: "Viscosupplementation can delay total knee arthroplasty by 2-3 years, avoiding a $35,000-$50,000 surgical episode",
      commonDenialReasons: [
        "No documented corticosteroid injection trial",
        "No documented physical therapy course",
        "Imaging not showing sufficient osteoarthritis severity",
        "Brand or frequency not permitted under the applicable LCD"
      ]
    },
    ms_therapies: {
      stepTherapy: {
        required: true,
        drugs: ["interferon_beta", "glatiramer_acetate", "dimethyl_fumarate"],
        minTrials: 1,
        minDurationWeeks: 24,
        documentationNeeded: "Documented breakthrough disease activity on a first-line DMT, or high-efficacy initial therapy for an aggressive presentation"
      },
      requiredLabs: ["CBC", "LFTs", "JC virus antibody index", "Hepatitis panel", "Varicella titer"],
      requiredImaging: ["Brain MRI with and without contrast within 3 months"],
      cptCodes: ["J2323 (natalizumab)", "J2350 (ocrelizumab)"],
      authDuration: "12 months",
      placeOfService: "Part B infusion center for provider-administered agents",
      monitoringSchedule: "CBC and LFTs every 3 months. JCV antibody every 6 months (natalizumab). MRI every 6-12 months.",
      costAvoidance: "An MS relapse averages $18,000 per event; high-efficacy DMTs reduce the annualized relapse rate by 50-70%",
      commonDenialReasons: [
        "No MRI documenting disease activity",
        "Insufficient first-line DMT trial",
        "Missing JCV antibody for natalizumab",
        "No documented EDSS score"
      ]
    },
    psych_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["SSRI", "SNRI", "bupropion", "mirtazapine"],
        minTrials: 2,
        minDurationWeeks: 8,
        documentationNeeded: "Treatment-resistant depression: documented failure of at least two adequate antidepressant trials in the current episode"
      },
      requiredLabs: ["UDS (for esketamine)", "Pregnancy test", "Blood pressure monitoring protocol"],
      requiredImaging: [],
      cptCodes: ["J3490 (esketamine nasal spray)"],
      authDuration: "6 months, with reauthorization based on documented response",
      placeOfService: "REMS-certified healthcare facility with 2-hour post-dose monitoring (Part B)",
      monitoringSchedule: "PHQ-9 at each session. Blood pressure pre- and post-dose. REMS compliance documentation.",
      costAvoidance: "Treatment-resistant depression costs about $25,000/year in healthcare utilization and lost productivity; esketamine achieves remission in roughly 27% of patients",
      commonDenialReasons: [
        "Insufficient prior antidepressant trials",
        "No PHQ-9 or HAM-D documenting severity",
        "REMS certification not confirmed",
        "No documentation of a current major depressive episode"
      ]
    },
    cardiology_specialty: {
      stepTherapy: {
        required: true,
        drugs: ["ACE_inhibitor_or_ARB", "beta_blocker", "diuretic"],
        minTrials: 1,
        minDurationWeeks: 4,
        documentationNeeded: "Documented LVEF and current NYHA functional class on maximally tolerated guideline-directed medical therapy"
      },
      requiredLabs: ["BNP or NT-proBNP", "eGFR", "Potassium"],
      requiredImaging: ["Echocardiogram within 6 months documenting LVEF"],
      cptCodes: ["J3490 (sacubitril/valsartan)"],
      authDuration: "12 months (Part D)",
      placeOfService: "Part D pharmacy benefit",
      monitoringSchedule: "Renal function and potassium at 1-2 weeks after initiation, then every 3 months.",
      costAvoidance: "An HFrEF hospitalization costs $15,000-$25,000; sacubitril/valsartan reduces heart-failure hospitalization by roughly 21%",
      commonDenialReasons: [
        "No documented LVEF",
        "ACE inhibitor or ARB not tried first",
        "Missing renal function labs",
        "NYHA class not documented"
      ]
    },
    biologics_pulm: {
      stepTherapy: {
        required: true,
        drugs: ["ICS_high_dose", "LABA", "LAMA", "LTRA"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Uncontrolled severe asthma despite high-dose ICS/LABA with documented exacerbations and a qualifying eosinophil or IgE profile"
      },
      requiredLabs: ["IgE level (omalizumab)", "Blood eosinophil count", "FeNO if available"],
      requiredImaging: ["Chest X-ray or CT if diagnostic uncertainty"],
      cptCodes: ["J2182 (mepolizumab)", "J0517 (benralizumab)", "J2357 (omalizumab)"],
      authDuration: "12 months, subject to the applicable LCD",
      placeOfService: "Part B office administration or Part D for self-administered agents",
      monitoringSchedule: "Spirometry every 3-6 months. Asthma Control Test at each visit. Exacerbation tracking.",
      costAvoidance: "A severe asthma exacerbation requiring hospitalization costs $12,000-$20,000; biologics reduce exacerbations by 50-70%",
      commonDenialReasons: [
        "Eosinophil count not meeting the phenotype threshold",
        "Insufficient ICS/LABA optimization",
        "No documented exacerbation history",
        "Service not supported by the applicable NCD/LCD"
      ]
    },
    biologics_derm: {
      stepTherapy: {
        required: true,
        drugs: ["topical_corticosteroids", "phototherapy", "methotrexate"],
        minTrials: 2,
        minDurationWeeks: 12,
        documentationNeeded: "Moderate-to-severe disease (BSA over 10% or PASI over 10) with documented failure of conventional therapies"
      },
      requiredLabs: ["CBC", "CMP", "TB screening", "Hepatitis panel"],
      requiredImaging: [],
      cptCodes: ["J3358 (dupilumab)", "J3590 (secukinumab)"],
      authDuration: "12 months (Part D)",
      placeOfService: "Part D pharmacy benefit, self-administered",
      monitoringSchedule: "PASI or BSA assessment every 3 months. CBC annually.",
      costAvoidance: "Uncontrolled psoriasis or atopic dermatitis results in about $8,000/year in productivity loss and $5,000/year in healthcare costs",
      commonDenialReasons: [
        "BSA or PASI not documented",
        "Insufficient topical therapy trial",
        "Missing TB screening",
        "Preferred formulary agent not tried first"
      ]
    }
  },

  "Medicaid": null,
};

// ─── CRITERIA MATCHING ENGINE ─────────────────────────────────────────────────

function identifyDrugClass(treatmentText) {
  const normalized = treatmentText.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  for (const [drug, cls] of Object.entries(DRUG_CLASS_MAP)) {
    if (normalized.includes(drug.replace(/_/g, " ")) || normalized.includes(drug)) {
      return { drugName: drug, drugClass: cls };
    }
  }
  return null;
}

// The payer used when an insurer has no native ruleset of its own.
const BASELINE_SOURCE = "UnitedHealthcare";

// True when the insurer has its own payer-specific criteria set, as opposed to
// relying on the baseline fallback below. Callers use this to label output
// honestly instead of presenting the baseline as payer-specific.
function hasNativeCriteria(insurer) {
  const c = INSURER_CRITERIA[insurer];
  return !!c && typeof c === "object";
}

function getInsurerCriteria(insurer, drugClass) {
  let criteria = INSURER_CRITERIA[insurer];
  if (!criteria || criteria === null) {
    // No native ruleset for this payer (e.g. Humana, Medicaid): fall back to the
    // documented baseline. This is intentional, but callers should surface it via
    // hasNativeCriteria() so it is labeled rather than shown as payer-specific.
    criteria = INSURER_CRITERIA[BASELINE_SOURCE];
  }
  return criteria[drugClass] || null;
}

function performGapAnalysis(patientData, criteria) {
  const gaps = [];
  const met = [];
  const enrichments = {};

  if (!criteria) {
    return { gaps: ["No insurer-specific criteria found for this drug class"], met: [], enrichments: {}, score: 0 };
  }

  // Check step therapy
  if (criteria.stepTherapy.required) {
    const priorMeds = (patientData.currentMedications || "").toLowerCase() + " " + (patientData.stepTherapy || "").toLowerCase();
    const triedDrugs = criteria.stepTherapy.drugs.filter(d =>
      priorMeds.includes(d.replace(/_/g, " "))
    );

    if (triedDrugs.length >= criteria.stepTherapy.minTrials) {
      met.push(`Step therapy requirement met: ${triedDrugs.join(", ")} documented`);
    } else {
      gaps.push({
        type: "step_therapy",
        severity: "HIGH",
        message: `Insurer requires trial of at least ${criteria.stepTherapy.minTrials} of: ${criteria.stepTherapy.drugs.join(", ")}. Only found: ${triedDrugs.length > 0 ? triedDrugs.join(", ") : "none documented"}`,
        recommendation: criteria.stepTherapy.documentationNeeded
      });
    }
  }

  // Check required labs
  if (criteria.requiredLabs && criteria.requiredLabs.length > 0) {
    enrichments.requiredLabs = criteria.requiredLabs;
    gaps.push({
      type: "labs",
      severity: "MEDIUM",
      message: `Ensure the following labs are documented and current: ${criteria.requiredLabs.join(", ")}`,
      recommendation: "Attach lab results to the PA submission. Flag any labs older than the required window."
    });
  }

  // Check required imaging
  if (criteria.requiredImaging && criteria.requiredImaging.length > 0) {
    enrichments.requiredImaging = criteria.requiredImaging;
    gaps.push({
      type: "imaging",
      severity: "MEDIUM",
      message: `Required imaging: ${criteria.requiredImaging.join(", ")}`,
      recommendation: "Ensure imaging reports are included with the PA submission."
    });
  }

  // Always inject administrative elements
  enrichments.cptCodes = criteria.cptCodes || [];
  enrichments.authDuration = criteria.authDuration || "Per insurer policy";
  enrichments.placeOfService = criteria.placeOfService || "Per clinical judgment";
  enrichments.monitoringSchedule = criteria.monitoringSchedule || "";
  enrichments.costAvoidance = criteria.costAvoidance || "";
  enrichments.commonDenialReasons = criteria.commonDenialReasons || [];

  // Calculate a gap score (0-100, where 100 = no gaps)
  const highGaps = gaps.filter(g => g.severity === "HIGH").length;
  const medGaps = gaps.filter(g => g.severity === "MEDIUM").length;
  const score = Math.max(0, 100 - (highGaps * 30) - (medGaps * 10));

  return { gaps, met, enrichments, score };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
export {
  DRUG_CLASS_MAP,
  INSURER_CRITERIA,
  BASELINE_SOURCE,
  identifyDrugClass,
  getInsurerCriteria,
  hasNativeCriteria,
  performGapAnalysis,
};
