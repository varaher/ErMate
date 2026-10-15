/**
 * pediatricMirror.ts
 *
 * The pediatric case sheet stores its examination in `pediatricDetails.*`, but the discharge
 * summary, pending-documentation check, handover, exports and AI all read the standard
 * `primaryAssessment` / `secondarySurvey` / `secondaryAssessment` fields. This pure function
 * copies what the doctor actually typed into those standard fields, so nothing is blank
 * downstream. It never invents text: a standard field is only written when the matching
 * pediatric field has content.
 */
import type { ClinicalCase } from "../types";

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const lbl = (label: string, v: unknown): string | null => (t(v) ? `${label}: ${t(v)}` : null);
const join = (parts: Array<string | null | undefined>, sep = "; "): string =>
  parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);

export const SECONDARY_SURVEY_KEYS = ["general", "cvs", "respiratory", "abdomen", "cns", "extremities"] as const;

/** Same layout the adult sheet writes, so every existing parser keeps working. */
export function buildSecondaryAssessmentString(s: Record<string, string | undefined> | undefined): string {
  const x = s || {};
  const parts: string[] = [];
  if (t(x.general)) parts.push(`General: ${t(x.general)}`);
  if (t(x.cvs)) parts.push(`CVS: ${t(x.cvs)}`);
  if (t(x.respiratory)) parts.push(`RS: ${t(x.respiratory)}`);
  if (t(x.abdomen)) parts.push(`PA: ${t(x.abdomen)}`);
  if (t(x.cns)) parts.push(`CNS: ${t(x.cns)}`);
  if (t(x.extremities)) parts.push(`Extremities: ${t(x.extremities)}`);
  return parts.join("\n");
}

export function mirrorPediatricToStandard(c: ClinicalCase): ClinicalCase {
  if (!c || !c.isPediatric || !c.pediatricDetails) return c;
  const p: any = c.pediatricDetails;

  // ---- Primary assessment (A-E) ----
  const airway = join([lbl("Status", p.airwayStatus), lbl("Cry", p.airwayCry), lbl("Intervention", p.airwayIntervention)]);
  const breathing = join([
    lbl("Work of breathing", p.breathingWob), lbl("Abnormal positioning", p.breathingAbnormalPositioning),
    lbl("Air entry", p.breathingAirEntry), lbl("Subcutaneous emphysema", p.breathingSubcutaneousEmphysema),
    lbl("Intervention", p.breathingIntervention),
  ]);
  const circulation = join([
    lbl("CRT", p.circulationCrt), lbl("Skin", p.circulationSkinColorTemp),
    lbl("Distended neck veins", p.circulationDistendedNeckVeins), lbl("Intervention", p.circulationIntervention),
  ]);
  const disability = join([
    lbl("AVPU/GCS", p.disabilityAvpuGcs), lbl("Pupils", p.disabilityPupils),
    lbl("Abnormal responses", p.disabilityAbnormalResponses), lbl("GRBS", p.disabilityGrbs),
  ]);
  const exposure = join([
    lbl("Temp", p.exposureTemp), lbl("Log roll", p.exposureTraumaLogroll), lbl("Signs of trauma", p.exposureSignsOfTrauma),
    lbl("Infection/bleeding", p.exposureEvidenceInfectionBleeding), lbl("Long bone deformities", p.exposureLongBoneDeformities),
    lbl("Extremities", p.exposureExtremitiesCheck), lbl("Injured limbs immobilised", p.exposureImmobilizeInjuredLimbs),
  ]);

  const prevPa: any = c.primaryAssessment || {};
  const nextPa: any = { ...prevPa };
  if (airway) nextPa.airway = airway;
  if (breathing) nextPa.breathing = breathing;
  if (circulation) nextPa.circulation = circulation;
  if (disability) nextPa.disability = disability;
  if (exposure) nextPa.exposure = exposure;

  // ---- Secondary assessment (focused examination) ----
  const fromPeds: Record<string, string> = {
    general: join([t(p.examHeent), lbl("HEENT", p.focusedHeent)]),
    respiratory: t(p.focusedRespiratory),
    cvs: t(p.focusedCardiovascular),
    abdomen: t(p.focusedAbdomen),
    cns: t(p.focusedCns),
    extremities: join([t(p.focusedExtremities), lbl("Back", p.focusedBack)]),
  };
  const prevSurvey: Record<string, string | undefined> = { ...(c.secondarySurvey || {}) };
  const nextSurvey: Record<string, string | undefined> = { ...prevSurvey };
  for (const k of SECONDARY_SURVEY_KEYS) if (fromPeds[k]) nextSurvey[k] = fromPeds[k];

  // Rebuild the narrative string only when it is empty or was itself derived from the structured
  // survey; never overwrite free-text the doctor or extraction wrote.
  const prevString = typeof c.secondaryAssessment === "string" ? c.secondaryAssessment : "";
  const derivedFromPrev = prevString.trim() === "" || prevString.trim() === buildSecondaryAssessmentString(prevSurvey);
  const nextString = derivedFromPrev ? buildSecondaryAssessmentString(nextSurvey) : prevString;

  const changed =
    JSON.stringify(nextPa) !== JSON.stringify(prevPa) ||
    JSON.stringify(nextSurvey) !== JSON.stringify(prevSurvey) ||
    nextString !== prevString;
  if (!changed) return c;

  return { ...c, primaryAssessment: nextPa, secondarySurvey: nextSurvey as any, secondaryAssessment: nextString };
}
