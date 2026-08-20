import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, PageOrientation, AlignmentType, HeadingLevel } from "docx";
import { ClinicalCase } from "../types";
import { isAbnormal, formatFlagged } from "../../server/clinicalRanges";
import { getAgeBand, ageToMonths, formatFlaggedForAge } from "../../server/pediatricClinicalRanges";

function getVitalsAlerts(c: ClinicalCase): string[] {
  const alerts: string[] = [];
  if (!c.vitals) return alerts;

  const isPed = Boolean(c.isPediatric);
  const age = c.patient.age;
  const ageMonths = ageToMonths(age);
  
  if (isPed) {
    if (c.vitals.hr && formatFlaggedForAge("hr", c.vitals.hr, ageMonths).includes("⚠")) alerts.push(`⚠ HR ${c.vitals.hr}`);
    if (c.vitals.rr && formatFlaggedForAge("rr", c.vitals.rr, ageMonths).includes("⚠")) alerts.push(`⚠ RR ${c.vitals.rr}`);
    if (c.vitals.bp && formatFlaggedForAge("sbp", c.vitals.bp.split("/")[0], ageMonths).includes("⚠")) alerts.push(`⚠ BP ${c.vitals.bp}`);
    if (c.vitals.spo2 && formatFlaggedForAge("spo2", c.vitals.spo2, ageMonths).includes("⚠")) alerts.push(`⚠ SpO2 ${c.vitals.spo2}%`);
    if (c.vitals.temp && formatFlaggedForAge("temp", c.vitals.temp, ageMonths).includes("⚠")) alerts.push(`⚠ Temp ${c.vitals.temp}`);
  } else {
    if (c.vitals.hr && isAbnormal("hr", parseFloat(c.vitals.hr as string))) alerts.push(`⚠ HR ${c.vitals.hr}`);
    if (c.vitals.rr && isAbnormal("rr", parseFloat(c.vitals.rr as string))) alerts.push(`⚠ RR ${c.vitals.rr}`);
    const sbp = c.vitals.bp ? parseFloat(c.vitals.bp.split("/")[0]) : null;
    if (sbp && isAbnormal("sbp", sbp)) alerts.push(`⚠ BP ${c.vitals.bp}`);
    if (c.vitals.spo2 && isAbnormal("spo2", parseFloat(c.vitals.spo2 as string))) alerts.push(`⚠ SpO2 ${c.vitals.spo2}%`);
    if (c.vitals.temp && isAbnormal("temp", parseFloat(c.vitals.temp as string))) alerts.push(`⚠ Temp ${c.vitals.temp}`);
  }
  return alerts;
}

export async function generateCompactRosterDocx(cases: ClinicalCase[]): Promise<Blob> {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ children: [new Paragraph({ text: "Bed", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Name / Age / Sex", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Alert Flags", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Working Dx", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Key Abnormal Values", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Pending Tasks", alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: "Plan (1 line)", alignment: AlignmentType.CENTER })] }),
      ],
    }),
  ];

  for (const c of cases) {
    const bed = c.bedNo || "N/A";
    const nameStr = `${c.patient.name}\n${c.patient.age || "?"}y / ${c.patient.gender || "?"}`;
    
    const alertFlags = getVitalsAlerts(c).join("\n");
    const workingDx = c.provisionalPrimaryDiagnosis || c.patient.presentingComplaint || "Under evaluation";
    
    // Key Abnormal Values - same as alert flags for now since vitals are the main ones.
    const keyAbnormals = alertFlags; 

    // Pending tasks
    const pendingTasksList = (c.dispositionAndPlan?.pendingInvestigations || []).filter(Boolean);
    const pendingTasks = pendingTasksList.length > 0 ? pendingTasksList.join("\n") : "None";

    const plan = c.dispositionAndPlan?.dispositionStatus || "Admit / Obs";

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: bed, alignment: AlignmentType.CENTER })] }),
          new TableCell({ children: nameStr.split('\n').map(t => new Paragraph(t)) }),
          new TableCell({ children: alertFlags ? alertFlags.split('\n').map(t => new Paragraph({ children: [new TextRun({ text: t, color: "FF0000", bold: true })] })) : [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph(workingDx)] }),
          new TableCell({ children: keyAbnormals ? keyAbnormals.split('\n').map(t => new Paragraph({ children: [new TextRun({ text: t, color: "FF0000", bold: true })] })) : [new Paragraph("")] }),
          new TableCell({ children: pendingTasks.split('\n').map(t => new Paragraph(t)) }),
          new TableCell({ children: [new Paragraph(plan)] }),
        ],
      })
    );
  }

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
        },
      },
      children: [
        new Paragraph({ text: "Doctors Shift Handover Roster", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, alignment: AlignmentType.CENTER }),
        new Paragraph(""), // blank line
        table,
      ],
    }],
  });

  return await Packer.toBlob(doc);
}

