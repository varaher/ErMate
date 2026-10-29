import type { ProtocolTopic } from "./protocolTypes";

// Source: Rajagiri Hospital ED CAD and ACS pathway v0.2 (11 Oct 2026, proposed, pending departmental approval),
// adapted into ErMate Pathway format (26 Oct 2026). Status stays "draft" until ED, cardiology, pharmacy and
// laboratory sign off. Local practice reported by the clinician is tagged tier "local" and is not a guideline step.
export const CAD_ACS_ADULT: ProtocolTopic = {
  id: "cad-acs-adult",
  title: "Chest pain: CAD & Acute Coronary Syndrome (Adult)",
  summary: "ECG within 10 minutes, activate the cath lab for STEMI without waiting for troponin, treat by pattern, and stratify only after dangerous causes are excluded.",
  population: "adult",
  status: "draft",
  version: "0.2",
  reviewedOn: "",
  source: "Rajagiri Hospital ED CAD and ACS pathway v0.2 (11 Oct 2026, proposed), ErMate Pathway adaptation 26 Oct 2026",
  keywords: ["chest pain", "chest pressure", "stemi", "nstemi", "unstable angina", "acs", "cath lab", "cag", "ptca", "troponin", "heart attack", "contrast", "avil"],
  notice: "Clinical review draft. Not an approved clinical order set. Requires ED, cardiology, pharmacy and laboratory sign-off. Troponin cutoffs are assay-specific and the Rajagiri laboratory values are still to be completed.",
  reviewNotes: [
    "Local contrast premedication practice (Avil before CAG) was supplied by the clinician and is not stated in the written Rajagiri CAD/ACS protocol.",
    "Verify formulation, route, contraindications, sedation effects, administration timing and written institutional approval before using any local step as an order set.",
    "Guideline references are listed but have not been independently checked against current live editions.",
  ],
  references: [
    "Rao SV et al. 2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for Management of Patients With ACS. Circulation. doi:10.1161/CIR.0000000000001309",
    "Byrne RA et al. 2023 ESC Guidelines for management of acute coronary syndromes. Eur Heart J. doi:10.1093/eurheartj/ehad191",
    "Kontos MC et al. 2022 ACC Expert Consensus Decision Pathway on ED chest pain. JACC. doi:10.1016/j.jacc.2022.08.750",
    "Backus BE et al. HEART score validation. Int J Cardiol. 2013. doi:10.1016/j.ijcard.2013.01.255",
    "American College of Radiology. Manual on Contrast Media, patient selection and premedication (verify current edition and local policy)",
    "European Society of Urogenital Radiology. ESUR Guidelines on Contrast Agents, hypersensitivity reactions (verify current edition)",
    "Rajagiri Hospital ED CAD and ACS pathway v0.2 (11 October 2026), proposed for clinical approval",
  ],
  sections: [
    {
      heading: "1. Background and recognition",
      kind: "recognition",
      items: [
        { text: "Suspect ACS with chest pressure, radiation to arm/jaw/back, diaphoresis, dyspnea, nausea, syncope or unexplained acute deterioration." },
        { text: "Older adults, women, and patients with diabetes or CKD may present without classic chest pain." },
        { text: "Consider aortic dissection, pulmonary embolism, tamponade, pneumothorax, myocarditis and other dangerous mimics.", critical: true },
      ],
    },
    {
      heading: "2. First 10 minutes: assessment and resuscitation",
      kind: "first10",
      items: [
        { label: "Resuscitation", text: "ABCDE, monitoring, pulse oximetry, IV access, serial observations and defibrillation readiness.", critical: true },
        { label: "ECG", text: "Obtain and interpret a 12-lead ECG within 10 minutes; repeat ECGs for persistent or recurrent symptoms.", critical: true, investigation: true },
        { label: "Extra leads", text: "Add right-sided V3R–V4R for suspected RV infarction and posterior V7–V9 when indicated.", investigation: true },
        { label: "Bloods", text: "hs-troponin, CBC, creatinine, electrolytes and glucose.", investigation: true },
        { text: "Do not delay reperfusion for laboratory tests or echo.", critical: true },
      ],
    },
    {
      heading: "3. Emergency decision pathway",
      kind: "treatment",
      items: [
        { label: "STEMI / acute coronary occlusion", text: "Activate cardiology and the cath lab immediately. Primary PCI targets in the source: first medical contact to device ≤90 min for direct presenters and ≤120 min for transfers. Do not wait for troponin.", critical: true },
        { label: "Unstable with a pulse (HASIA)", text: "Hypotension, altered mental status, shock, ischemic chest discomfort, acute heart failure: call senior ED and cardiology; manage rhythm, perfusion and airway; urgent angiography when indicated.", critical: true },
        { label: "Stable without occlusion ECG", text: "Use a locally validated assay-specific serial hs-troponin pathway (0/1 h or 0/2 h as approved). NSTEMI requires an acute troponin rise/fall with at least one value above the assay-specific 99th percentile AND evidence of ischemia. Unstable angina can occur without troponin elevation." },
      ],
    },
    {
      heading: "4. ECG interpretation and high-risk patterns",
      kind: "assessment",
      items: [
        { label: "Anterior V1–V4", text: "Anticipate LV failure, shock, ventricular arrhythmias." },
        { label: "Inferior II/III/aVF", text: "Evaluate bradycardia, AV block and RV involvement; avoid preload reduction with RV infarction.", critical: true },
        { label: "Lateral I/aVL/V5–V6", text: "Assess LV dysfunction and ischemic MR." },
        { label: "Posterior V7–V9", text: "Assess occult posterior occlusion." },
        { label: "Needs expert review", text: "Modified Sgarbossa, de Winter, Wellens and evolving ischemic changes. Avoid stress testing with suspected Wellens syndrome." },
      ],
    },
    {
      heading: "5. Acute treatment: source-derived adult options",
      kind: "treatment",
      items: [
        { label: "Aspirin", text: "300 mg chewed once for likely ACS if eligible; verify prior loading and bleeding risk." },
        { label: "Oxygen", text: "When SpO2 <90% or otherwise clinically indicated; avoid routine oxygen in normoxemia." },
        { label: "Nitroglycerin", text: "Sublingual 0.4 mg, repeat every 5 min up to three doses if appropriate; avoid in hypotension, RV infarction and relevant PDE5 inhibitor exposure.", critical: true },
        { label: "P2Y12 (primary PCI)", text: "Ticagrelor 180 mg or clopidogrel 600 mg when selected by cardiology. Do not routinely pretreat NSTE-ACS patients scheduled for early angiography before anatomy is known." },
        { label: "Heparin (NSTE-ACS, if UFH chosen)", text: "60 units/kg IV (max 4000 units), then 12 units/kg/h (initial max 1000 units/h), adjusted by the local aPTT/anti-Xa protocol. PCI dosing differs." },
        { label: "Statin", text: "Atorvastatin 80 mg orally when appropriate." },
        { text: "Shock, malignant arrhythmia, acute HF or mechanical complications require urgent specialist escalation and reperfusion planning.", critical: true },
      ],
    },
    {
      heading: "6. CAG contrast reaction screening and local premedication",
      kind: "treatment",
      note: "Guideline step and local practice are shown separately. Do not conflate premedication with ACS antithrombotic treatment.",
      items: [
        { label: "Screen first", text: "Ask about any prior contrast reaction and its severity; use an appropriate contrast strategy and make sure resuscitation is ready." },
        {
          label: "Avil (pheniramine) 25 mg IV before CAG",
          text: "Followed for all patients before CAG at this hospital. Confirmed by the clinician; it is not in the written Rajagiri CAD/ACS protocol. Verify formulation, route, contraindications, sedation effects, timing and written institutional approval before using it as an order set.",
          tier: "local",
          origin: "Rajagiri Hospital ED",
        },
        { label: "Evidence note", text: "Universal antihistamine premedication is not an established guideline requirement for contemporary iodinated contrast, and it does not reliably prevent severe contrast reactions or anaphylaxis." },
        { text: "Never delay time-critical primary PCI to give an antihistamine.", critical: true },
      ],
    },
    {
      heading: "7. Risk stratification, monitoring and disposition",
      kind: "disposition",
      note: "Use HEART only after immediate ACS/occlusion and other emergencies are addressed.",
      items: [
        { label: "HEART 0–3", text: "Consider discharge only after a completed validated troponin rule-out, reassuring ECG, resolved symptoms and senior review." },
        { label: "HEART 4–6", text: "Monitored observation (CCU under the proposed Rajagiri policy)." },
        { label: "HEART 7–10", text: "Monitored cardiology/CCU admission and urgent review." },
        { text: "Known CAD excludes automatic low-score discharge under this proposed protocol." },
        { text: "Continue serial ECG, troponin and symptom reassessment; escalate immediately for recurrent ischemia, shock, arrhythmia or heart failure.", critical: true },
      ],
    },
    {
      heading: "8. Clinical pitfalls and quality checks",
      kind: "pitfalls",
      items: [
        { text: "A single normal ECG or early troponin does not exclude ACS.", critical: true },
        { text: "Troponin cutoffs are assay-specific; the Rajagiri laboratory values remain to be completed." },
        { text: "Avoid automatic P2Y12 pretreatment before early invasive NSTE-ACS evaluation." },
        { text: "Do not delay reperfusion for HEART scoring, antihistamine premedication, chest X-ray or routine echo.", critical: true },
        { text: "Record symptom onset, ECG and cath-lab times, administered drugs, serial biomarkers and disposition." },
      ],
    },
  ],
};