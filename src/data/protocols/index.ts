import type { ProtocolChapter, ProtocolTopic } from "./protocolTypes";
import { DYSPNEA_ADULT } from "./dyspnea";
import { CAD_ACS_ADULT } from "./cad_acs";
import { CIRRHOSIS_ADULT } from "./cirrhosis";
import { VARICEAL_BLEED_ADULT } from "./variceal_bleed";
import { SBP_ADULT } from "./sbp";
import { HEPATIC_ENCEPHALOPATHY_ADULT } from "./hepatic_encephalopathy";
import { HRS_AKI_ADULT } from "./hrs_aki";
import { CARDIAC_ARREST_ADULT } from "./cardiac_arrest";
import { POST_ROSC_ADULT } from "./post_rosc";
import { BRADYCARDIA_ADULT } from "./bradycardia";
import { TACHYCARDIA_ADULT } from "./tachycardia";
import { SHOCK_UNDIFFERENTIATED_ADULT } from "./shock";
import { SEPSIS_ADULT } from "./sepsis";
import { ANAPHYLAXIS_ADULT } from "./anaphylaxis";
import { TRAUMA_PRIMARY_SURVEY_ADULT } from "./trauma_primary_survey";
import { HAEMORRHAGIC_SHOCK_ADULT } from "./haemorrhagic_shock";
import { TBI_ADULT } from "./tbi";
import { CHEST_TRAUMA_ADULT } from "./chest_trauma";
import { TENSION_PNEUMOTHORAX_ADULT } from "./tension_pneumothorax";
import { SPINAL_INJURY_ADULT } from "./spinal_injury";
import { BURNS_ADULT } from "./burns";
import { CARDIAC_ARREST_PAEDS } from "./paeds_cardiac_arrest";
import { SEPTIC_SHOCK_PAEDS } from "./paeds_septic_shock";
import { STATUS_EPILEPTICUS_PAEDS } from "./paeds_status_epilepticus";
import { DKA_PAEDS } from "./paeds_dka";
import { ASTHMA_PAEDS } from "./paeds_asthma";
import { BRONCHIOLITIS_PAEDS } from "./paeds_bronchiolitis";
import { POISONING_APPROACH_ADULT } from "./poisoning_approach";
import { ORGANOPHOSPHATE_ADULT } from "./organophosphate";
import { SNAKEBITE_ADULT } from "./snakebite";
import { ALUMINIUM_PHOSPHIDE_ADULT } from "./aluminium_phosphide";
import { PARAQUAT_ADULT } from "./paraquat";
import { PARACETAMOL_ADULT } from "./paracetamol";
import { METHANOL_ADULT } from "./methanol";
import { STROKE_ADULT } from "./stroke";
import { ICH_ADULT } from "./ich";
import { SAH_ADULT } from "./sah";
import { SEIZURE_ADULT } from "./seizure";
import { MENINGITIS_ADULT } from "./meningitis";
import { HYPOGLYCAEMIA_ADULT } from "./hypoglycaemia";
import { ALCOHOL_WITHDRAWAL_ADULT } from "./alcohol_withdrawal";

/** ErMate Handbook chapters. A topic can link to any other topic by id (see protocolViews.resolveLink). */
export const PROTOCOL_CHAPTERS: ProtocolChapter[] = [
  {
    id: "resuscitation",
    title: "Resuscitation & Life Threats",
    topics: [CARDIAC_ARREST_ADULT, POST_ROSC_ADULT, BRADYCARDIA_ADULT, TACHYCARDIA_ADULT, SHOCK_UNDIFFERENTIATED_ADULT, SEPSIS_ADULT, ANAPHYLAXIS_ADULT],
  },
  {
    id: "trauma",
    title: "Trauma",
    topics: [TRAUMA_PRIMARY_SURVEY_ADULT, HAEMORRHAGIC_SHOCK_ADULT, TBI_ADULT, CHEST_TRAUMA_ADULT, TENSION_PNEUMOTHORAX_ADULT, SPINAL_INJURY_ADULT, BURNS_ADULT],
  },
  {
    id: "paediatric",
    title: "Paediatric Emergencies (under 16)",
    topics: [CARDIAC_ARREST_PAEDS, SEPTIC_SHOCK_PAEDS, STATUS_EPILEPTICUS_PAEDS, DKA_PAEDS, ASTHMA_PAEDS, BRONCHIOLITIS_PAEDS],
  },
  {
    id: "toxicology",
    title: "Toxicology & Envenomation",
    topics: [POISONING_APPROACH_ADULT, ORGANOPHOSPHATE_ADULT, SNAKEBITE_ADULT, ALUMINIUM_PHOSPHIDE_ADULT, PARAQUAT_ADULT, PARACETAMOL_ADULT, METHANOL_ADULT],
  },
  {
    id: "neurology",
    title: "Neurology & Altered Sensorium",
    topics: [STROKE_ADULT, ICH_ADULT, SAH_ADULT, SEIZURE_ADULT, MENINGITIS_ADULT, HYPOGLYCAEMIA_ADULT, ALCOHOL_WITHDRAWAL_ADULT],
  },
  { id: "breathing", title: "Breathing & Airway", topics: [DYSPNEA_ADULT] },
  { id: "cardiac", title: "Cardiac & Chest Pain", topics: [CAD_ACS_ADULT] },
  {
    id: "gi-hepatic",
    title: "GI & Liver",
    topics: [CIRRHOSIS_ADULT, VARICEAL_BLEED_ADULT, SBP_ADULT, HEPATIC_ENCEPHALOPATHY_ADULT, HRS_AKI_ADULT],
  },
];

export function allProtocolTopics(): ProtocolTopic[] {
  return PROTOCOL_CHAPTERS.flatMap((c) => c.topics);
}

export function findTopic(id: string | undefined): ProtocolTopic | undefined {
  if (!id) return undefined;
  return allProtocolTopics().find((t) => t.id === id);
}

/** Plain-text search over title, summary, First 10 minutes and every instruction. No AI. */
export function searchProtocols(query: string): ProtocolTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return allProtocolTopics();
  return allProtocolTopics().filter((t) => {
    if (t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)) return true;
    if ((t.keywords || []).some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    if ((t.firstTen || []).some((f) => f.toLowerCase().includes(q))) return true;
    return t.sections.some((s) =>
      s.heading.toLowerCase().includes(q) ||
      s.items.some((i) => (i.label || "").toLowerCase().includes(q) || i.text.toLowerCase().includes(q))
    );
  });
}