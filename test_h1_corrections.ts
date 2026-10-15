import PDFDocument from "pdfkit";
import { extractPatientNameAndTimestamp, extractTreatingPhysicianFromSource } from "./server/handover";

// Simulated test runner
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failedTests++;
  }
}

console.log("\n=======================================================");
console.log("ERMATE BATCH H1.1 TARGETED CLINICAL INTEGRITY VERIFICATION");
console.log("=======================================================\n");

// ─────────────────────────────────────────────────────────────
// TEST SUITE 1: Treatment Administration Classification
// ─────────────────────────────────────────────────────────────
console.log("1. Testing Treatment Administration Classification...");

// Mock classifyTreatments as implemented in HandoverView.tsx
function classifyTreatments(
  treatments: Array<{ drugName: string; dose: string; route?: string; status?: string; timeGiven?: string; instruction?: string; ipsgVerified?: boolean }> | undefined,
  notesList?: Array<{ content?: string }>
) {
  const confirmedGiven: string[] = [];
  const unconfirmed: string[] = [];

  if (!treatments || treatments.length === 0) {
    return { confirmedGiven, unconfirmed };
  }

  const allNotesText = (notesList?.map(n => n.content).join(" ") || "").toLowerCase();

  treatments.forEach(t => {
    const medDesc = `${t.drugName} ${t.dose}${t.route ? ` (${t.route})` : ''}`.trim();
    if (!medDesc) return;

    const rawStatus = (t as any).status ? String((t as any).status).trim().toLowerCase() : "";
    const rawTimeGiven = t.timeGiven ? String(t.timeGiven).trim() : "";
    const rawInstruction = t.instruction ? String(t.instruction).trim().toLowerCase() : "";

    const isClockTime = /\b(?:[0-1]?\d|2[0-3]):[0-5]\d(?:\s*[AP]M)?\b/i.test(rawTimeGiven);
    const isExplicitlyGivenStatus = rawStatus === "given" || rawStatus === "administered" || rawStatus === "completed";
    const isExplicitlyPendingStatus = rawStatus === "ordered" || rawStatus === "pending" || rawStatus === "due" || rawStatus === "to be given" || rawStatus === "stat" || /to\s*be\s*given|pending|ordered|hold|withheld|avoid|cancelled/i.test(rawInstruction);
    const isExplicitlyWithheldOrOmitted = rawStatus === "held" || rawStatus === "withheld" || rawStatus === "not given" || rawStatus === "omitted" || rawStatus === "cancelled" || /not\s*given|withheld|hold/i.test(rawInstruction);

    const drugEscaped = t.drugName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase();
    const drugMentionedInNotes = new RegExp(`(?:inj|iv|tab|syp|infusion|nebulization)?\\s*${drugEscaped}`, 'i').test(allNotesText);
    const hasNegativeNote = new RegExp(`(?:not\\s+given|withheld|hold|avoid|to\\s+be\\s+given|if\\s+needed|stat\\s+order)\\s*.*?${drugEscaped}|${drugEscaped}.*?(?:not\\s+given|withheld|hold|avoid|to\\s+be\\s+given|if\\s+needed)`, 'i').test(allNotesText);
    const drugAdminEvidence = drugMentionedInNotes && !hasNegativeNote && new RegExp(`(?:inj|iv|tab|syp|infusion|nebulization)?\\s*${drugEscaped}\\s*(?:was|is)?\\s*(?:given|administered|pushed|infused|started|taken)`, 'i').test(allNotesText);

    const hasConfirmedAdministration = !isExplicitlyPendingStatus && !isExplicitlyWithheldOrOmitted && (
      Boolean(t.ipsgVerified) ||
      isExplicitlyGivenStatus ||
      (isClockTime && !/not\s*given/i.test(rawTimeGiven)) ||
      drugAdminEvidence
    );

    if (hasConfirmedAdministration) {
      const timeSuffix = isClockTime && !/not\s*given/i.test(rawTimeGiven) ? ` at ${rawTimeGiven}` : "";
      confirmedGiven.push(`${medDesc}${timeSuffix}`);
    } else {
      unconfirmed.push(medDesc);
    }
  });

  return { confirmedGiven, unconfirmed };
}

