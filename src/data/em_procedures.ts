export interface EMSedationAgent {
  name: string;
  class: string;
  ivDose: string;
  imDose?: string;
  onset: string;
  duration: string;
  indications: string[];
  contraindications: string[];
  pearls: string[];
}

export interface EMParalyticAgent {
  name: string;
  class: string;
  dose: string;
  onset: string;
  duration: string;
  contraindications: string[];
  pearls: string[];
}

export interface EMProcedureStep {
  step: string;
  title: string;
  description: string;
  pearls?: string[];
}

export interface EMVentStrategy {
  name: string;
  indication: string;
  settings: {
    mode: string;
    tidalVolume: string;
    rate: string;
    peep: string;
    fio2: string;
  };
  targets: string[];
  clinicalPearls: string[];
}

export const RSI_7_PS: EMProcedureStep[] = [
  {
    step: "P1",
    title: "Preparation (T-minus 10 minutes)",
    description: "Ensure working IV access (x2 preferred), cardiac monitor, pulse oximeter, and blood pressure monitoring. Prepare all airway equipment: SOAP ME (Suction, Oxygen, Airway [blades, tubes, stylet], Pharmacy [induction, paralytic, post-intubation drugs], Monitoring equipment, End-tidal CO2). Establish back-up plans (LMA, surgical airway).",
    pearls: ["Always double-check suction is functioning.", "Draw up drugs, label syringes clearly."]
  },
  {
    step: "P2",
    title: "Preoxygenation (T-minus 5 minutes)",
    description: "Administer 100% oxygen for 3-5 minutes via non-rebreather mask (NRB) at flush rate (>15 L/min) or bag-valve-mask (BVM) with PEEP valve if shunt is present. Aim to achieve maximal oxygen saturation of arterial blood and denitrogenate the functional residual capacity of the lungs. Avoid positive pressure ventilation unless the patient is apneic or hypoxic.",
    pearls: ["A non-rebreather mask at 15 L/min only delivers ~60-70% FiO2 unless the oxygen flowmeter is opened wide 'to flush' (>40 L/min).", "Use HFNC (high-flow nasal cannula) for apneic oxygenation during intubation attempt."]
  },
  {
    step: "P3",
    title: "Pretreatment (T-minus 3 minutes)",
    description: "Consider optimization medications to mitigate the physiological response to laryngoscopy and intubation (sympathetic surge, bronchospasm, raised ICP). This is optional and rarely done in modern emergency practice, but may include Fentanyl (1-3 mcg/kg) to blunt ICP spikes or sympathetic responses in aortic dissection/ruptured aneurysm, or Lidocaine (1.5 mg/kg) in asthma/raised ICP.",
    pearls: ["Blunting the sympathetic response is crucial in active intracranial hemorrhage or aortic dissection."]
  },
  {
    step: "P4",
    title: "Paralysis with Induction (T-minus 0 minutes)",
    description: "Administer the induction agent (e.g., Ketamine, Etomidate, Propofol) as a rapid IV bolus immediately followed by the neuromuscular blocking agent (e.g., Succinylcholine or Rocuronium). Do not assist ventilations unless necessary (severe hypoxia), to avoid gastric insufflation and subsequent aspiration.",
    pearls: ["Succinylcholine provides faster onset and shorter duration but has significant contraindications.", "Rocuronium is a safer first-line choice for most emergency intubations, especially if hyperkalemia is suspected."]
  },
  {
    step: "P5",
    title: "Positioning (T-minus 0 minutes + 30 seconds)",
    description: "Place the patient in the 'sniffing position' (ear-to-sternal-notch alignment) to align the oral, pharyngeal, and laryngeal axes. For obese patients, utilize ramped positioning. Maintain cervical in-line stabilization if trauma or cervical spine injury is suspected (avoid sniffing position in trauma; keep neck neutral).",
    pearls: ["Poor positioning is a leading cause of difficult visualization.", "In obese patients, the tragus of the ear should align horizontally with the sternal notch."]
  },
  {
    step: "P6",
    title: "Placement with Proof (T-minus 0 minutes + 45 seconds)",
    description: "Perform direct or video laryngoscopy, visualize the vocal cords, and pass the endotracheal tube. Inflate the cuff. Confirm correct placement immediately using quantitative waveform end-tidal capnography (EtCO2), which is the gold standard, along with secondary methods (bilateral chest rise, bilateral breath sounds, absence of epigastric sounds, tube condensation).",
    pearls: ["A flat EtCO2 capnogram indicates esophageal intubation. Re-intubate immediately.", "Never rely on colorimetric color-change alone if waveform capnography is available."]
  },
  {
    step: "P7",
    title: "Post-Intubation Management",
    description: "Secure the tube, note the depth at the lip (typically 21-23 cm in adults). Initiate mechanical ventilation with lung-protective settings. Immediately initiate continuous sedation and analgesia (e.g., Propofol infusion or Midazolam + Fentanyl) to prevent patient awareness and ventilator dyssynchrony. Obtain a portable chest X-ray to confirm the tube tip sits 3-5 cm above the carina.",
    pearls: ["Long-acting paralytics (like Rocuronium) wear off, leaving the patient awake but paralyzed. Sedate immediately!", "Check tube depth; right mainstem bronchus intubation leads to unilateral breath sounds and hypoxia."]
  }
];

