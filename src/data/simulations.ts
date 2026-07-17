/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimulationStep {
  id: string;
  text: string;
  options: {
    text: string;
    nextStepId: string;
    feedback: string;
    scoreChange: number;
  }[];
}

export interface SimulationCase {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  vitals: {
    bp: string;
    hr: string;
    spo2: string;
    rr: string;
    temp: string;
  };
  initialState: string;
  steps: { [key: string]: SimulationStep };
  debrief: string;
}

export const SIMULATION_CASES: SimulationCase[] = [
  {
    id: "chest-pain",
    title: "Acute Chest Pain in a Hypertensive Male",
    description: "A 52-year-old male presents with crushing retrosternal chest pain radiating to his left shoulder. He is diaphoretic and anxious.",
    difficulty: "Intermediate",
    vitals: {
      bp: "178/96",
      hr: "98",
      spo2: "95",
      rr: "20",
      temp: "98.1"
    },
    initialState: "The patient is clenching his chest (Levine's sign). You must initiate the primary evaluation.",
    steps: {
      start: {
        id: "start",
        text: "What is your immediate first step for this patient?",
        options: [
          {
            text: "Obtain a 12-lead ECG and apply high-flow oxygen",
            nextStepId: "ecg_done",
            feedback: "Correct! Obtaining an ECG within 10 minutes of arrival is a Class I recommendation. Oxygen is indicated for SpO2 < 94% or distress.",
            scoreChange: 10
          },
          {
            text: "Give 10mg Morphine IV immediately for severe pain",
            nextStepId: "morphine_first",
            feedback: "Caution: Morphine should only be given after confirming the diagnosis on ECG and after nitrates, as it can mask symptoms or cause hypotension.",
            scoreChange: -5
          },
          {
            text: "Order an immediate CT pulmonary angiogram to rule out PE",
            nextStepId: "ct_first",
            feedback: "Premature: Rule out STEMI first via non-invasive, instant bed-side diagnostics like an ECG before sending a potentially unstable patient to CT.",
            scoreChange: -10
          }
        ]
      },
      ecg_done: {
        id: "ecg_done",
        text: "The ECG is obtained within 4 minutes. It reveals 3mm ST-segment elevation in leads V1-V4. What is your diagnosis and immediate pharmacotherapy?",
        options: [
          {
            text: "Anterior STEMI; administer Aspirin 325mg (chewed) and Clopidogrel 300mg",
            nextStepId: "reperfusion_decision",
            feedback: "Excellent! Aspirin and P2Y12 inhibitors are mandatory loading doses for acute ST-elevation myocardial infarction to inhibit platelet aggregation.",
            scoreChange: 15
          },
          {
            text: "Aortic Dissection; start high-dose beta-blocker infusion",
            nextStepId: "wrong_diagnosis",
            feedback: "Incorrect. The ST elevations clearly indicate myocardial injury of the anterior wall. Beta blockers can be harmful if he's in cardiogenic shock.",
            scoreChange: -15
          },
          {
            text: "Pericarditis; give high-dose Ibuprofen and Colchicine",
            nextStepId: "wrong_diagnosis",
            feedback: "Incorrect. V1-V4 focal ST elevation is highly specific for LAD occlusion. Delaying reperfusion for pericarditis therapy is fatal.",
            scoreChange: -15
          }
        ]
      },
      morphine_first: {
        id: "morphine_first",
        text: "The patient's blood pressure drops to 90/50 after Morphine. He remains chest-pain free but looks pale. What do you do now?",
        options: [
          {
            text: "Give a 250ml Normal Saline bolus and order a 12-lead ECG",
            nextStepId: "ecg_done",
            feedback: "Good catch. Restoring preload helps stabilize his blood pressure. Always get the ECG immediately.",
            scoreChange: 5
          },
          {
            text: "Intubate the patient and start Adrenaline",
            nextStepId: "wrong_diagnosis",
            feedback: "Too aggressive. The hypotension is likely relative to morphinization or right ventricular involvement. Try fluids first.",
            scoreChange: -10
          }
        ]
      },
      ct_first: {
        id: "ct_first",
        text: "In the CT scanner, the patient becomes unresponsive and goes into Ventricular Fibrillation (VF). What is your immediate action?",
        options: [
          {
            text: "Initiate CPR and deliver a 200J unsynchronized shock (Defibrillation)",
            nextStepId: "resuscitation_success",
            feedback: "Crucial! CPR and early defibrillation is the only resuscitation therapy for VF. The patient is successfully shocked back into Sinus Rhythm.",
            scoreChange: 20
          },
          {
            text: "Perform synchronized cardioversion at 100J",
            nextStepId: "resuscitation_failed",
            feedback: "Incorrect. VF does not have coordinated electrical complexes, so the defibrillator cannot synchronize. Unsynchronized shock is required.",
            scoreChange: -10
          }
        ]
      },
      reperfusion_decision: {
        id: "reperfusion_decision",
        text: "You are in a community clinic with no on-site Catheterization Lab. The nearest PCI-capable hospital is 140 minutes away. What is your reperfusion strategy?",
        options: [
          {
            text: "Administer Tenecteplase (fibrinolytics) within 30 minutes door-to-needle time",
            nextStepId: "simulation_end_success",
            feedback: "Perfect choice! Under ACC/AHA guidelines, if primary PCI cannot be achieved within 120 minutes, fibrinolytic therapy should be administered unless contraindicated.",
            scoreChange: 20
          },
          {
            text: "Transfer the patient immediately for primary PCI",
            nextStepId: "simulation_end_delayed",
            feedback: "Risky. A 140-minute transfer violates the 120-minute PCI limit. Reperfusion is dangerously delayed, increasing myocardial necrosis.",
            scoreChange: -10
          }
        ]
      },
      wrong_diagnosis: {
        id: "wrong_diagnosis",
        text: "The patient continues to have severe pain, and his SpO2 falls to 89% with pulmonary rales appearing. How do you manage this acute heart failure?",
        options: [
          {
            text: "Start non-invasive positive pressure ventilation (BiPAP) and get a cardiology consult",
            nextStepId: "reperfusion_decision",
            feedback: "Correct. High-flow positive pressure recruits alveoli and decreases preload, aiding acute pulmonary edema.",
            scoreChange: 10
          },
          {
            text: "Give 80mg Furosemide IV and wait in the ward",
            nextStepId: "simulation_end_failed",
            feedback: "Insufficient. While loop diuretics help, the underlying coronary occlusion is unresolved. The patient progresses to cardiogenic shock.",
            scoreChange: -20
          }
        ]
      },
      resuscitation_success: {
        id: "resuscitation_success",
        text: "The patient is successfully resuscitated to ROSC. He is now hemodynamically stable on an Amiodarone infusion. What is your disposition?",
        options: [
          {
            text: "Arrange urgent transfer to a Coronary Care Unit (CCU) with PCI capabilities",
            nextStepId: "simulation_end_success",
            feedback: "Exactly. Post-arrest STEMI patients need coronary angiography and intensive cardiovascular monitoring.",
            scoreChange: 15
          },
          {
            text: "Admit to the general medical ward for monitoring",
            nextStepId: "simulation_end_failed",
            feedback: "Dangerous. Post-VF patients are at high risk of re-arrhythmia and need continuous cardiac telemetry in an ICU/CCU.",
            scoreChange: -15
          }
        ]
      },
      resuscitation_failed: {
        id: "resuscitation_failed",
        text: "Resuscitation efforts are prolonged due to wrong shock modes. The patient suffers severe hypoxic brain injury.",
        options: [
          {
            text: "Establish ICU care and discuss prognosis with family",
            nextStepId: "simulation_end_failed",
            feedback: "The case terminates with poor patient prognosis due to delay in correct ACLS shock delivery.",
            scoreChange: 0
          }
        ]
      },
      simulation_end_success: {
        id: "simulation_end_success",
        text: "CONGRATULATIONS! You successfully navigated the cardiac emergency with standard-of-care protocols. The patient has been stabilized.",
        options: []
      },
      simulation_end_delayed: {
        id: "simulation_end_delayed",
        text: "CASE COMPLETED (With warnings): Reperfusion was delayed, but the patient survived to reach the cath lab. Try again to aim for a door-to-needle time under 30 minutes.",
        options: []
      },
      simulation_end_failed: {
        id: "simulation_end_failed",
        text: "CASE FAILED: The patient suffered cardiac arrest or irreversible shock due to diagnostic delay or incorrect therapies. Review the ATLS/ACC guidelines.",
        options: []
      }
    },
    debrief: "Key Takeaway: In acute coronary syndromes, obtain a 12-lead ECG within 10 minutes. If ST elevations are present, load immediately with Aspirin and P2Y12 inhibitors. If PCI is unavailable within 120 minutes, administer fibrinolytic therapy (e.g. Tenecteplase) within 30 minutes door-to-needle, unless contraindicated."
  },
  {
    id: "pediatric-asthma",
    title: "Severe Pediatric Asthma Exacerbation",
    description: "An 8-year-old female presents with severe breathlessness, dry cough, and audible wheezing. She is using accessory muscles and is unable to complete sentences.",
    difficulty: "Beginner",
    vitals: {
      bp: "110/70",
      hr: "135",
      spo2: "89",
      rr: "38",
      temp: "99.0"
    },
    initialState: "The child is sitting up in a tripod position, retractions are noted in intercostal and subcostal regions. This is a severe PALS scenario.",
    steps: {
      start: {
        id: "start",
        text: "What is your immediate oxygenation and bronchodilator strategy?",
        options: [
          {
            text: "Apply humidified oxygen via face mask and administer nebulized Salbutamol (Albuterol) with Ipratropium bromide",
            nextStepId: "nebs_given",
            feedback: "Perfect! Nebulized beta-agonists and anticholinergics are the cornerstone of severe acute asthma management.",
            scoreChange: 15
          },
          {
            text: "Perform immediate endotracheal intubation",
            nextStepId: "intubation_risk",
            feedback: "Warning! Intubation in severe asthma is extremely high-risk due to air-trapping, dynamic hyperinflation, and risk of barotrauma/pneumothorax. Avoid unless in respiratory arrest.",
            scoreChange: -15
          },
          {
            text: "Give cold water and monitor in a quiet room",
            nextStepId: "neglect_case",
            feedback: "Dangerous! The child is in severe respiratory distress with hypoxia. She requires active pharmacological intervention.",
            scoreChange: -20
          }
        ]
      },
      nebs_given: {
        id: "nebs_given",
        text: "After the first round of nebulization, her SpO2 increases to 93% but she remains tachypneic with poor air entry on chest auscultation. What is the next key systemic treatment?",
        options: [
          {
            text: "Administer systemic corticosteroids (e.g., Methylprednisolone 2mg/kg IV or Prednisolone PO)",
            nextStepId: "steroids_given",
            feedback: "Excellent! Systemic corticosteroids reduce airway inflammation and are critical in acute moderate-to-severe asthma.",
            scoreChange: 15
          },
          {
            text: "Start an intravenous adrenaline infusion",
            nextStepId: "epi_risk",
            feedback: "Too early. Intravenous adrenaline is reserved for refractory life-threatening anaphylaxis or severe asthma unresponsive to standard continuous nebs and magnesium.",
            scoreChange: -5
          }
        ]
      },
      intubation_risk: {
        id: "intubation_risk",
        text: "The patient develops a tension pneumothorax immediately post-intubation due to high airway pressures. What is your urgent decompression strategy?",
        options: [
          {
            text: "Perform immediate needle decompression in the 2nd intercostal space, mid-clavicular line, followed by chest tube placement",
            nextStepId: "simulation_end_success",
            feedback: "Life-saving rescue! Tension pneumothorax post-ventilation requires instant needle or finger thoracostomy.",
            scoreChange: 20
          },
          {
            text: "Increase PEEP on the ventilator to expand the lungs",
            nextStepId: "simulation_end_failed",
            feedback: "Fatal choice. Increasing PEEP or airway pressure in a tension pneumothorax will completely obstruct venous return, causing rapid obstructive cardiac arrest.",
            scoreChange: -30
          }
        ]
      },
      steroids_given: {
        id: "steroids_given",
        text: "The patient remains in distress after 3 back-to-back nebulizations. Her chest is silent on auscultation (silent chest). What is your next pharmacotherapy rescue?",
        options: [
          {
            text: "Administer Intravenous Magnesium Sulfate (50 mg/kg) over 20 minutes",
            nextStepId: "mag_success",
            feedback: "Superb clinical judgment. Magnesium sulfate acts as a smooth muscle relaxant and bronchodilator in severe refractive pediatric asthma.",
            scoreChange: 20
          },
          {
            text: "Start IV antibiotics (Ceftriaxone)",
            nextStepId: "simulation_end_failed",
            feedback: "Inappropriate. Asthma is an inflammatory reactive airway disease, not a bacterial infection. Delaying bronchodilators results in respiratory failure.",
            scoreChange: -15
          }
        ]
      },
      mag_success: {
        id: "mag_success",
        text: "Following Magnesium Sulfate, air entry improves with widespread moderate wheezing. Her SpO2 is stable at 95% on 2L/min nasal cannula. What is the disposition?",
        options: [
          {
            text: "Admit to a pediatric high-dependency or observation unit for hourly nebulizations and monitoring",
            nextStepId: "simulation_end_success",
            feedback: "Correct. A patient who required magnesium sulfate must be monitored closely for rebound symptoms.",
            scoreChange: 10
          },
          {
            text: "Discharge home immediately with an inhaler",
            nextStepId: "simulation_end_delayed",
            feedback: "Risky. Discharging a patient who had a silent chest and required IV magnesium within hours of resolution is dangerous. Rebound is likely.",
            scoreChange: -10
          }
        ]
      },
      neglect_case: {
        id: "neglect_case",
        text: "The child's breathing becomes shallow, her HR drops from 135 to 60 (bradycardia), and she becomes somnolent. What is your diagnosis?",
        options: [
          {
            text: "Imminent respiratory arrest. Initiate BVM ventilation with 100% O2, prepare for resuscitation, and give SC/IM Epinephrine",
            nextStepId: "simulation_end_success",
            feedback: "Vital catch. Bradycardia and altered mental status in a hypoxic asthmatic is a sign of exhaustion and impending arrest.",
            scoreChange: 20
          },
          {
            text: "The child is resting and sleeping; let her rest",
            nextStepId: "simulation_end_failed",
            feedback: "Fatal error. This is not sleep, it is hypercapnic/hypoxic coma.",
            scoreChange: -40
          }
        ]
      },
      epi_risk: {
        id: "epi_risk",
        text: "The patient develops severe tachyarrhythmia from early epinephrine. How do you recover?",
        options: [
          {
            text: "Stop epinephrine, switch back to continuous Salbutamol nebs, and consider IV Magnesium Sulfate",
            nextStepId: "mag_success",
            feedback: "Excellent recovery. Magnesium is much safer than system-wide catecholamines.",
            scoreChange: 10
          }
        ]
      },
      simulation_end_success: {
        id: "simulation_end_success",
        text: "CONGRATULATIONS! You successfully resolved the pediatric respiratory crisis according to PALS and GINA guidelines.",
        options: []
      },
      simulation_end_delayed: {
        id: "simulation_end_delayed",
        text: "CASE COMPLETED: The patient was stabilized, but some clinical decisions delayed optimal relief. Review pediatric asthma step-down guidelines.",
        options: []
      },
      simulation_end_failed: {
        id: "simulation_end_failed",
        text: "CASE FAILED: The patient suffered respiratory arrest. Ensure you understand the importance of early corticosteroids, back-to-back nebs, and systemic rescues like Magnesium Sulfate.",
        options: []
      }
    },
    debrief: "Key Takeaway: Severe pediatric asthma requires prompt humidified oxygen, back-to-back Salbutamol and Ipratropium nebulizations, and early administration of systemic corticosteroids. For severe cases unresponsive to nebs, IV Magnesium Sulfate (50mg/kg) is a highly effective, safe bronchodilator that can prevent endotracheal intubation."
  }
];
