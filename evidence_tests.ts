import { cleanExtractionOutput } from "./server/extractionCleanup.js";

// Test 1: Treatment Structure
const raw1 = { drugs: [{ drugName: "Tranexamic acid", dose: "1 g", route: "IV", timeGiven: "stat" }] };
const raw2 = { drugs: [{ drugName: "Tranexamic acid", dose: "1 g", route: "IV", timeGiven: "08:42" }] };
console.log("TREATMENT 1:", JSON.stringify(cleanExtractionOutput(raw1 as any).drugs, null, 2));
console.log("TREATMENT 2:", JSON.stringify(cleanExtractionOutput(raw2 as any).drugs, null, 2));

// Test 2: C-Spine
function testCSpine(cSpineExam: string | null, exposure: string | null) {
  let raw: any = { cSpineExam, exposure };
  
  if (typeof raw.cSpineExam === 'string' && raw.cSpineExam.trim().length > 0 && typeof raw.exposure === 'string' && raw.exposure.trim().length > 0) {
    const cSpineFrag = raw.cSpineExam;
    if (raw.exposure.includes(cSpineFrag)) {
      let e = raw.exposure.replace(cSpineFrag, "");
      e = e.replace(/,\s*,/g, ",");
      e = e.replace(/^,\s*/, "");
      e = e.replace(/,\s*$/, "");
      e = e.trim();
      raw.exposure = e.length > 0 ? e : null;
    } else {
      const cSpineLower = cSpineFrag.toLowerCase().replace(/\.$/, "");
      if (raw.exposure.toLowerCase().includes(cSpineLower)) {
        const regex = new RegExp(cSpineLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        let e = raw.exposure.replace(regex, "");
        e = e.replace(/,\s*,/g, ",");
        e = e.replace(/^,\s*/, "");
        e = e.replace(/,\s*$/, "");
        e = e.trim();
        raw.exposure = e.length > 0 ? e : null;
      }
    }
  }
  return raw.exposure;
}

console.log("ACTUAL EXECUTED DEDUPLICATION TEST");
console.log("A. Expected: right-sided chest tenderness, left thigh deformity, abrasions over both forearms");
console.log("   Actual  :", testCSpine("C-spine tenderness", "C-spine tenderness, right-sided chest tenderness, left thigh deformity, abrasions over both forearms"));
console.log("B. Expected: Abrasions over chin and chest");
console.log("   Actual  :", testCSpine("No C-spine tenderness", "Abrasions over chin and chest"));
console.log("C. Expected: Neck abrasion, left thigh deformity");
console.log("   Actual  :", testCSpine("Cervical spine non-tender", "Neck abrasion, left thigh deformity"));
console.log("D. Expected: Chest tenderness, lower abdominal tenderness");
console.log("   Actual  :", testCSpine("Midline cervical spine tenderness", "Chest tenderness, lower abdominal tenderness"));