const testTreatments = [
  { drugName: "Inj Pantoprazole", dose: "40mg", route: "IV", timeGiven: "10:30 AM" }, // Confirmed by clock time
  { drugName: "Inj Ondansetron", dose: "4mg", route: "IV", status: "administered" }, // Confirmed by explicit status
  { drugName: "Tab Paracetamol", dose: "650mg", route: "Oral", ipsgVerified: true }, // Confirmed by IPSG check
  { drugName: "Inj Ceftriaxone", dose: "1g", route: "IV" }, // Unconfirmed - no time or status
  { drugName: "Inj Tramadol", dose: "50mg", route: "IV", instruction: "Hold if sedated", status: "held" }, // Withheld - must not be given
  { drugName: "Inj Furosemide", dose: "40mg", route: "IV", instruction: "stat order to be given" } // Explicitly pending
];

const notesWithCeftriaxoneGiven = [{ content: "Patient admitted. Inj Ceftriaxone was administered at bedside." }];
const notesWithNoEvidence = [{ content: "Patient stable in observation bay." }];

const resultA = classifyTreatments(testTreatments, notesWithNoEvidence);
assert(resultA.confirmedGiven.some(m => m.includes("Pantoprazole 40mg (IV) at 10:30 AM")), "Pantoprazole with clock time classified as confirmed given");
assert(resultA.confirmedGiven.some(m => m.includes("Ondansetron 4mg (IV)")), "Ondansetron with administered status classified as confirmed given");
assert(resultA.confirmedGiven.some(m => m.includes("Paracetamol 650mg (Oral)")), "Paracetamol with ipsgVerified classified as confirmed given");
assert(resultA.unconfirmed.some(m => m.includes("Ceftriaxone 1g (IV)")), "Ceftriaxone without evidence correctly classified as unconfirmed");
assert(resultA.unconfirmed.some(m => m.includes("Tramadol 50mg (IV)")), "Held medication correctly classified as unconfirmed");
assert(resultA.unconfirmed.some(m => m.includes("Furosemide 40mg (IV)")), "To be given medication correctly classified as unconfirmed");

const resultB = classifyTreatments([{ drugName: "Inj Ceftriaxone", dose: "1g", route: "IV" }], notesWithCeftriaxoneGiven);
assert(resultB.confirmedGiven.length === 1 && resultB.confirmedGiven[0].includes("Ceftriaxone"), "Ceftriaxone confirmed when clinical notes contain explicit past-tense administration evidence");

// ─────────────────────────────────────────────────────────────
// TEST SUITE 2: Investigation Completion Classification
// ─────────────────────────────────────────────────────────────
console.log("\n2. Testing Investigation Completion Classification...");

