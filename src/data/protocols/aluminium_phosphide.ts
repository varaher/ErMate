import type { ProtocolTopic } from "./protocolTypes";

// ErMate Handbook — Aluminium phosphide poisoning (adult). v0.1, 23 Nov 2026. No specific antidote; supportive care.
export const ALUMINIUM_PHOSPHIDE_ADULT: ProtocolTopic = {
  id: "aluminium-phosphide-poisoning-adult",
  title: "Aluminium phosphide (Celphos) poisoning",
  summary:
    "Grain fumigant tablets that release phosphine gas. Very high mortality from refractory shock and arrhythmias. No antidote — aggressive supportive care and early ICU.",
  population: "adult",
  status: "draft",
  version: "0.1",
  reviewedOn: "",
  parent: "poisoning-approach-adult",
  source: "ErMate Handbook — toxicology pathway v0.1",
  keywords: ["aluminium phosphide", "aluminum phosphide", "celphos", "rice tablet", "grain tablet", "phosphine", "fumigant", "zinc phosphide", "rat poison"],
  notice: "Draft for clinical sign-off. Medico-legal case. Phosphine gas can affect staff — ventilate the room.",
  firstTen: [
    "Ventilated area; staff protection (gloves, avoid inhaling vomit vapour).",
    "ABC, oxygen, two IV lines, continuous ECG and BP monitoring.",
    "Hypotension: fluids guided by bedside echo and lung ultrasound, then noradrenaline early.",
    "Bloods: VBG with lactate, glucose, potassium, magnesium; ECG every 1–2 hours.",
    "Call ICU now; consider early transfer to a centre with ECMO if available.",
  ],
  references: [
    "Gurjar M et al. Managing aluminium phosphide poisonings. J Emerg Trauma Shock. 2011",
    "Mehrpour O et al. Aluminium phosphide poisoning: a review of clinical features and management. Crit Rev Toxicol. 2024",
    "Hassanian-Moghaddam H et al. Extracorporeal life support in aluminium phosphide poisoning. Clin Toxicol. 2016",
  ],
  reviewNotes: [
    "Evidence for magnesium, oil-based gastric adsorption and KMnO4 lavage is weak or conflicting; they are shown as local practice. Decide what ErMate's base standard includes.",
  ],
  sections: [
    {
      heading: "Symptoms and signs",
      kind: "symptoms",
      items: [
        { text: "Vomiting, epigastric pain, garlic or rotten-fish odour, thirst, restlessness." },
        { text: "Within hours: refractory hypotension, tachy- or bradyarrhythmias, metabolic acidosis, pulmonary oedema / ARDS." },
        { text: "Consciousness is often preserved until late." },
      ],
    },
    {
      heading: "Pathophysiology",
      kind: "pathophysiology",
      items: [
        { text: "Tablets react with moisture and stomach acid to release phosphine gas." },
        { text: "Phosphine blocks mitochondrial cytochrome oxidase and generates free radicals → direct myocardial toxicity, vasodilation, severe lactic acidosis." },
        { text: "A fresh tablet (3 g, releasing about 1 g phosphine) is often fatal; exposed tablets that have 'gone powdery' are less toxic." },
      ],
    },
    {
      heading: "Approach in the ED",
      kind: "approach",
      items: [
        { label: "Assume severe", text: "Even a well-looking patient can collapse within hours.", critical: true },
        { label: "Echo-guided care", text: "Distinguish poor contractility (needs inotrope) from vasodilation (needs vasopressor); avoid fluid overload." },
        { label: "Silver nitrate paper test", text: "Breath or gastric aspirate turns paper black — supports the diagnosis where available." },
      ],
    },
    {
      heading: "Differential diagnosis",
      kind: "differentials",
      layout: "tiles",
      items: [
        { label: "Organophosphate poisoning", text: "Secretions, pinpoint pupils", link: "organophosphate-poisoning-adult" },
        { label: "Septic shock", text: "Fever, source", link: "sepsis-adult" },
        { label: "Cardiogenic shock (ACS)", text: "Chest pain, ST changes", link: "cad-acs-adult" },
        { label: "Zinc phosphide", text: "Rat poison paste — similar, often milder" },
        { label: "Acute pancreatitis", text: "Epigastric pain, high lipase" },
      ],
    },
    {
      heading: "Investigations",
      kind: "investigations",
      items: [
        { label: "Bloods", text: "VBG / ABG with lactate (severe acidosis predicts death), glucose (hypo- or hyperglycaemia), potassium, magnesium, renal and liver function, CBC." },
        { label: "ECG", text: "Repeat 1–2 hourly: ST changes, conduction block, ventricular arrhythmias." },
        { label: "Echo", text: "Ejection fraction and IVC to guide fluids and inotropes." },
      ],
    },
    {
      heading: "Treatment",
      kind: "treatment",
      items: [
        { label: "Shock", text: "Cautious fluids; noradrenaline; add dobutamine or adrenaline for poor contractility; correct acidosis (bicarbonate for pH below 7.1).", critical: true },
        { label: "Arrhythmia", text: "Standard ACLS; correct potassium and magnesium.", link: "tachycardia-adult" },
        { label: "Glucose", text: "Monitor and correct hypoglycaemia." },
        { label: "Gastric decontamination", text: "Early oral coconut oil or liquid paraffin to reduce phosphine release, and avoiding water; gastric lavage with KMnO4 is not recommended.", tier: "local", origin: "Common Indian practice" },
        { label: "Magnesium sulphate", text: "IV magnesium is widely given; benefit in trials is inconsistent — at minimum, correct a low level.", tier: "local", origin: "Common Indian practice" },
        { label: "ECMO", text: "VA-ECMO for refractory cardiogenic shock where available — the only intervention with consistent survival benefit in case series." },
      ],
    },
    {
      heading: "Disposition",
      kind: "disposition",
      items: [
        { label: "ICU", text: "Every patient, however well on arrival." },
        { label: "Transfer", text: "Early, to an ECMO-capable centre, before shock becomes refractory." },
      ],
    },
    {
      heading: "Pitfalls",
      kind: "pitfalls",
      items: [
        { text: "Reassurance from an alert patient — collapse can be sudden." },
        { text: "Large fluid volumes into a poisoned myocardium." },
        { text: "Water-based lavage releasing more phosphine." },
      ],
    },
  ],
};