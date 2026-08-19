const text = `
General: No pallor
CVS: S1 S2 heard.
Chest / RS: Normal chest expansion.
Per Abdomen (PA): Soft
CNS: Higher Mental Functions: Normal
Extremities: Normal
`;

const regex = /(?:^|\n)([\w\s/()-]+?)\s*:\s*(.*?)(?=(?:\n|$)(?:[\w\s/()-]+?)\s*:|$)/igs;
let match;
while ((match = regex.exec(text)) !== null) {
  console.log("Found:", match[1].trim(), "=>", match[2].trim());
}