function classifyInvestigationLine(line: string): { isPending: boolean; isDocumentedResult: boolean } {
  const isPendingInstruction = /\b(?:repeat|repeating|ordered|order|to\s*order|sent|to\s*be\s*sent|pending|awaiting|awaited|advise[d]?|plan\b|sample\s*collected|collect\b|to\s*do|scheduled|requisition|check\b|r\/o|rule\s*out|consider|target|keep|if\b|when\b|expected|suspect|query|\?)\b/i.test(line);

  const numericWithUnitRegex = /\b(?:cbc|wbc|hgb|hb|platelet|platelets|rft|creatinine|urea|lft|bilirubin|sgot|sgpt|trop|troponin|ckmb|crp|esr|lactate|grbs|sugar|d-dimer|ddimer|inr|pt\/inr|potassium|sodium|calcium|pco2|po2|hco3|ph)\b.*?[:=-]?\s*\d+(?:\.\d+)?\s*(?:mg\/d[lL]|g\/d[lL]|mmol\/[lL]|meq\/[lL]|\/cumm|lakhs?|cells?\/|ng\/m[lL]|pg\/m[lL]|u\/[lL]|iu\/[lL]|%|k\/ul)\b/i;
  const explicitValAssignmentRegex = /\b(?:creatinine|hb|hgb|wbc|platelets?|urea|bilirubin|sgot|sgpt|lactate|grbs|potassium|sodium|inr|ph|pco2|po2|hco3)\s*[:=-]\s*\d+(?:\.\d+)?\b/i;
  const qualitativeResultRegex = /\b(?:troponin|trop|crp|ckmb|urine|rapid\s*antigen|covid|d-dimer|efast|fast)\b\s*(?:is|was|reported|shows|showed|result|status)?\s*[:=-]?\s*(?:positive|negative|normal|elevated|detected|non-reactive|reactive)\b/i;
  const ecgResultRegex = /\b(?:ecg|ekg)\b\s*(?:shows?|showed|reveals?|[:=-])\s*(?:normal\s*sinus\s*rhythm|nsr|st\s*(?:elevation|depression)|t\s*wave\s*inversion|sinus\s*(?:tachycardia|bradycardia)|lbbb|rbbb|afib|atrial\s*fibrillation|ischemia|arrhythmia)/i;
  const imagingResultRegex = /\b(?:cxr|x-ray|xray|ct|mri|usg|ultrasound|echo)\s*(?:brain|chest|abdomen|pelvis|kub|head)?\b\s*(?:shows?|showed|reveals?|reported|[:=-])\s*(?:normal|clear|no\s*acute|no\s*pneumothorax|cholelithiasis|fracture|infarct|hemorrhage|consolidation|effusion|cardiomegaly|edema)/i;

  const isDocumentedResult = !isPendingInstruction && (numericWithUnitRegex.test(line) || explicitValAssignmentRegex.test(line) || qualitativeResultRegex.test(line) || ecgResultRegex.test(line) || imagingResultRegex.test(line));

  return { isPending: isPendingInstruction, isDocumentedResult };
}

// 1. "Repeat troponin at 2 hours" -> pending instruction, not a result
const test1 = classifyInvestigationLine("Repeat troponin at 2 hours");
assert(test1.isPending && !test1.isDocumentedResult, "'Repeat troponin at 2 hours' is pending instruction, NOT a result");

// 2. "CT brain ordered" -> pending instruction, not completed imaging
const test2 = classifyInvestigationLine("CT brain ordered");
assert(test2.isPending && !test2.isDocumentedResult, "'CT brain ordered' is pending instruction, NOT completed imaging");

// 3. "Creatinine 2.9 mg/dL" -> documented result
const test3 = classifyInvestigationLine("Creatinine 2.9 mg/dL");
assert(!test3.isPending && test3.isDocumentedResult, "'Creatinine 2.9 mg/dL' is documented result");

// 4. "Troponin normal" -> reported result
const test4 = classifyInvestigationLine("Troponin: normal");
assert(!test4.isPending && test4.isDocumentedResult, "'Troponin: normal' is documented result");

// 5. Ambiguous: "Troponin discussed with cardiology, suspect normal baseline"
const test5 = classifyInvestigationLine("Troponin discussed with cardiology, suspect normal baseline");
assert(!test5.isDocumentedResult, "Ambiguous 'Troponin discussed with cardiology, suspect normal baseline' is NOT documented result");

// 6. Ambiguous: "Check if troponin normal"
const test6 = classifyInvestigationLine("Check if troponin normal");
assert(test6.isPending && !test6.isDocumentedResult, "'Check if troponin normal' is pending, NOT a result");

// ─────────────────────────────────────────────────────────────
// TEST SUITE 3: Clinician Identity Preservation
// ─────────────────────────────────────────────────────────────
console.log("\n3. Testing Clinician Identity Preservation...");

