const text = `
General: No pallor CVS: S1 S2 heard. Chest / RS: Normal chest expansion.
Per Abdomen (PA): Soft
CNS: Higher Mental Functions: Normal
Extremities: Normal
Respiratory System: Bilateral normal
PA / Abdomen: Soft
`;

const terms = [
  "General", "CVS", "RS", "Respiratory", "Chest / RS", "Respiratory System",
  "Abdomen", "PA", "Per Abdomen \\(PA\\)", "PA / Abdomen", "Per Abdomen",
  "CNS", "Psych", "Extremities", "Local Examination", "Head-to-Toe Trauma Exam"
].join("|");

const regexStr = `(${terms})\\s*:\\s*(.*?)(?=(${terms})\\s*:|$)`;
const regex = new RegExp(regexStr, "ig");

let match;
while ((match = regex.exec(text)) !== null) {
  console.log("Found:", match[1].trim(), "=>", match[2].trim());
}