export const INDUCTION_AGENTS: EMSedationAgent[] = [
  {
    name: "Ketamine",
    class: "Dissociative Anesthetic",
    ivDose: "1.5 - 2.0 mg/kg IV bolus",
    imDose: "4.0 - 5.0 mg/kg IM",
    onset: "30 - 60 seconds",
    duration: "10 - 15 minutes",
    indications: [
      "RSI induction, especially in hemodynamically unstable or septic patients",
      "Severe asthma/bronchospasm (causes bronchodilation)",
      "Procedural sedation (especially pediatric)"
    ],
    contraindications: [
      "Known hypersensitivity",
      "Schizophrenia or active psychotic exacerbation (relative)",
      "Severe uncontrolled hypertension (relative)"
    ],
    pearls: [
      "Preserves respiratory drive and airway protective reflexes.",
      "Causes catecholamine release, maintaining blood pressure; however, can cause cardiovascular depression in catecholamine-depleted, critically ill shock patients.",
      "Does NOT cause clinically significant increases in ICP (debunked myth); safe in head injury."
    ]
  },
  {
    name: "Etomidate",
    class: "Sedative-Hypnotic",
    ivDose: "0.3 mg/kg IV bolus",
    onset: "15 - 45 seconds",
    duration: "3 - 12 minutes",
    indications: [
      "RSI induction in hemodynamically compromised or normotensive patients",
      "Cardiovascularly stable sedative choice"
    ],
    contraindications: [
      "Adrenal insufficiency / Sepsis (relative, due to transient adrenal suppression)"
    ],
    pearls: [
      "Hemodynamically neutral: minimal effect on blood pressure and heart rate.",
      "Causes transient adrenal suppression (blocks 11-beta-hydroxylase) for 24 hours. A single dose is considered safe in sepsis, but controversial; consider hydrocortisone backup.",
      "Frequently causes myoclonus upon administration."
    ]
  },
  {
    name: "Propofol",
    class: "GABA-A Agonist",
    ivDose: "1.0 - 2.0 mg/kg IV bolus",
    onset: "15 - 30 seconds",
    duration: "5 - 10 minutes",
    indications: [
      "RSI induction in robust, hemodynamically stable patients",
      "Procedural sedation",
      "Continuous post-intubation sedation"
    ],
    contraindications: [
      "Hypotension, shock, hemodynamically unstable patients",
      "Egg or soy allergy (relative/disputed, but check local protocols)"
    ],
    pearls: [
      "Causes profound vasodilation and myocardial depression, leading to severe hypotension.",
      "Reduces ICP and cerebral metabolic oxygen consumption.",
      "Excellent anticonvulsant and anti-emetic properties."
    ]
  },
  {
    name: "Midazolam",
    class: "Benzodiazepine",
    ivDose: "0.1 - 0.3 mg/kg IV bolus",
    onset: "1 - 3 minutes",
    duration: "30 - 60 minutes",
    indications: [
      "RSI induction (backup when Ketamine/Etomidate are unavailable)",
      "Procedural sedation",
      "Status epilepticus management"
    ],
    contraindications: [
      "Hypotension / Shock"
    ],
    pearls: [
      "Slower onset than Etomidate or Propofol.",
      "Causes respiratory depression and moderate hypotension.",
      "Reversible with Flumazenil (use caution in chronic benzo users; can precipitate seizures)."
    ]
  }
];

