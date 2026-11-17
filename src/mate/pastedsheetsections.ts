
import { parsePastedSheetSections } from "./pastedsheetsections";

export function buildQuickCaseFieldsFromSheet(text: string) {
  const p = parsePastedSheetSections(text);

  const secondary = p.secondarySurvey || {};
  const secondaryLines = [
    ["General", secondary.general],
    ["CVS", secondary.cvs],
    ["RS", secondary.respiratory],
    ["Abdomen", secondary.abdomen],
    ["CNS", secondary.cns],
    ["Extremities", secondary.extremities],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);

  // Only documented results should be treated as results.
  // A test name alone is not proof that it was performed.
  const investigations = [
    ...(p.labs || []),
    ...(p.imaging || []),
  ]
    .filter((item) => item.name && item.value?.trim())
    .map((item, index) => ({
      id: `imported-investigation-${index}`,
      testName: item.name,
      result: item.value!.trim(),
      isAbnormal: false,
    }));

  const primaryAssessment = Object.fromEntries(
    (
      [
        "airway",
        "breathing",
        "circulation",
        "disability",
        "exposure",
      ] as const
    )
      .filter((key) => Boolean(p[key]))
      .map((key) => [key, p[key]])
  );

  return {
    patient: {
      ...(p.age ? { age: Number(p.age) } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
      ...(p.presentingComplaint
        ? { presentingComplaint: p.presentingComplaint }
        : {}),
    },
    vitals: p.vitals || {},
    sampleHistory: {
      ...(p.hpi ? { hpi: p.hpi } : {}),
      ...(p.symptoms ? { symptoms: p.symptoms } : {}),
      ...(p.pastMedicalHistory
        ? { pastHistory: p.pastMedicalHistory }
        : {}),
      ...(p.surgicalHistory
        ? { surgicalHistory: p.surgicalHistory }
        : {}),
      ...(p.familyHistory
        ? { familyHistory: p.familyHistory }
        : {}),
      ...(p.allergies ? { allergies: p.allergies } : {}),
    },
    primaryAssessment,
    secondaryAssessment: secondaryLines.join("\n"),
    investigations,
    differentialDiagnosis: p.differentialDiagnosis || "",
    managementPlan: p.managementPlan || "",
    disposition: p.disposition || "",
    found: Object.keys(p).length > 0,
  };
}