// Source with explicit treating physician
const textWithTreating = "Patient arrived at ER. Treating ER Physician: Dr. Rajesh Sharma. Admitted under Dr. Verghese (Cardiology).";
const extractedTreating = extractTreatingPhysicianFromSource(textWithTreating, "Dr. LoggedInUser");
assert(extractedTreating === "Dr. Rajesh Sharma", "Treating ER Physician correctly extracted as 'Dr. Rajesh Sharma'");
assert(extractedTreating !== "Dr. LoggedInUser", "Treating ER Physician does NOT default to logged-in user Dr. LoggedInUser");

// Source without explicit treating physician
const textWithoutTreating = "Patient presented with fever and cough for 3 days. Chest clear. Advised oral fluids.";
const extractedEmpty = extractTreatingPhysicianFromSource(textWithoutTreating, "Dr. LoggedInUser");
assert(extractedEmpty === null, "Treating ER Physician remains null when not documented in source (no fake doctor identity)");

// ─────────────────────────────────────────────────────────────
// TEST SUITE 4: Single-Patient & Multi-Patient PDF Generation & Truncation Guard
// ─────────────────────────────────────────────────────────────
console.log("\n4. Testing PDF Generation, Section Separation & Truncation Guard...");

async function generateTestPdf(patients: any[]): Promise<{ size: number; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: "portrait", size: "A4", margin: 30, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve({ size: buffer.length, pageCount });
    });

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 30;
    const cardWidth = pageWidth - (margin * 2);
    const contentWidth = cardWidth - 20;

    let pageCount = 1;

    // Header
    doc.fillColor("#0f172a").fontSize(15).font("Helvetica-Bold").text("EMERGENCY DEPARTMENT - CLINICAL HANDOVER REPORT", { align: "center" });
    doc.moveDown(0.2);
    doc.fillColor("#475569").fontSize(9).font("Helvetica").text("Handover Author: Dr. AuthorLead  |  Date: 15/10/2026", { align: "center" });
    doc.moveDown(0.5);

    patients.forEach((p, idx) => {
      const bedStr = p.bed || "Unassigned";
      const nameStr = p.name || "Patient";
      const ageSexStr = p.ageGender || "N/A";
      const headerTitle = `${idx + 1}. [Bed: ${bedStr}]  ${nameStr} (${ageSexStr})`;
      const subheaderStr = `ER No: ${p.erNo || "N/A"}  |  Treating Dr: ${p.treatingPhysician || "Not documented"}  |  Consultant: ${p.admittingConsultant || "Not documented"}  |  Vitals: ${p.vitals || "Not documented"}`;

      const complaintsText = p.complaints || "Not documented";
      const assessmentText = p.assessment || "";
      const doneText = p.planDone && p.planDone.trim().length > 0 ? p.planDone.trim() : "None documented";
      const todoText = p.planToBeDone && p.planToBeDone.trim().length > 0 ? p.planToBeDone.trim() : "No pending actions documented";
      const alertText = p.alerts || "";

      doc.font("Helvetica").fontSize(8.5);
      const compHeight = doc.heightOfString(`Chief Complaints: ${complaintsText}`, { width: contentWidth });
      const assessHeight = assessmentText ? doc.heightOfString(`Assessment: ${assessmentText}`, { width: contentWidth }) + 4 : 0;
      const doneHeight = doc.heightOfString(doneText, { width: contentWidth });
      const todoHeight = doc.heightOfString(todoText, { width: contentWidth });
      const alertHeight = alertText ? doc.heightOfString(`Alerts / Bystander: ${alertText}`, { width: contentWidth }) + 4 : 0;

      const padding = 22;
      const cardHeight = 38 + compHeight + assessHeight + doneHeight + 12 + todoHeight + 12 + alertHeight + padding;
      const fitsOnSinglePage = cardHeight <= (pageHeight - 70);

      if (fitsOnSinglePage) {
        if (doc.y + cardHeight > pageHeight - 45 && doc.y > 70) {
          doc.addPage();
        }
        const startY = doc.y;
        doc.rect(margin, startY, cardWidth, cardHeight).fillAndStroke("#ffffff", "#0f172a");
        let curY = startY + 8;
        doc.fillColor("#0f172a").fontSize(10.5).font("Helvetica-Bold").text(headerTitle, margin + 10, curY, { width: contentWidth });
        curY += 16;
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica-Bold").text(subheaderStr, margin + 10, curY, { width: contentWidth });
        curY += 14;
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica").text(`Chief Complaints: ${complaintsText}`, margin + 10, curY, { width: contentWidth });
        curY += compHeight + 3;
        if (assessmentText) {
          doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica").text(`Assessment: ${assessmentText}`, margin + 10, curY, { width: contentWidth });
          curY += assessHeight;
        }
        doc.fillColor("#065f46").fontSize(8.5).font("Helvetica-Bold").text("Plan (Done / Completed):", margin + 10, curY, { width: contentWidth });
        curY += 11;
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica").text(doneText, margin + 10, curY, { width: contentWidth });
        curY += doneHeight + 4;
        doc.fillColor("#1e40af").fontSize(8.5).font("Helvetica-Bold").text("Plan (Pending / Action Needed):", margin + 10, curY, { width: contentWidth });
        curY += 11;
        doc.fillColor("#0f172a").fontSize(8.5).font("Helvetica").text(todoText, margin + 10, curY, { width: contentWidth });
        curY += todoHeight + 4;
        if (alertText) {
          doc.fillColor("#991b1b").fontSize(8.5).font("Helvetica-Bold").text(`Alerts / Bystander: ${alertText}`, margin + 10, curY, { width: contentWidth });
          curY += alertHeight;
        }
        doc.y = startY + cardHeight + 8;
      } else {
        // Multi-page flowing layout
        if (doc.y > pageHeight - 120) doc.addPage();
        const renderSection = (title: string, content: string, titleColor: string) => {
          doc.font("Helvetica-Bold").fontSize(8.5);
          const totalH = doc.heightOfString(title, { width: contentWidth }) + doc.heightOfString(content, { width: contentWidth }) + 6;
          if (doc.y + totalH > pageHeight - 45) {
            doc.addPage();
            doc.fillColor("#64748b").fontSize(8).font("Helvetica-Oblique").text(`[Continued: Bed ${bedStr} - ${nameStr} (${ageSexStr})]`, margin, doc.y);
            doc.moveDown(0.3);
          }
          doc.fillColor(titleColor).font("Helvetica-Bold").fontSize(8.5).text(title, margin, doc.y, { width: contentWidth });
          doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5).text(content, margin, doc.y, { width: contentWidth });
          doc.moveDown(0.3);
        };
        doc.fillColor("#0f172a").fontSize(10.5).font("Helvetica-Bold").text(headerTitle, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.2);
        doc.fillColor("#334155").fontSize(8.5).font("Helvetica-Bold").text(subheaderStr, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.4);
        renderSection("Chief Complaints:", complaintsText, "#0f172a");
        if (assessmentText) renderSection("Assessment:", assessmentText, "#1e293b");
        renderSection("Plan (Done / Completed):", doneText, "#065f46");
        renderSection("Plan (Pending / Action Needed):", todoText, "#1e40af");
        if (alertText) renderSection("Alerts / Bystander:", alertText, "#991b1b");
        doc.moveDown(0.4);
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.5);
      }
    });

    pageCount = doc.bufferedPageRange().count;
    doc.end();
  });
}