export const PARALYTIC_AGENTS: EMParalyticAgent[] = [
  {
    name: "Succinylcholine",
    class: "Depolarizing Neuromuscular Blocker",
    dose: "1.5 - 2.0 mg/kg IV (or 3-4 mg/kg IM if no IV access)",
    onset: "45 - 60 seconds",
    duration: "4 - 10 minutes",
    contraindications: [
      "Known or suspected hyperkalemia (e.g., missed dialysis)",
      "Crush injuries, severe burns, or denervating neuromuscular disease > 72 hours old",
      "Personal or family history of malignant hyperthermia",
      "Penetrating eye injury (relative)"
    ],
    pearls: [
      "Transiently raises serum potassium by ~0.5 mEq/L (fatal in pre-existing hyperkalemia).",
      "Causes muscle fasciculations, which can increase intraocular and intragastric pressure.",
      "Ideal for anticipated difficult airways due to short duration, but rocuronium is increasingly preferred."
    ]
  },
  {
    name: "Rocuronium",
    class: "Non-depolarizing Neuromuscular Blocker",
    dose: "1.2 mg/kg IV (High dose for rapid onset)",
    onset: "60 seconds",
    duration: "45 - 70 minutes",
    contraindications: [
      "Known hypersensitivity"
    ],
    pearls: [
      "Hemodynamically neutral and lacks the metabolic/hyperkalemia contraindications of Succinylcholine.",
      "Duration is long (approx. 1 hour). Ensure immediate availability of post-intubation sedation.",
      "Reversible with Sugammadex (16 mg/kg for immediate rescue reversal, 2-4 mg/kg for routine)."
    ]
  },
  {
    name: "Vecuronium",
    class: "Non-depolarizing Neuromuscular Blocker",
    dose: "0.1 mg/kg IV (standard) or 0.2 mg/kg IV (for RSI)",
    onset: "2 - 3 minutes",
    duration: "45 - 60 minutes",
    contraindications: [
      "Known hypersensitivity"
    ],
    pearls: [
      "Rarely used as primary RSI paralytic due to slow onset (2-3 mins).",
      "Mainly used as a maintenance paralytic post-intubation or as backup."
    ]
  }
];

export const SEDATION_AGENTS: EMSedationAgent[] = [
  {
    name: "Ketamine",
    class: "Dissociative Agent",
    ivDose: "1.0 - 2.0 mg/kg IV over 1-2 mins",
    imDose: "4.0 - 5.0 mg/kg IM",
    onset: "1 minute (IV) / 5 minutes (IM)",
    duration: "10 - 20 minutes (IV) / 30 minutes (IM)",
    indications: ["Painful procedures in children and adults (orthopedic reductions, abscess drainage, chest tube insertion)."],
    contraindications: ["Infants < 3 months", "Active upper respiratory infection (increased laryngospasm risk)"],
    pearls: ["Preserves airway reflexes and respiratory drive. Dissociative state (appears awake but disconnected).", "May cause emergence reactions (hallucinations, agitation) upon waking—treat with low-dose midazolam if severe."]
  },
  {
    name: "Propofol",
    class: "Sedative-Hypnotic",
    ivDose: "0.5 - 1.0 mg/kg IV, followed by 0.5 mg/kg every 3-5 mins as needed",
    onset: "30 - 60 seconds",
    duration: "5 - 10 minutes",
    indications: ["Brief non-painful or moderately painful procedures (cardioversion, joint reductions with analgesia)."],
    contraindications: ["Hypotension", "Severe cardiovascular instability"],
    pearls: ["Extremely rapid recovery and anti-emetic.", "Causes dose-dependent respiratory depression and severe hypotension. Must have bag-valve-mask and airway equipment at bedside."]
  },
  {
    name: "Etomidate",
    class: "Sedative-Hypnotic",
    ivDose: "0.1 - 0.2 mg/kg IV bolus",
    onset: "30 - 60 seconds",
    duration: "5 - 15 minutes",
    indications: ["Brief procedures in patients with borderline hemodynamics (e.g., electrical cardioversion, joint reductions in elderly)."],
    contraindications: ["Adrenal suppression/sepsis (relative)"],
    pearls: ["Hemodynamically neutral. High incidence of myoclonus (brief muscle jerks), which is benign but can look like a seizure."]
  },
  {
    name: "Dexmedetomidine",
    class: "Alpha-2 Adrenergic Agonist",
    ivDose: "1 mcg/kg IV loading dose over 10 minutes",
    onset: "5 - 10 minutes",
    duration: "30 - 60 minutes",
    indications: ["Procedural sedation where respiratory depression is highly undesirable (e.g., awake fiberoptic intubation, non-invasive ventilation tolerance)."],
    contraindications: ["Severe bradycardia", "Advanced heart block"],
    pearls: ["Unique 'arousable' sedation with zero respiratory depression.", "Frequently causes bradycardia and hypotension."]
  },
  {
    name: "Ketofol (Ketamine + Propofol 1:1)",
    class: "Combination Sedative/Analgesic",
    ivDose: "0.5 - 0.75 mg/kg IV of mixed solution, titrated as needed",
    onset: "30 - 60 seconds",
    duration: "10 - 15 minutes",
    indications: ["Procedural sedation where stable hemodynamics and analgesia are required (e.g. major joint reduction)."],
    contraindications: ["Infants < 3 months", "Severe hypotension/shock"],
    pearls: ["Combining Ketamine (sympathomimetic) and Propofol (sympatholytic) provides excellent sedation/analgesia with lower doses of each, reducing the incidence of hypotension (from propofol) and emergence agitation (from ketamine).", "Usually prepared by mixing 50mg Ketamine + 100mg Propofol in a single syringe, or using equal volumes of 10mg/mL solutions."]
  }
];

