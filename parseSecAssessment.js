function parseSecondaryAssessment(text) {
  if (!text) return { General: "", CVS: "", RS: "", PA: "", CNS: "", Extremities: "" };
  const fields = { General: "", CVS: "", RS: "", PA: "", CNS: "", Extremities: "" };
  const regex = /(General|CVS|RS|PA|CNS|Extremities)\s*:\s*(.*?)(?=(General|CVS|RS|PA|CNS|Extremities)\s*:|$)/igs;
  let match;
  let found = false;
  while ((match = regex.exec(text)) !== null) {
    const key = Object.keys(fields).find(k => k.toLowerCase() === match[1].toLowerCase());
    if (key) { fields[key] = match[2].trim(); found = true; }
  }
  if (!found && text.trim()) fields.General = text.trim();
  return fields;
}
console.log(parseSecondaryAssessment("General: Cervical spine tenderness absent\n\nCVS: S1 S2 heard"));
