import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Variceal bleed (branch of decompensated cirrhosis). v0.3, 23 Nov 2026.
// Updated to Baveno VIII (2026): erythromycin before endoscopy, vasoactive drug may stop 24 h after
// successful endoscopic haemostasis once an NSBB is started, individualised antibiotic duration,
// covered oesophageal stent preferred over balloon tamponade as a bridge where available, late TIPS windows.
export const VARICEAL_BLEED_ADULT: ProtocolTopic = {
  id: "variceal-bleed-adult",
  title: "Variceal bleed",
  summary:
    "Upper GI bleeding from oesophageal or gastric varices in portal hypertension. High early mortality — treat on suspicion, before endoscopy confirms it.",
  population: "adult",
  status: "draft",
  version: "0.3",
  reviewedOn: "",
  parent: "cirrhosis-liver-adult",
  source: "ErMate Handbook — liver emergencies pathway v0.3",
  keywords: ["variceal bleed", "varices", "hematemesis", "haematemesis", "vomiting blood", "melena", "melaena", "upper gi bleed", "ugib", "terlipressin", "octreotide", "portal hypertension"],
  notice: "Draft for clinical sign-off. Doses and drug choices must be confirmed against the patient and your hospital formulary.",
  firstTen: [
    "Airway first: intubate for massive haematemesis, falling GCS / encephalopathy, hypoxia, agitation preventing care, or aspiration.",
    "Two large-bore IV lines; send crossmatch; activate the massive transfusion protocol if exsanguinating.",
    "Start a vasoactive drug now — terlipressin, or octreotide if terlipressin is contraindicated or unavailable.",
    "Give antibiotic prophylaxis (ceftriaxone 1 g IV).",
    "Call gastroenterology: endoscopy within 12 hours of presentation once resuscitated, sooner if unstable.",
  ],
  references: [
    "Baveno VIII Faculty. Baveno VIII – Advancing consensus in portal hypertension. J Hepatol. 2026",
    "de Franchis R et al. Baveno VII – Renewing consensus in portal hypertension. J Hepatol. 2022",
    "Kaplan DE et al. AASLD Practice Guidance on portal hypertension and varices in cirrhosis. Hepatology. 2024",
    "Villanueva C et al. Transfusion strategies for acute upper gastrointestinal bleeding. N Engl J Med. 2013",
  ],
  reviewNotes: [
    "Baveno VIII items (erythromycin, 24 h vasoactive stop, stent over balloon, late TIPS) taken from published summaries of the 2026 consensus; confirm against the full J Hepatol text before sign-off.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Fresh haematemesis, melaena or haematochezia with a fast transit, dizziness or syncope." },
        { text: "Known cirrhosis or signs of it: jaundice, ascites, spider naevi, splenomegaly." },
        { text: "Tachycardia and hypotension; encephalopathy may follow within hours as blood is digested." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      note: "Portal pressure rises until thin-walled collaterals at the gastro-oesophageal junction rupture.",
      items: [
        { text: "Bleeding risk rises with portal pressure (HVPG above 12 mmHg), varix size, red wale signs and Child–Pugh class." },
        { text: "Over-filling the circulation raises portal pressure further and restarts bleeding — resuscitate to a target, not to normal." },
        { text: "Infection is both a trigger and a consequence of variceal bleeding; antibiotics reduce rebleeding and death." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Assume variceal", text: "Any upper GI bleed in known or suspected cirrhosis is treated as variceal until endoscopy shows otherwise.", critical: true },
        { label: "Severity", text: "Shock index, Hb, lactate and Child–Pugh / MELD guide where the patient goes and whether pre-emptive TIPS is considered." },
        { label: "Non-variceal possible", text: "Peptic ulcer causes a large share of bleeds in cirrhosis too; endoscopy decides.", link: "upper-gi-bleed-adult" },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Peptic ulcer bleed", text: "Epigastric pain, NSAIDs, H. pylori", link: "upper-gi-bleed-adult" },
        { label: "Portal hypertensive gastropathy", text: "Slow ooze, chronic anaemia" },
        { label: "Mallory–Weiss tear", text: "Bleeding after forceful vomiting" },
        { label: "Gastric varices", text: "Fundal varices; often heavier bleeding" },
        { label: "Swallowed blood", text: "Epistaxis or haemoptysis" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "CBC, crossmatch, RFT, electrolytes, LFT, PT/INR, fibrinogen, VBG with lactate, blood cultures." },
        { label: "ECG", text: "Before terlipressin (ischaemia) and before erythromycin (QT)." },
        { label: "After stabilisation", text: "Contrast CT or MRI of the abdomen during admission to look for portal vein thrombosis and liver cancer and to map collaterals." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Transfusion", text: "Restrictive: transfuse when Hb is below 7 g/dL, aiming for 7–8 g/dL. Individualise for massive ongoing bleeding or ischaemic heart disease.", critical: true },
        { label: "Terlipressin", text: "2 mg IV every 4 hours, reducing to 1 mg every 4 hours once bleeding is controlled; continue 2–5 days. Avoid in ischaemic heart, cerebrovascular or peripheral vascular disease; watch for chest pain, gut or limb ischaemia, hypoxia, fluid overload and low sodium.", critical: true },
        { label: "Octreotide (alternative)", text: "50 micrograms IV bolus, then 50 micrograms per hour infusion for 2–5 days." },
        { label: "Shorter course", text: "After successful endoscopic haemostasis the vasoactive drug can be stopped from 24 hours, once a non-selective beta-blocker is started (Baveno VIII)." },
        { label: "Antibiotic", text: "Ceftriaxone 1 g IV every 24 hours; duration individualised by infection risk and liver function, up to 7 days." },
        { label: "Before endoscopy", text: "Erythromycin 250 mg IV over 5 minutes, 30–90 minutes before endoscopy, to clear the stomach. Skip if the QT is prolonged." },
        { label: "Acid suppression", text: "IV pantoprazole may be given until endoscopy while the source is unknown; stop it afterwards if varices are the cause and there is no other indication." },
        { label: "Clotting", text: "Do not give tranexamic acid. Do not give FFP or platelets just to correct numbers." },
        { label: "Encephalopathy prevention", text: "Lactulose to clear blood from the gut.", link: "hepatic-encephalopathy-adult" },
      ],
    },
    {
      heading: "Procedures",
      kind: "procedures",
      items: [
        { label: "Endoscopy", text: "Band ligation for oesophageal varices; cyanoacrylate glue for gastric varices. Within 12 hours of presentation, after resuscitation." },
        { label: "Uncontrolled bleeding — bridge", text: "Covered self-expanding oesophageal metal stent is preferred where available; otherwise Sengstaken–Blakemore or Minnesota balloon tamponade after intubation, for up to 24 hours." , critical: true, link: "balloon-tamponade-procedure" },
        { label: "Pre-emptive TIPS", text: "Within 72 hours for Child–Pugh C 10–13, or Child–Pugh B above 7 with active bleeding at endoscopy. If the window is missed, late TIPS still helps (Baveno VIII). Refer to a TIPS centre." },
        { label: "Rescue TIPS", text: "For bleeding that persists or recurs despite drugs and endoscopy." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU / HDU", text: "All variceal bleeds, at least for the first 24–48 hours." },
        { label: "Transfer", text: "To a centre with 24-hour endoscopy and TIPS when not available locally, after airway and resuscitation." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Delaying the vasoactive drug until endoscopy — start it in the ED." },
        { text: "Over-transfusing to a normal Hb." },
        { text: "Taking a patient with active haematemesis and low GCS to endoscopy without securing the airway." },
        { text: "Forgetting antibiotics because there is no fever." },
      ],
    },
  ],
};