export const VENT_STRATEGIES: EMVentStrategy[] = [
  {
    name: "Standard Initial Settings",
    indication: "Post-intubation stabilization for patient without lung disease",
    settings: {
      mode: "Assist Control / Volume Control (AC/VC)",
      tidalVolume: "6 - 8 mL/kg of Ideal Body Weight (IBW)",
      rate: "12 - 16 breaths per minute",
      peep: "5 cm H2O",
      fio2: "100% initially, immediately titrate down to keep SpO2 92-96%"
    },
    targets: [
      "SpO2: 92% - 98%",
      "pH: 7.35 - 7.45",
      "PaCO2: 35 - 45 mmHg"
    ],
    clinicalPearls: [
      "Always calculate tidal volume based on IDEAL body weight (based on height and gender), NEVER actual weight.",
      "Check an ABG 20-30 minutes after initiating settings."
    ]
  },
  {
    name: "ARDS Strategy (Lung-Protective)",
    indication: "Acute Respiratory Distress Syndrome, severe pneumonia, sepsis with lung injury",
    settings: {
      mode: "AC/VC or AC/Pressure Control (AC/PC)",
      tidalVolume: "4 - 6 mL/kg of Ideal Body Weight (IBW)",
      rate: "20 - 24 breaths per minute (higher to compensate for low volume)",
      peep: "8 - 15 cm H2O (titrate up to keep alveoli open)",
      fio2: "Titrate to keep SpO2 88-92% (prevent oxygen toxicity)"
    },
    targets: [
      "SpO2: 88% - 92%",
      "Plateau Pressure: < 30 cm H2O (crucial for preventing barotrauma)",
      "Driving Pressure: < 15 cm H2O",
      "pH: > 7.20 (Accept permissive hypercapnia)"
    ],
    clinicalPearls: [
      "Low tidal volume is the ONLY intervention shown to reduce mortality in ARDS.",
      "High PEEP is required to recruit collapsed alveoli, but monitor hemodynamics (high PEEP decreases venous return and cardiac output)."
    ]
  },
  {
    name: "Obstructive Strategy",
    indication: "Severe Asthma, COPD exacerbation",
    settings: {
      mode: "AC/VC",
      tidalVolume: "6 - 8 mL/kg of Ideal Body Weight (IBW)",
      rate: "8 - 12 breaths per minute (low rate to allow prolonged exhalation)",
      peep: "0 - 5 cm H2O (low PEEP to avoid worsening air trapping)",
      fio2: "Titrate to keep SpO2 88-92% (COPD) or 92-95% (Asthma)"
    },
    targets: [
      "SpO2: 88% - 95%",
      "pH: > 7.15 (Permissive hypercapnia is expected and safe)",
      "I:E Ratio: 1:3 to 1:5 (highly prolonged expiratory time)",
      "Auto-PEEP: < 10 cm H2O",
      "Peak Inspiratory Pressure: Can be high (>40 cmH2O) due to airway resistance, but keep Plateau Pressure < 30 cmH2O."
    ],
    clinicalPearls: [
      "The primary danger in intubated asthmatics is air trapping (auto-PEEP) leading to breath stacking, tension pneumothorax, and cardiovascular collapse.",
      "Use high inspiratory flow rates (80-100 L/min) to deliver the breath quickly, leaving more time for expiration.",
      "If the patient becomes suddenly hypotensive after intubation, disconnect the ventilator and compress the chest to allow trapped air to escape!"
    ]
  },
  {
    name: "Neuroprotective Strategy",
    indication: "Traumatic Brain Injury (TBI), Severe Stroke, Raised ICP, Intracranial Hemorrhage",
    settings: {
      mode: "AC/VC",
      tidalVolume: "6 - 8 mL/kg of Ideal Body Weight (IBW)",
      rate: "14 - 18 breaths per minute (titrated to strict PaCO2 targets)",
      peep: "5 - 8 cm H2O (avoid high PEEP as it can increase ICP by limiting venous return)",
      fio2: "Titrate to keep SpO2 > 94% (prevent secondary hypoxic brain injury)"
    },
    targets: [
      "SpO2: > 94% (PaO2 > 80 mmHg)",
      "PaCO2: 35 - 38 mmHg (strict normocapnia to slight hypocapnia)",
      "Plateau Pressure: < 30 cm H2O"
    ],
    clinicalPearls: [
      "Avoid hypercapnia (CO2 > 45) because it causes cerebral vasodilation and worsens raised ICP.",
      "Avoid routine hyperventilation (CO2 < 30) because it causes cerebral vasoconstriction and cerebral ischemia. Only hyperventilate (CO2 30-35) briefly as a bridge during active signs of brain herniation (pupillary dilation, decerebrate posturing).",
      "Ensure robust sedation and analgesia (e.g., Propofol + Fentanyl) to suppress sympathetic surges that raise ICP."
    ]
  }
];

