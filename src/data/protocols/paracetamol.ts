import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Paracetamol (acetaminophen) poisoning (adult). v0.1, 23 Nov 2026.
// Australia & NZ guideline (MJA 2020) two-bag acetylcysteine; massive ingestion dosing.
export const PARACETAMOL_ADULT: ProtocolTopic = {
  id: "paracetamol-poisoning-adult",
  title: "Paracetamol poisoning",
  summary:
    "Often silent at first, with liver injury appearing at 24–72 hours. Assess the dose and time, use the nomogram for single known-time ingestions, and start acetylcysteine early when in doubt.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1 (ANZ paracetamol guideline 2020)",
  keywords: ["paracetamol", "acetaminophen", "dolo", "crocin", "calpol", "nac", "n-acetylcysteine", "acetylcysteine", "liver failure overdose", "rumack-matthew", "nomogram"],
  notice: "Draft for clinical sign-off. Use the treatment nomogram printed in your unit; paracetamol units differ (mg/L vs micromol/L).",
  firstTen: [
    "Ask: total dose (mg/kg), time of ingestion, single or staggered, immediate- or modified-release, co-ingestants.",
    "Risk: 10 g or 200 mg/kg or more (whichever is less) in an acute ingestion.",
    "Paracetamol level at 4 hours after ingestion (or on arrival if later), plus ALT and INR.",
    "Activated charcoal 50 g within 2 hours of a toxic dose (within 4 hours if over 30 g) in a cooperative patient.",
    "Start acetylcysteine if above the nomogram line, if the level will not be back before 8 hours, if time is unknown, staggered, or ALT is raised.",
  ],
  references: [
    "Chiew AL et al. Updated guidelines for the management of paracetamol poisoning in Australia and New Zealand. Med J Aust. 2020",
    "Rumack BH, Matthew H. Acetaminophen poisoning and toxicity. Pediatrics. 1975",
    "Bateman DN et al. Reduction of adverse effects from IV acetylcysteine for paracetamol overdose (SNAP). Lancet. 2014",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "First 24 hours: often none, or nausea and vomiting." },
        { text: "24–72 hours: right upper quadrant pain, rising ALT, INR." },
        { text: "3–5 days: liver failure — jaundice, encephalopathy, hypoglycaemia, AKI, acidosis." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "In overdose, glucuronidation and sulphation saturate; more paracetamol becomes the toxic metabolite NAPQI." },
        { text: "Glutathione detoxifies NAPQI until it is used up; then liver cells die (centrilobular necrosis)." },
        { text: "Acetylcysteine replenishes glutathione — nearly 100% protective if started within 8 hours." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Single known time", text: "Plot the 4-hour (or later) level on the nomogram; treat if on or above the line.", critical: true },
        { label: "Unknown time / staggered / modified-release", text: "Do not use the nomogram — treat with acetylcysteine and decide on stopping using later levels and ALT." },
        { label: "Late presentation (over 24 hours)", text: "Treat if paracetamol is detectable or ALT is raised." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Co-ingestion", text: "Check for other drugs", link: "poisoning-approach-adult" },
        { label: "Viral hepatitis", text: "Raised ALT without overdose" },
        { label: "Alcohol-related hepatitis", text: "Jaundice, alcohol history", link: "alcoholic-hepatitis-adult" },
        { label: "Ischaemic hepatitis", text: "After shock" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Levels", text: "Paracetamol level at 4 hours or later; repeat for modified-release or massive ingestion." },
        { label: "Bloods", text: "ALT, INR, creatinine, glucose, VBG with lactate, phosphate; repeat before stopping acetylcysteine." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Acetylcysteine (two-bag)", text: "200 mg/kg over 4 hours, then 100 mg/kg over 16 hours (adult maximum doses 22 g and 11 g).", critical: true },
        { label: "Massive ingestion", text: "Level more than double the nomogram line, or modified-release 30 g / 500 mg/kg or more: increase the second bag to 200 mg/kg over 16 hours and discuss with a toxicologist." },
        { label: "Reactions", text: "Flushing, rash, wheeze (non-allergic): pause, antihistamine, restart at a slower rate — do not abandon treatment." },
        { label: "When to stop", text: "After 20 hours of treatment if ALT is falling, INR is below 2 and the patient is well (and paracetamol below 10 mg/L for modified-release or massive ingestions); otherwise continue." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "Liver unit referral", text: "INR above 3 at 48 hours or above 4.5 at any time, oliguria or creatinine above 200 micromol/L, pH below 7.3 or lactate above 3, SBP below 80, hypoglycaemia, any encephalopathy." },
        { label: "Discharge", text: "Treatment completed with normal criteria, or a non-toxic level below the line with normal ALT; psychiatric assessment first." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Using the nomogram for staggered or unknown-time ingestions." },
        { text: "Waiting for the level beyond 8 hours before starting acetylcysteine." },
        { text: "Stopping acetylcysteine for a mild reaction." },
      ],
    },
  ],
};