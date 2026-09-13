const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceScribeChatView.tsx', 'utf8');

const helpers = `
function humanizeFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatExtractionEntryValue(key: string, val: any): string {
  if (key === "vbgAbg" && val && typeof val === "object") {
    const type = val.type ? \`\${val.type}: \` : "";
    const vals = Array.isArray(val.values)
      ? val.values
          .map((v: any) =>
            \`\${v.name ?? v.param ?? ""} \${v.value ?? ""}\`.trim()
          )
          .filter(Boolean)
          .join(", ")
      : "";

    return \`\${type}\${vals}\`.trim() || "—";
  }

  if (key === "chronologicalNotes" && Array.isArray(val)) {
    return val
      .map((n: any) => n?.entry ?? n)
      .filter(Boolean)
      .join("; ");
  }

  if (
    (key === "secondarySurvey" || key === "fastFindings") &&
    val &&
    typeof val === "object"
  ) {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => \`\${humanizeFieldLabel(k)}: \${String(v)}\`)
      .join(", ");
  }

  if (key === "mlcDetails" && val && typeof val === "object") {
    return Object.entries(val)
      .filter(([k, v]) =>
        k !== "isMlc" &&
        v !== null &&
        v !== undefined &&
        v !== ""
      )
      .map(([k, v]) => \`\${humanizeFieldLabel(k)}: \${String(v)}\`)
      .join(", ");
  }

  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (item && typeof item === "object") {
          return Object.values(item)
            .filter(v => v !== null && v !== undefined && v !== "")
            .join(" ");
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (val && typeof val === "object") {
    return Object.entries(val)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => \`\${humanizeFieldLabel(k)}: \${String(v)}\`)
      .join(", ");
  }

  return String(val);
}

function getDisplayableExtractionEntries(data: any): [string, any][] {`;

code = code.replace('function getDisplayableExtractionEntries(data: any): [string, any][] {', helpers);

fs.writeFileSync('src/components/VoiceScribeChatView.tsx', code);
console.log('Patched VoiceScribeChatView.tsx helpers');