export interface EMCentralLineProtocol {
  site: string;
  indications: string[];
  contraindications: string[];
  ultrasoundLandmarks: string;
  procedureSteps: string[];
  pearls: string[];
}

export const CENTRAL_LINE_PROTOCOLS: EMCentralLineProtocol[] = [
  {
    site: "Internal Jugular (IJ) Vein",
    indications: [
      "Vasoactive drug infusions (vasopressors, inotropes)",
      "Hypertonic or highly irritating infusions (TPN, 3% saline, high-dose potassium)",
      "Lack of peripheral venous access",
      "Central venous pressure monitoring",
      "Transvenous pacing or hemodialysis access"
    ],
    contraindications: [
      "Infection at the insertion site",
      "Anatomical distortion or local vascular injury/thrombosis",
      "Severe coagulopathy (relative; IJ is compressible, but subclavian is not)",
      "Uncooperative, awake patient"
    ],
    ultrasoundLandmarks: "Position ultrasound transducer transversely over the lateral neck. The internal jugular vein is typically anterolateral to the carotid artery. The IJ is thin-walled, oval/compressible, and expands with a Valsalva maneuver. The carotid artery is round, thick-walled, non-compressible, and pulsatile.",
    procedureSteps: [
      "Perform sterile preparation and draping. Conduct a pre-procedure time-out.",
      "Use ultrasound to localize the IJ vein and carotid artery. Confirm vein compressibility.",
      "Anesthetize the skin and deeper tissues down to the vessel wall with 1% lidocaine.",
      "Under direct real-time ultrasound guidance, insert the introducer needle into the skin at a 45-60 degree angle, keeping the needle tip in view.",
      "Advance slowly with gentle negative pressure until dark, non-pulsatile blood is aspirated.",
      "Remove the syringe while holding the needle stable, then insert the guidewire. The wire should slide smoothly with zero resistance. Never force the wire.",
      "Confirm wire position in the IJ vein (and not the carotid artery) using ultrasound.",
      "Make a small skin nick, advance the dilator over the wire, remove the dilator, and advance the triple-lumen catheter over the wire.",
      "Ensure the wire protrudes from the distal port before advancing the catheter through the skin.",
      "Remove the wire. Aspirate blood and flush all three ports with sterile saline.",
      "Suture the catheter in place, apply chlorhexidine patch, and cover with a sterile transparent dressing.",
      "Obtain a chest X-ray to confirm placement (catheter tip should sit at the junction of the SVC and right atrium) and rule out pneumothorax."
    ],
    pearls: [
      "Always confirm wire placement in the vessel using ultrasound before dilating. Dilating the carotid artery is a catastrophic complication requiring surgical intervention.",
      "Right IJ is preferred over left IJ because it has a straight path to the SVC, and the thoracic duct is on the left side."
    ]
  },
  {
    site: "Subclavian (SC) Vein",
    indications: [
      "Same as IJ, plus:",
      "Preferred for trauma resuscitation when neck access is restricted (c-collar)",
      "Lowest rate of infectious complications among central access sites"
    ],
    contraindications: [
      "Severe coagulopathy (subclavian vein is under the clavicle and is non-compressible)",
      "Prior clavicular fracture or ipsilateral chest wall trauma",
      "Prior subclavian line on the same side"
    ],
    ultrasoundLandmarks: "Typically performed using an infra-clavicular landmark-guided approach. The needle is inserted 1-2 cm inferior to the junction of the medial and middle thirds of the clavicle, pointing toward the suprasternal notch, hugging the inferior border of the clavicle.",
    procedureSteps: [
      "Perform sterile prep, drape, and time-out. Position patient in Trendelenburg.",
      "Identify landmarks: clavicle, deltopectoral groove, and suprasternal notch.",
      "Anesthetize the skin and periosteum of the clavicle.",
      "Insert introducer needle hugging the underside of the clavicle, pointing at the suprasternal notch.",
      "Apply continuous gentle suction on the syringe. Once dark venous blood is aspirated, stabilize the needle and thread the guidewire.",
      "Follow standard Seldinger steps (dilate, pass catheter, flush, secure).",
      "Confirm placement and rule out pneumothorax with chest X-ray."
    ],
    pearls: [
      "Higher risk of pneumothorax compared to IJ vein.",
      "Avoid in patients with severe bleeding risk since direct pressure cannot be applied."
    ]
  },
  {
    site: "Femoral Vein",
    indications: [
      "Emergency venous access during cardiac arrest or severe shock",
      "Patient in respiratory distress who cannot tolerate flat or Trendelenburg positioning",
      "When IJ and SC access are contraindicated"
    ],
    contraindications: [
      "Severe abdominal or pelvic trauma (venous return may be disrupted)",
      "Local skin infection or severe burn in the groin",
      "Prior femoral vascular graft"
    ],
    ultrasoundLandmarks: "Position transducer transversely in the femoral crease. The femoral vein lies medial to the femoral artery ('NAVY' from lateral to medial: Nerve, Artery, Vein, Y-fronts/groin).",
    procedureSteps: [
      "Sterile prep, drape, and time-out.",
      "Identify the femoral artery pulsation, or use ultrasound to identify artery and vein.",
      "Anesthetize the skin medial to the arterial pulse.",
      "Insert needle at a 45-degree angle pointing cephalad, aspirate dark venous blood, and thread the guidewire.",
      "Follow standard Seldinger technique to place and secure catheter."
    ],
    pearls: [
      "Highest risk of infection and thrombosis. Remove as soon as alternative access is secured (typically within 24 hours).",
      "Excellent site during active CPR because it does not interfere with chest compressions or airway management."
    ]
  }
];

