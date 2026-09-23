import { 
  ProcedureNote, 
  ProcedureMetadata,
  FoleyCatheterData,
  CentralLineData,
  ArterialLineData,
  RsiIntubationData,
  ClosedReductionData,
  ShortArmSlabData,
  RylesTubeData
} from "../types/procedureNotes";

/**
 * Deterministically generates a clinical procedure note narrative.
 * 
 * STRICT SAFETY RULE:
 * Text must NEVER automatically assert clinical facts.
 * Never write:
 * - "Informed consent obtained"
 * - "No complications"
 * - "Patient tolerated well"
 * - "Neurovascular status intact"
 * - "Ultrasound guidance used"
 * - "Position confirmed"
 * UNLESS explicitly selected/confirmed by the clinician.
 * Not confirmed = not documented.
 */
export function generateProcedureNarrative(
  procedureName: string,
  metadata: ProcedureMetadata,
  dataPayload: ProcedureNote["data"]
): string {
  const sections: string[] = [];

  // Header / Administrative
  const adminParts: string[] = [];
  if (metadata.date || metadata.time) {
    adminParts.push(`Date/Time: ${[metadata.date, metadata.time].filter(Boolean).join(" ")}`);
  }
  if (metadata.performedBy) {
    adminParts.push(`Operator: ${metadata.performedBy}`);
  }
  if (metadata.assistant) {
    adminParts.push(`Assistant: ${metadata.assistant}`);
  }
  if (adminParts.length > 0) {
    sections.push(adminParts.join(" | "));
  }

  // Indication
  if (metadata.indication && metadata.indication.trim()) {
    sections.push(`Indication: ${metadata.indication.trim()}`);
  }

  // Consent
  const consentText = (() => {
    switch (metadata.consent) {
      case "obtained":
        return "Consent: Informed consent obtained from patient / surrogate after explaining risks, benefits, and alternatives.";
      case "emergency_implied":
        return "Consent: Emergency / implied consent invoked due to acute life-threatening / clinical emergency.";
      case "not_applicable":
        return "Consent: Not applicable.";
      case "not_documented":
      default:
        return "Consent: Not documented.";
    }
  })();
  sections.push(consentText);

  // Procedure-Specific Findings
  switch (dataPayload.type) {
    case "foley_catheter": {
      const f: FoleyCatheterData = dataPayload.fields;
      const details: string[] = [];
      if (f.catheterSize) details.push(`Catheter: ${f.catheterSize} Foley catheter`);
      if (f.balloonVolumeMl) details.push(`Balloon inflation: ${f.balloonVolumeMl}`);
      if (f.urineReturn) details.push(`Urine return: ${f.urineReturn}`);
      if (f.secured) {
        details.push(typeof f.secured === "string" ? `Securing: ${f.secured}` : "Catheter secured to thigh without tension");
      }
      if (f.drainageBag) {
        details.push(typeof f.drainageBag === "string" ? `Drainage: ${f.drainageBag}` : "Connected to dependent sterile drainage bag");
      }
      if (details.length > 0) {
        sections.push(`Procedure Details:\n- ${details.join("\n- ")}`);
      }
      if (f.plan) {
        sections.push(`Plan: ${f.plan}`);
      }
      break;
    }

    case "central_line": {
      const c: CentralLineData = dataPayload.fields;
      const details: string[] = [];
      const siteDesc = [c.side, c.site ? `${c.site} vein` : null].filter(Boolean).join(" ");
      if (siteDesc) details.push(`Site: ${siteDesc}`);
      if (c.catheterType) details.push(`Catheter: ${c.catheterType}`);
      if (c.ultrasoundGuidance && c.ultrasoundGuidance !== "Not documented") {
        details.push(`Guidance: ${c.ultrasoundGuidance}`);
      }
      if (c.localAnaesthesia) details.push(`Local anesthesia: ${c.localAnaesthesia}`);
      if (c.depthCm) details.push(`Depth at skin: ${c.depthCm}`);
      if (c.bloodAspiration) {
        details.push(typeof c.bloodAspiration === "string" ? `Aspiration: ${c.bloodAspiration}` : "Free non-pulsatile dark venous blood aspirated");
      }
      if (c.lumensFlushed) {
        details.push(typeof c.lumensFlushed === "string" ? `Lumens: ${c.lumensFlushed}` : "All lumens aspirated and flushed with sterile saline");
      }
      if (c.secured) details.push(`Securing & Dressing: ${c.secured}`);
      if (c.positionConfirmed) details.push(`Position Verification: ${c.positionConfirmed}`);

      if (details.length > 0) {
        sections.push(`Procedure Details:\n- ${details.join("\n- ")}`);
      }
      break;
    }

    case "arterial_line": {
      const a: ArterialLineData = dataPayload.fields;
      const details: string[] = [];
      const siteDesc = [a.side, a.site ? `${a.site} artery` : null].filter(Boolean).join(" ");
      if (siteDesc) details.push(`Site: ${siteDesc}`);
      if (a.ultrasoundGuidance && a.ultrasoundGuidance !== "Not documented") {
        details.push(`Guidance: ${a.ultrasoundGuidance}`);
      }
      if (a.localAnaesthesia) details.push(`Local anesthesia: ${a.localAnaesthesia}`);
      if (a.arterialWaveform) details.push(`Pulsation / Waveform: ${a.arterialWaveform}`);
      if (a.openingBp) details.push(`Opening invasive BP: ${a.openingBp}`);
      if (a.secured) details.push(`Securing & Dressing: ${a.secured}`);

      if (details.length > 0) {
        sections.push(`Procedure Details:\n- ${details.join("\n- ")}`);
      }
      break;
    }

    case "rsi_intubation": {
      const r: RsiIntubationData = dataPayload.fields;
      const details: string[] = [];
      if (r.preoxygenation) details.push(`Preoxygenation: ${r.preoxygenation}`);
      if (r.inductionDrug) details.push(`Induction: ${r.inductionDrug}`);
      if (r.paralyticDrug) details.push(`Paralytic: ${r.paralyticDrug}`);
      if (r.device) details.push(`Laryngoscopy device: ${r.device}`);
      if (r.cormackLehaneGrade && r.cormackLehaneGrade !== "Not documented") {
        details.push(`Laryngeal view: ${r.cormackLehaneGrade}`);
      }
      if (r.etTubeSize) details.push(`Endotracheal tube: ${r.etTubeSize}`);
      if (r.depthCm) details.push(`Depth: ${r.depthCm}`);
      if (r.etco2Confirmed) {
        details.push(typeof r.etco2Confirmed === "string" ? `ETCO2: ${r.etco2Confirmed}` : "End-tidal CO2 confirmed with sustained waveform capnography / colorimetric detector");
      }
      if (r.chestRise) {
        details.push(typeof r.chestRise === "string" ? `Chest rise: ${r.chestRise}` : "Equal bilateral chest rise observed");
      }
      if (r.auscultation) details.push(`Auscultation: ${r.auscultation}`);
      if (r.postIntubationVentilation) details.push(`Ventilation: ${r.postIntubationVentilation}`);
      if (r.postIntubationSedation) details.push(`Post-intubation sedation: ${r.postIntubationSedation}`);

      if (details.length > 0) {
        sections.push(`Intubation Details:\n- ${details.join("\n- ")}`);
      }
      break;
    }

    case "closed_reduction": {
      const cr: ClosedReductionData = dataPayload.fields;
      const details: string[] = [];
      if (cr.diagnosis) details.push(`Diagnosis: ${cr.diagnosis}`);
      if (cr.site) details.push(`Site: ${cr.site}`);
      if (cr.anesthesiaSedation) details.push(`Anesthesia / Analgesia: ${cr.anesthesiaSedation}`);
      if (cr.preNeurovascularStatus) details.push(`Pre-reduction neurovascular status: ${cr.preNeurovascularStatus}`);
      if (cr.procedureDetails) details.push(`Reduction maneuver: ${cr.procedureDetails}`);
      if (cr.postNeurovascularStatus) details.push(`Post-reduction neurovascular status: ${cr.postNeurovascularStatus}`);
      if (cr.immobilization) details.push(`Immobilization: ${cr.immobilization}`);
      if (cr.imagingConfirmation) details.push(`Check imaging: ${cr.imagingConfirmation}`);

      if (details.length > 0) {
        sections.push(`Reduction Details:\n- ${details.join("\n- ")}`);
      }
      if (cr.plan) {
        sections.push(`Plan: ${cr.plan}`);
      }
      break;
    }

    case "short_arm_slab": {
      const s: ShortArmSlabData = dataPayload.fields;
      const details: string[] = [];
      const siteDesc = [s.side, s.site || "distal upper limb"].filter(Boolean).join(" ");
      if (siteDesc) details.push(`Site: ${siteDesc}`);
      if (s.padding) details.push(`Padding: ${s.padding}`);
      if (s.extent) details.push(`Extent: ${s.extent}`);
      if (s.position) details.push(`Position: ${s.position}`);
      if (s.postNeurovascularCheck) details.push(`Post-application neurovascular status: ${s.postNeurovascularCheck}`);

      if (details.length > 0) {
        sections.push(`Splinting Details:\n- ${details.join("\n- ")}`);
      }
      if (s.plan) {
        sections.push(`Plan & Precautions: ${s.plan}`);
      }
      break;
    }

    case "ryles_tube": {
      const rt: RylesTubeData = dataPayload.fields;
      const details: string[] = [];
      if (rt.tubeSize) details.push(`Tube size: ${rt.tubeSize} Ryles / NG tube`);
      if (rt.nostril) details.push(`Nostril: ${rt.nostril} naris`);
      if (rt.insertionLengthCm) details.push(`Insertion length: ${rt.insertionLengthCm}`);
      if (rt.confirmationMethod) details.push(`Position confirmation: ${rt.confirmationMethod}`);
      if (rt.secured) details.push(`Securing: ${rt.secured}`);

      if (details.length > 0) {
        sections.push(`Insertion Details:\n- ${details.join("\n- ")}`);
      }
      if (rt.plan) {
        sections.push(`Plan: ${rt.plan}`);
      }
      break;
    }

    default: {
      const genericFields = (dataPayload as any).fields || {};
      const pairs = Object.entries(genericFields)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`);
      if (pairs.length > 0) {
        sections.push(`Details:\n- ${pairs.join("\n- ")}`);
      }
      break;
    }
  }

  // Attempts
  if (metadata.attempts !== undefined && metadata.attempts !== null && metadata.attempts !== "") {
    sections.push(`Attempts: ${metadata.attempts}`);
  }

  // Complications
  const complicationText = (() => {
    switch (metadata.complications) {
      case "none_observed":
        return "Complications: None observed during or immediately following the procedure.";
      case "present":
        return `Complications: ${metadata.complicationDetails || "Complication noted (details pending documentation)."}`;
      case "not_documented":
      default:
        return "Complications: Not documented.";
    }
  })();
  sections.push(complicationText);

  // Additional Notes
  if (metadata.additionalNotes && metadata.additionalNotes.trim()) {
    sections.push(`Additional Notes: ${metadata.additionalNotes.trim()}`);
  }

  return sections.join("\n\n");
}
