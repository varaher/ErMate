import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Acute ischaemic stroke (adult). v0.1, 23 Nov 2026.
// 2026 AHA/ASA Guideline for the Early Management of Acute Ischemic Stroke (Stroke, 26 Jan 2026):
// tenecteplase = alteplase; imaging-selected IVT to 9 h; disabling deficits treated regardless of NIHSS;
// non-disabling → DAPT (NIHSS ≤5, start ≤72 h); basilar EVT ≤24 h with NIHSS ≥10; large-core EVT;
// no intensive SBP < 140 after reperfusion; no intensive glucose 80–130.
export const STROKE_ADULT: ProtocolTopic = {
  id: "stroke-adult",
  title: "Acute ischaemic stroke",
  summary:
    "Sudden focal neurological deficit. Time is brain: check glucose, image immediately, give thrombolysis for disabling deficits within the window, and get large-vessel occlusions to thrombectomy.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  source: "ErMate Handbook — neurology pathway v0.1 (2026 AHA/ASA AIS guideline)",
  keywords: ["stroke", "cva", "ischaemic stroke", "ischemic stroke", "hemiparesis", "facial droop", "slurred speech", "aphasia", "thrombolysis", "tenecteplase", "alteplase", "tpa", "thrombectomy", "lvo", "befast", "fast", "code stroke"],
  notice: "Draft for clinical sign-off. Follow your hospital's code-stroke pathway and thrombolysis checklist.",
  firstTen: [
    "Activate code stroke. Establish last known well time exactly.",
    "Bedside glucose now — hypoglycaemia mimics stroke.",
    "NIHSS; decide whether the deficit is disabling.",
    "Non-contrast CT head (with CT angiography if thrombectomy is possible) immediately — door-to-imaging as fast as possible.",
    "Disabling deficit, no bleed, within 4.5 hours (or up to 9 hours with imaging mismatch): thrombolyse after BP is below 185/110.",
  ],
  references: [
    "Prabhakaran S et al. 2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke (AHA/ASA). Stroke. 2026",
    "Powers WJ et al. 2019 Update to the 2018 Guidelines for the Early Management of Acute Ischemic Stroke. Stroke. 2019",
    "Menon BK et al. Intravenous tenecteplase compared with alteplase for acute ischaemic stroke (AcT). Lancet. 2022",
  ],
  reviewNotes: [
    "Tenecteplase / alteplase doses, BP 185/110 and 180/105 limits and thrombectomy windows follow established trial and guideline values; confirm against the full 2026 text (doi 10.1161/STR.0000000000000513).",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "BE-FAST: Balance loss, Eyes (vision loss, gaze deviation), Face droop, Arm or leg weakness, Speech difficulty, Time to call." },
        { text: "Large-vessel occlusion clues: gaze deviation, aphasia or neglect, dense hemiplegia, NIHSS 6 or more." },
        { text: "Posterior circulation: vertigo with ataxia, diplopia, dysarthria, crossed signs, reduced consciousness." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "An occluded artery creates an infarct core surrounded by a penumbra of salvageable tissue; about 1.9 million neurons are lost every minute." },
        { text: "Reperfusion (thrombolysis, thrombectomy) rescues the penumbra; imaging mismatch shows how much is left." },
        { text: "Causes: cardioembolic (AF), large-artery atherosclerosis, small-vessel (lacunar), dissection, other." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Disabling deficit", text: "Treat with thrombolysis within 4.5 hours regardless of the NIHSS score.", critical: true },
        { label: "Non-disabling deficit", text: "No thrombolysis — dual antiplatelet therapy instead." },
        { label: "Wake-up / unknown onset or 4.5–9 hours", text: "Thrombolysis for selected patients with MRI DWI–FLAIR mismatch or CT perfusion mismatch." },
        { label: "Large-vessel occlusion", text: "Thrombectomy: anterior circulation up to 24 hours with imaging selection (including selected large cores); basilar occlusion up to 24 hours with NIHSS 10 or more. Give thrombolysis too if eligible — do not delay transfer.", critical: true },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Intracranial haemorrhage", text: "CT shows blood", link: "intracranial-haemorrhage-adult" },
        { label: "Hypoglycaemia", text: "Check glucose first", link: "hypoglycaemia-adult" },
        { label: "Seizure with Todd's paresis", text: "Witnessed seizure, improving", link: "seizure-adult" },
        { label: "Subarachnoid haemorrhage", text: "Thunderclap headache", link: "sah-adult" },
        { label: "Migraine with aura", text: "Spreading symptoms, history" },
        { label: "Meningitis / encephalitis", text: "Fever, confusion", link: "meningitis-adult" },
        { label: "Functional deficit", text: "Inconsistent signs — still image" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Before thrombolysis", text: "Glucose only is required; do not wait for other results unless anticoagulant use or bleeding disorder is suspected." },
        { label: "Imaging", text: "Non-contrast CT head; CT angiography (head and neck) for possible thrombectomy; CT perfusion or MRI for late or unknown onset." },
        { label: "Bloods", text: "CBC, PT/INR, aPTT, renal function, electrolytes, troponin, lipid profile, HbA1c." },
        { label: "ECG", text: "AF, ischaemia." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Tenecteplase", text: "0.25 mg/kg IV single bolus (maximum 25 mg) — equally preferred to alteplase.", critical: true },
        { label: "Alteplase", text: "0.9 mg/kg (maximum 90 mg): 10% as a bolus over 1 minute, the rest over 60 minutes." },
        { label: "Blood pressure", text: "Below 185/110 before thrombolysis and below 180/105 for 24 hours after (labetalol or nicardipine). Do not drive SBP below 140 after reperfusion. Not thrombolysed: treat only above 220/120.", critical: true },
        { label: "Dual antiplatelet", text: "Minor non-disabling stroke (NIHSS 5 or less) or high-risk TIA, started within 72 hours: aspirin plus clopidogrel (loading 300–600 mg) for 21 days, then single agent." },
        { label: "Not thrombolysed, no DAPT", text: "Aspirin 150–325 mg within 24–48 hours once haemorrhage is excluded (after a swallow screen)." },
        { label: "General", text: "SpO2 above 94%; treat fever; glucose 140–180 mg/dL (intensive 80–130 is not recommended); swallow screen before oral intake; head flat or 30 degrees by tolerance." },
        { label: "Thrombolysis bleeding", text: "Stop the infusion; cryoprecipitate and tranexamic acid; urgent CT and neurosurgery." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Thrombectomy centre", text: "Suspected large-vessel occlusion — direct transfer." },
        { label: "Stroke unit / ICU", text: "All acute strokes; ICU after thrombolysis or thrombectomy per local policy." },
        { label: "TIA", text: "High-risk TIA: admit or urgent same-day clinic with imaging and DAPT." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Waiting for blood results before thrombolysis." },
        { text: "Withholding thrombolysis for a disabling deficit because the NIHSS is low." },
        { text: "Missing posterior circulation stroke presenting as 'vertigo'." },
        { text: "Lowering BP aggressively in a patient who is not thrombolysed." },
      ],
    },
  ],
};