export interface EMArterialLineProtocol {
  site: string;
  indications: string[];
  contraindications: string[];
  procedureSteps: string[];
  pearls: string[];
}

export const ARTERIAL_LINE_PROTOCOLS: EMArterialLineProtocol[] = [
  {
    site: "Radial Arterial Line",
    indications: [
      "Continuous real-time blood pressure monitoring (hemodynamic instability, shock, vasoactive infusions)",
      "Frequent arterial blood gas (ABG) draws",
      "Failure of non-invasive blood pressure monitoring"
    ],
    contraindications: [
      "Infection at the insertion site",
      "Absent radial pulse, poor collateral circulation (Allen's test can be performed, though its predictive value is low)",
      "Raynaud's disease or active thromboangiitis obliterans (relative)"
    ],
    procedureSteps: [
      "Perform sterile preparation and conduct a pre-procedure time-out.",
      "Dorsiflex the wrist over a small rolled towel (do not over-extend) and secure it.",
      "Identify the radial artery by palpation or using real-time ultrasound guidance (highly recommended).",
      "Infiltrate the skin over the artery with 1% lidocaine (minimal volume to avoid obscuring the pulse).",
      "Under ultrasound guidance (short or long axis), insert the angiocatheter/needle at a 30-45 degree angle.",
      "Once a flash of bright red, pulsatile blood appears in the chamber, lower the angle to 10-15 degrees and advance the needle/catheter unit 1-2 mm further to ensure the catheter tip is fully inside the vessel lumen.",
      "Thread the catheter over the needle into the artery. It should slide smoothly without resistance.",
      "Compress the artery proximal to the catheter, remove the needle, and attach the pre-assembled pressure transducer tubing.",
      "Flush the line and observe a clean, pulsatile arterial waveform on the monitor.",
      "Suture or tape the catheter securely, apply a sterile transparent dressing, and splint the wrist in a neutral position."
    ],
    pearls: [
      "If using the 'double-wall puncture' (transfixation) technique, puncture both the anterior and posterior walls of the artery, remove the needle, and slowly withdraw the catheter until pulsatile blood spurts, then thread the wire or catheter.",
      "Always ensure the pressure transducer is leveled to the phlebostatic axis (4th intercostal space, mid-axillary line) for accurate readings."
    ]
  },
  {
    site: "Femoral Arterial Line",
    indications: [
      "Emergent hemodynamic monitoring during cardiac arrest or profound shock",
      "Severe peripheral vasoconstriction (radial pulses impalpable)",
      "Failed radial access"
    ],
    contraindications: [
      "Infection or vascular graft in the groin",
      "Coagulopathy (relative, but safer than subclavian because it is compressible)"
    ],
    procedureSteps: [
      "Sterile prep, drape, and time-out.",
      "Palpate the femoral artery pulse or use ultrasound in the femoral triangle.",
      "Insert needle at a 45-degree angle cephalad just inferior to the inguinal ligament.",
      "Once pulsatile blood is obtained, advance the guidewire, dilate slightly, and advance the arterial catheter over the wire.",
      "Connect transducer, flush, and secure."
    ],
    pearls: [
      "Must insert below the inguinal ligament. Puncture above the inguinal ligament can lead to retroperitoneal hemorrhage, which can be fatal and hidden.",
      "Higher risk of infectious complications; remove when patient is stable."
    ]
  }
];

