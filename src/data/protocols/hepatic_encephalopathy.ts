import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Hepatic encephalopathy (branch of decompensated cirrhosis). v0.3, 23 Nov 2026.
export const HEPATIC_ENCEPHALOPATHY_ADULT: ProtocolTopic = {
  id: "hepatic-encephalopathy-adult",
  title: "Hepatic encephalopathy",
  summary:
    "Brain dysfunction from liver failure or portosystemic shunting. In the ED it is a diagnosis of exclusion — rule out the mimics and always look for the trigger.",
  population: "adult",
  status: "draft",
  version: "0.3",
  reviewedOn: "",
  parent: "cirrhosis-liver-adult",
  source: "ErMate Handbook — liver emergencies pathway v0.3",
  keywords: ["hepatic encephalopathy", "he", "confusion", "altered sensorium", "drowsy", "asterixis", "flapping tremor", "lactulose", "rifaximin", "ammonia", "hepatic coma"],
  notice: "Draft for clinical sign-off. Doses must be confirmed against the patient and your hospital formulary.",
  firstTen: [
    "Check glucose. Protect the airway in grade III–IV (GCS 8 or less, vomiting, aspiration risk).",
    "Look for the trigger: GI bleed, infection, constipation, dehydration or diuretics, low potassium or sodium, sedatives, alcohol.",
    "Start lactulose — by NG tube or enema if unable to swallow safely.",
    "CT head if there was a fall, focal signs, a first episode or no obvious trigger.",
  ],
  references: [
    "Vilstrup H et al. Hepatic encephalopathy in chronic liver disease: AASLD/EASL practice guideline. Hepatology. 2014",
    "EASL Clinical Practice Guidelines on the management of hepatic encephalopathy. J Hepatol. 2022",
    "Baveno VIII Faculty. Baveno VIII – Advancing consensus in portal hypertension. J Hepatol. 2026",
  ],
  sections: [
    {
      heading: "West Haven grades",
      kind: "symptoms",
      items: [
        { label: "Grade I", text: "Altered sleep pattern, short attention span, mild confusion, euphoria or anxiety." },
        { label: "Grade II", text: "Lethargy, disorientation to time, inappropriate behaviour, asterixis." },
        { label: "Grade III", text: "Somnolent but rousable, confused, disoriented to place.", critical: true },
        { label: "Grade IV", text: "Coma.", critical: true },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Ammonia from gut bacteria and protein breakdown bypasses the failing liver and shunts, and crosses into the brain." },
        { text: "Astrocytes convert ammonia to glutamine and swell; inflammation and sepsis make the brain more sensitive to ammonia." },
        { text: "Bleeding (a protein load), infection, dehydration and low potassium all raise ammonia production or brain sensitivity." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Exclude mimics", text: "Hypoglycaemia, intracranial bleed, sepsis or meningitis, alcohol intoxication or withdrawal, Wernicke, drugs, hyponatraemia, post-ictal state.", critical: true },
        { label: "Find the trigger", text: "Present in most episodes — treating it is as important as lactulose.", link: "cirrhosis-liver-adult" },
        { label: "Ammonia level", text: "A normal level makes HE less likely, but a high level does not confirm it and does not guide treatment. Do not delay treatment for it." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Hypoglycaemia", text: "Check before anything else", link: "hypoglycaemia-adult" },
        { label: "Intracranial haemorrhage", text: "Falls, coagulopathy, focal signs", link: "intracranial-haemorrhage-adult" },
        { label: "Sepsis / SBP", text: "Fever may be absent", link: "sbp-adult" },
        { label: "Alcohol withdrawal / Wernicke", text: "Tremor, agitation, ataxia, eye signs", link: "alcohol-withdrawal-adult" },
        { label: "Hyponatraemia", text: "Sodium below 125 mmol/L", link: "hyponatraemia-adult" },
        { label: "Drug toxicity", text: "Benzodiazepines, opioids", link: "poisoning-approach-adult" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "Glucose, sodium, potassium, magnesium, RFT, LFT, PT/INR, CBC, VBG, blood cultures; ammonia only if the diagnosis is uncertain." },
        { label: "Infection screen", text: "Diagnostic ascitic tap, urine culture, chest X-ray." },
        { label: "CT head", text: "Fall, focal signs, first episode, no trigger found, or not improving after 24–48 hours of treatment." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Airway", text: "Intubate grade III–IV with aspiration risk; nurse 30 degrees head-up.", critical: true },
        { label: "Lactulose", text: "25 mL every 1–2 hours until there are two soft stools, then 15–30 mL 2–3 times a day titrated to 2–3 soft stools a day. Watch for dehydration and high sodium." },
        { label: "Lactulose enema", text: "300 mL lactulose in 700 mL water, retained for 30–60 minutes, every 4–6 hours when oral or NG route is unsafe." },
        { label: "Rifaximin", text: "550 mg twice daily as an add-on to lactulose." },
        { label: "L-ornithine L-aspartate (LOLA)", text: "IV LOLA may be considered as an add-on in overt HE not responding to lactulose." },
        { label: "Correct", text: "Potassium, sodium (slowly), fluids; stop sedatives and diuretics." },
        { label: "Nutrition", text: "Do not restrict protein; feed early once the airway is safe." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Grade III–IV, intubated, or with organ failure." },
        { label: "Ward / HDU", text: "Grade I–II with a treatable trigger." },
        { label: "Discharge", text: "Rarely — only grade I resolved, trigger treated, and a reliable carer at home." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Labelling confusion as HE without checking glucose and excluding a head bleed." },
        { text: "Using a high ammonia level as proof of HE." },
        { text: "Giving flumazenil routinely — reserve it for suspected benzodiazepine effect, and expect seizures or withdrawal." },
        { text: "Over-purging with lactulose, causing dehydration, high sodium and AKI." },
      ],
    },
  ],
};