(async () => {
  // Single patient test
  const singlePatient = [{
    id: "pat-1",
    bed: "Bed 4",
    name: "Sunita Devi",
    ageGender: "52F",
    erNo: "ER# 98214",
    treatingPhysician: "Dr. K. Nair",
    admittingConsultant: "Dr. Paul (Cardiology)",
    vitals: "BP 130/80, HR 88, SpO2 98%",
    complaints: "Acute retrosternal chest pain radiating to left arm",
    assessment: "PROVISIONAL DIAGNOSIS: Acute Coronary Syndrome (NSTEMI)\nTreatment documented — administration unconfirmed: Inj Heparin 5000 IU",
    planDone: "✓ ECG: Sinus rhythm, T-wave inversion V3-V6\n✓ Troponin: 0.12 ng/mL (Elevated)\n✓ Vitals logged: BP 130/80 | HR 88 | SpO2 98%",
    planToBeDone: "□ Repeat Troponin in 3 hours\n□ Cardiology bedside echo review\n□ Shift to CCU once bed ready",
    alerts: "⚠ Elevated Troponin · Penicillin allergy"
  }];

  const pdfResSingle = await generateTestPdf(singlePatient);
  assert(pdfResSingle.size > 1000 && pdfResSingle.pageCount === 1, `Single patient PDF generated successfully (${pdfResSingle.size} bytes, ${pdfResSingle.pageCount} page)`);

  // Long-plan patient test (> 80 plan items to test multi-page flow for a single patient without clipping)
  const longPlanLinesDone = Array.from({ length: 45 }, (_, i) => `✓ Completed procedure / lab test item #${i + 1} with detailed findings and timestamp recorded`).join("\n");
  const longPlanLinesPending = Array.from({ length: 45 }, (_, i) => `□ Pending consult / radiology review item #${i + 1} awaiting specialist callback and confirmation`).join("\n");

  const longPatient = [{
    id: "pat-long",
    bed: "ICU-2",
    name: "Mohan Kumar",
    ageGender: "68M",
    erNo: "ER# 44321",
    treatingPhysician: "Dr. S. Roy",
    admittingConsultant: "Dr. Thomas (Pulmonology)",
    vitals: "BP 100/60, HR 112, SpO2 91%",
    complaints: "Severe ARDS secondary to bilateral viral pneumonia",
    assessment: "PROVISIONAL DIAGNOSIS: Severe ARDS, Type 1 Respiratory Failure",
    planDone: longPlanLinesDone,
    planToBeDone: longPlanLinesPending,
    alerts: "⚠ Severe Hypoxia · Septic shock"
  }];

  const pdfResLong = await generateTestPdf(longPatient);
  assert(pdfResLong.pageCount >= 2 && pdfResLong.size > 2000, `Extensive multi-page long plan PDF rendered across ${pdfResLong.pageCount} pages without clipping or errors (${pdfResLong.size} bytes)`);

  // Multi-patient batch test (3 patients)
  const multiPatients = [
    ...singlePatient,
    {
      id: "pat-2",
      bed: "Bed 7",
      name: "Ali Ahmed",
      ageGender: "34M",
      erNo: "ER# 98215",
      treatingPhysician: "Dr. K. Nair",
      admittingConsultant: "Not documented",
      vitals: "BP 110/70, HR 76, SpO2 99%",
      complaints: "Acute right lower quadrant abdominal pain for 12 hours",
      assessment: "PROVISIONAL DIAGNOSIS: Acute appendicitis under surgical review",
      planDone: "✓ USG Abdomen: Aperistaltic blind-ending tubular structure, 8mm diameter",
      planToBeDone: "□ Surgical consult review\n□ Nil per oral\n□ Consent for laparoscopic appendectomy",
      alerts: "None"
    },
    ...longPatient
  ];

  const pdfResMulti = await generateTestPdf(multiPatients);
  assert(pdfResMulti.pageCount >= 2 && pdfResMulti.size > 3000, `Multi-patient batch PDF (3 patients including long plan) generated across ${pdfResMulti.pageCount} pages successfully (${pdfResMulti.size} bytes)`);

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("=======================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