export const BIPAP_CPAP_GUIDELINES = {
  cpap: {
    title: "Continuous Positive Airway Pressure (CPAP)",
    definition: "Delivers a constant, single level of positive pressure throughout both inhalation and exhalation.",
    startingSettings: "5 - 10 cm H2O. Titrate upwards by 2 cm H2O to improve oxygenation, up to 15 cm H2O.",
    mechanism: "Increases functional residual capacity (FRC), recruits collapsed alveoli, reduces intrapulmonary shunt, and decreases left ventricular afterload.",
    indications: [
      "Acute Cardiogenic Pulmonary Edema (ACPE) - strongly reduces need for intubation",
      "Obstructive Sleep Apnea (OSA)"
    ]
  },
  bipap: {
    title: "Bilevel Positive Airway Pressure (BiPAP)",
    definition: "Delivers two alternating levels of positive pressure: Inspiratory Positive Airway Pressure (IPAP) and Expiratory Positive Airway Pressure (EPAP).",
    startingSettings: "IPAP: 10 - 12 cm H2O | EPAP: 4 - 5 cm H2O (Pressure Support = IPAP - EPAP = 6 - 8 cm H2O).",
    titration: [
      "To improve ventilation (lower PaCO2, reduce work of breathing): Increase IPAP in steps of 2 cm H2O (increases pressure support).",
      "To improve oxygenation: Increase EPAP in steps of 2 cm H2O (and increase IPAP by the same amount to maintain the same level of pressure support)."
    ],
    indications: [
      "COPD exacerbation with respiratory acidosis (pH < 7.35, PaCO2 > 45 mmHg)",
      "Acute Cardiogenic Pulmonary Edema (if respiratory muscle fatigue or CO2 retention is present)",
      "Pre-oxygenation for RSI / Intubation in hypoxic patients"
    ]
  },
  contraindications: {
    absolute: [
      "Cardiac or respiratory arrest",
      "Inability to protect airway (unconscious, severe GCS < 8, or active vomiting)",
      "Facial trauma, burns, or facial surgery preventing a mask seal",
      "Upper airway obstruction (foreign body, tumor)"
    ],
    relative: [
      "Severe agitation or uncooperativeness (requires reassurance or low-dose dexmedetomidine)",
      "Copious secretions (increases aspiration risk)",
      "Hemodynamic instability or profound shock",
      "Recent upper gastrointestinal surgery"
    ]
  },
  pearls: [
    "Coach the patient! Many patients panic when the mask is first applied. Hold the mask to their face gently before strapping it on, and talk them through it.",
    "Pressure support (IPAP minus EPAP) is what driving ventilation and unloading the respiratory muscles.",
    "EPAP is equivalent to PEEP, recruiting alveoli and driving oxygenation."
  ]
};

