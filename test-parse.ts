const text = "General: No pallor\nCVS: S1 S2 heard\nRS: normal";
const fields = { General: "", CVS: "", RS: "", PA: "", CNS: "", Extremities: "" };
const regex = /(General|CVS|RS|PA|CNS|Extremities)\s*:\s*(.*?)(?=(General|CVS|RS|PA|CNS|Extremities)\s*:|$)/igs;
let match;
while ((match = regex.exec(text)) !== null) {
  const key = Object.keys(fields).find(k => k.toLowerCase() === match[1].toLowerCase());
  if (key) fields[key] = match[2].trim();
}
console.log(fields);