export async function generateDetailedPatientDocx(c: ClinicalCase): Promise<Blob> {
  const isPed = Boolean(c.isPediatric);
  const ageMonths = ageToMonths(c.patient.age);

  // Helper for Section Header
  const createSectionHeader = (title: string) => {
    return new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      border: { bottom: { color: "CCCCCC", space: 1, style: BorderStyle.SINGLE, size: 6 } }
    });
  };

  // Helper for labeled lines
  const createLabeledLine = (label: string, value: string, isAlert: boolean = false) => {
    return new Paragraph({
      spacing: { line: 360 }, // 1.5x line height
      children: [
        new TextRun({ text: `${label}: `, bold: true }),
        new TextRun({ text: value, color: isAlert ? "DC2626" : "000000", bold: isAlert })
      ]
    });
  };

  const getVal = (v: any) => v ? String(v) : "Not documented";

  const getVitalsFlag = (param: string, value: any): {text: string, alert: boolean} => {
    if (!value) return { text: "Not documented", alert: false };
    const num = parseFloat(String(value));
    if (isNaN(num)) return { text: String(value), alert: false };

    let flagStr = "";
    if (isPed) {
      // mapping param to ageband keys
      let pKey: any = param;
      if (param === "bp") pKey = "sbp"; // just use sbp for flagging bp
      flagStr = formatFlaggedForAge(pKey, value, ageMonths);
    } else {
      let pKey = param as any;
      if (param === "bp") pKey = "sbp";
      // formatFlagged uses ⚠️ instead of ⚠, the user asked for ⚠ or the symbol from the function
      flagStr = formatFlagged(pKey, num);
    }
    const isAlert = flagStr.includes("⚠") || flagStr.includes("⚠️");
    return { text: flagStr, alert: isAlert };
  };

  const hr = getVitalsFlag("hr", c.vitals?.hr);
  const rr = getVitalsFlag("rr", c.vitals?.rr);
  // for bp, split by / and check sbp
  const sbpStr = c.vitals?.bp ? c.vitals.bp.split("/")[0] : null;
  const bp = getVitalsFlag("bp", sbpStr ? sbpStr : null);
  // Re-attach original BP string if we got a flag
  if (c.vitals?.bp && bp.alert) {
    bp.text = `${c.vitals.bp} ⚠`;
  } else if (c.vitals?.bp) {
    bp.text = c.vitals.bp;
  }
  const spo2 = getVitalsFlag("spo2", c.vitals?.spo2);
  const temp = getVitalsFlag("temp", c.vitals?.temp);
  const gcs = c.vitals?.gcs ? { text: c.vitals.gcs, alert: false } : { text: "Not documented", alert: false };

  const children: any[] = [];

  // TITLE
  children.push(new Paragraph({ text: "Detailed Clinical Handover", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph(""));

  // SECTION 1 - HEADER TABLE
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
      left: { style: BorderStyle.NONE, size: 0, color: "000000" },
      right: { style: BorderStyle.NONE, size: 0, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "000000" }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Patient Name", bold: true, size: 16 })] }), new Paragraph({ text: getVal(c.patient.name) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Age/Sex", bold: true, size: 16 })] }), new Paragraph({ text: `${getVal(c.patient.age)} / ${getVal(c.patient.gender)}` })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "UHID", bold: true, size: 16 })] }), new Paragraph({ text: getVal(c.patient.uhid) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bed No.", bold: true, size: 16 })] }), new Paragraph({ text: getVal(c.bedNo) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Triage Category", bold: true, size: 16 })] }), new Paragraph({ text: getVal(c.patient.triageCategory) })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
        ]
      })
    ]
  });
  children.push(headerTable);
  children.push(new Paragraph(""));

  // SECTION 2 - INITIAL ASSESSMENT
  children.push(createSectionHeader("SECTION 2 — INITIAL ASSESSMENT"));
  
  const pa = c.primaryAssessment?.survey || {} as any;
  const airway = pa.airway?.status || pa.airway || "";
  const breathing = pa.breathing?.status || pa.breathing || "";
  const circulation = pa.circulation?.status || pa.circulation || "";
  const disability = pa.disability?.status || pa.disability || "";
  const exposure = pa.exposure?.status || pa.exposure || "";

  children.push(createLabeledLine("Airway", getVal(airway)));
  children.push(createLabeledLine("Breathing", getVal(breathing)));
  children.push(createLabeledLine("Circulation", getVal(circulation)));
  children.push(createLabeledLine("Disability", getVal(disability)));
  children.push(createLabeledLine("Exposure", getVal(exposure)));
  
  children.push(new Paragraph(""));
  children.push(new Paragraph({ children: [new TextRun({ text: "Vitals:", bold: true })] }));
  children.push(createLabeledLine("  HR", hr.text, hr.alert));
  children.push(createLabeledLine("  BP", bp.text, bp.alert));
  children.push(createLabeledLine("  SpO2", spo2.text, spo2.alert));
  children.push(createLabeledLine("  RR", rr.text, rr.alert));
  children.push(createLabeledLine("  Temp", temp.text, temp.alert));
  children.push(createLabeledLine("  GCS", gcs.text, gcs.alert));
  children.push(new Paragraph(""));

  // SECTION 3 - ADJUNCTS TO PRIMARY
  children.push(createSectionHeader("SECTION 3 — ADJUNCTS TO PRIMARY (Done)"));
  
  const adj = ((c.primaryAssessment as any)?.adjuncts) || {} as any;
  
  const ecgInterp = getVal(adj.ecgInterpretation);
  const ecgNotes = adj.ecgNotes ? ` — ${adj.ecgNotes}` : "";
  children.push(createLabeledLine("ECG", ecgInterp !== "Not documented" ? `${ecgInterp}${ecgNotes}` : "Not documented"));

  const echoInterp = getVal(adj.echoInterpretation);
  const echoNotes = adj.echoNotes ? ` — ${adj.echoNotes}` : "";
  children.push(createLabeledLine("Echo", echoInterp !== "Not documented" ? `${echoInterp}${echoNotes}` : "Not documented"));

  const abg = adj.abgValues || adj.vbgValues || {};
  let vbgRuns: any[] = [];
  
  const addVbgPart = (label: string, param: string, val: any) => {
    if (!val) return;
    const flag = getVitalsFlag(param, val);
    if (vbgRuns.length > 0) {
      vbgRuns.push(new TextRun({ text: " | " }));
    }
    vbgRuns.push(new TextRun({ text: `${label} ${flag.text}`, color: flag.alert ? "DC2626" : "000000", bold: flag.alert }));
  };

  addVbgPart("pH", "ph", abg.ph);
  addVbgPart("pCO2", "pco2", abg.pco2);
  addVbgPart("HCO3", "hco3", abg.hco3);
  addVbgPart("Lactate", "lactate", abg.lactate);

  if (vbgRuns.length === 0) {
    children.push(createLabeledLine("VBG/ABG", "Not documented"));
  } else {
    children.push(new Paragraph({
      spacing: { line: 360 },
      children: [
        new TextRun({ text: "VBG/ABG: ", bold: true }),
        ...vbgRuns
      ]
    }));
  }
  children.push(new Paragraph(""));
  // SECTION 4 - INVESTIGATIONS
  children.push(createSectionHeader("SECTION 4 — INVESTIGATIONS"));
  
  const invs = c.investigationResults || [];
  if (invs.length === 0) {
    children.push(new Paragraph("Not documented"));
  } else {
    const invRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Test Name", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Result", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Unit", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Flag", bold: true })] })] }),
        ]
      })
    ];

    for (const inv of invs) {
      let isAbn = Boolean(inv.isAbnormal);
      // Auto-check using isAbnormal if mapped to our ClinicalParam
      let mappedParam = inv.name.toLowerCase();
      // Try to flag using clinicalRanges if available
      const numResult = parseFloat(String(inv.value));
      if (!isNaN(numResult)) {
        if (mappedParam === "hemoglobin" || mappedParam === "hb") isAbn = isAbn || isAbnormal("hb" as any, numResult);
        if (mappedParam === "wbc") isAbn = isAbn || isAbnormal("wbc" as any, numResult);
        if (mappedParam === "creatinine") isAbn = isAbn || isAbnormal("creatinine" as any, numResult);
        if (mappedParam === "lactate") isAbn = isAbn || isAbnormal("lactate" as any, numResult);
      }
      
      const flagText = isAbn ? "⚠ ABNORMAL" : (inv.flag || "");
      
      invRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(inv.name || "")] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(inv.value || ""), color: isAbn ? "DC2626" : "000000", bold: isAbn })] })] }),
          new TableCell({ children: [new Paragraph(inv.unit || "")] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: flagText, color: isAbn ? "DC2626" : "000000", bold: isAbn })] })] }),
        ]
      }));
    }
    
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: invRows
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { orientation: PageOrientation.LANDSCAPE } }
      },
      children: children
    }]
  });

  return await Packer.toBlob(doc);
}