export const NEUROPROTECTIVE_GUIDELINES = {
  title: "Emergency Neuroprotective Management",
  subtitle: "First-line interventions for Traumatic Brain Injury (TBI), Raised ICP, Acute Herniation, and Severe Stroke.",
  interventions: [
    {
      target: "Positioning",
      goal: "Enhance cerebral venous drainage and lower intracranial pressure.",
      action: "Elevate Head of Bed (HOB) to 30 - 45 degrees. Keep the neck straight in the midline position (avoid flexion, extension, or rotation, which compresses the jugular veins)."
    },
    {
      target: "Hyperosmolar Therapy",
      goal: "Draw water out of the swollen brain tissue into the vascular space to reduce brain swelling.",
      action: "Hypertonic Saline (3% NaCl): 250 - 500 mL IV bolus over 10-20 minutes, OR Mannitol (20% solution): 0.5 - 1.0 g/kg IV bolus over 15-20 minutes. Note: Mannitol causes osmotic diuresis; avoid in hypotensive or severely hypovolemic patients."
    },
    {
      target: "Ventilation & PaCO2 Target",
      goal: "Control cerebral blood flow via CO2 reactivity.",
      action: "Target strict normocapnia (PaCO2 35-40 mmHg). Avoid routine hyperventilation. Hyperventilation causes cerebral vasoconstriction and reduces cerebral blood flow, which can cause brain ischemia. ONLY hyperventilate (PaCO2 30-35 mmHg) as an emergency rescue bridge if active signs of herniation are present (unilateral dilated pupil, decerebrate posturing)."
    },
    {
      target: "Blood Pressure Control",
      goal: "Maintain Cerebral Perfusion Pressure (CPP = MAP - ICP). Target CPP of 60-70 mmHg.",
      action: "Avoid hypotension! A single episode of systolic BP < 90 mmHg doubles mortality in severe TBI. Maintain Mean Arterial Pressure (MAP) > 80 mmHg. If BP is elevated, do not aggressively lower it unless extremely high (e.g., SBP > 220 mmHg in ischemic stroke or > 140-160 mmHg in hemorrhagic stroke) to preserve collateral brain perfusion."
    },
    {
      target: "Oxygenation",
      goal: "Avoid secondary hypoxic brain injury.",
      action: "Maintain oxygen saturation (SpO2) > 94% or PaO2 > 80 mmHg at all times."
    },
    {
      target: "Sedation & Shivering Control",
      goal: "Minimize cerebral metabolic rate of oxygen (CMRO2) and prevent ICP spikes.",
      action: "Use analgesia-first sedation (Fentanyl infusion) combined with Propofol. Avoid Ketamine if patient is hypertensive and raised ICP is uncontrolled (relative), though Ketamine is generally safe. Control shivering aggressively (e.g., with low-dose neuromuscular blockers or acetaminophen) as shivering severely spikes ICP."
    },
    {
      target: "Seizure Prophylaxis & Temperature Control",
      goal: "Prevent subclinical seizures and fever, which massively increase cerebral metabolism.",
      action: "Administer Levetiracetam (Keppra) 1500 mg IV load if indicated (moderate-to-severe TBI). Actively treat any temperature > 38°C with acetaminophen and cooling blankets. Fever worsens secondary brain injury."
    }
  ],
  clinicalPearls: [
    "In a head-injured patient, the priorities are: hypoxia prevention, hypotension prevention, and rapid surgical/osmotic intervention if herniation occurs.",
    "A single blown pupil in a patient with a head injury who is deteriorating is a medical emergency. Administer 3% saline immediately and arrange emergency CT head and neurosurgical consult."
  ]
};
