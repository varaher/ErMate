const text = `
CNS: Higher Mental Functions: Normal
CVS: S1 S2 heard
Respiratory System: Bilateral normal
Per Abdomen (PA): Soft
Head-to-Toe Trauma Exam: Cervical spine tenderness absent
`;
const regex = /(General|CVS|RS|Respiratory|Abdomen|PA|CNS|Psych|Extremities|Local Examination)\s*:\s*(.*?)(?=(General|CVS|RS|Respiratory|Abdomen|PA|CNS|Psych|Extremities|Local Examination)\s*:|$)/igs;
let match;
while ((match = regex.exec(text)) !== null) {
  console.log("Found:", match[1], "=>", match[2].trim());
}
