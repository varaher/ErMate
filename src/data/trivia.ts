/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TriviaQuestion {
  id: string;
  vignette: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  teachingPoint: string;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: "t1",
    vignette: "A 4-year-old boy is brought to the ER after swallowing a coin. He is speaking, breathing comfortably, and managing his oral secretions. An X-ray shows the coin is in his esophagus at the level of the thoracic inlet. What is the most appropriate next step in management?",
    options: [
      "Immediate rigid bronchoscopy",
      "Observation for up to 24 hours if asymptomatic",
      "Administration of syrup of ipecac to induce emesis",
      "Immediate surgical esophagostomy"
    ],
    correctIndex: 1,
    explanation: "For an asymptomatic blunt foreign body (like a coin) lodged in the esophagus, observation for up to 24 hours is safe and appropriate as many coins pass spontaneously into the stomach. Inducing vomiting is contraindicated, and rigid bronchoscopy is reserved for airway foreign bodies or symptomatic patients.",
    teachingPoint: "Asymptomatic esophageal coins can be observed for up to 24 hours before endoscopic retrieval is required."
  },
  {
    id: "t2",
    vignette: "A 28-year-old female presents with severe pain in her right lower quadrant. She states her last menstrual period was 6 weeks ago. Her blood pressure is 92/54 mmHg, and heart rate is 114 bpm. What is the immediate priority diagnostic evaluation?",
    options: [
      "Abdomen/Pelvis CT scan with oral contrast",
      "Serum beta-hCG and bed-side FAST ultrasound scan",
      "Urinalysis and stool culture",
      "Reassess after 1L saline fluid bolus"
    ],
    correctIndex: 1,
    explanation: "In any female of childbearing age presenting with abdominal pain and shock, ruptured ectopic pregnancy is the primary emergency differential. Immediate serum/urine beta-hCG and point-of-care ultrasound (FAST/focused pelvis scan) are required to identify free intra-abdominal fluid.",
    teachingPoint: "Ectopic pregnancy must be ruled out immediately in any unstable female of childbearing age presenting with lower abdominal pain."
  },
  {
    id: "t3",
    vignette: "A 68-year-old male with chronic renal failure presents with severe weakness. The ECG reveals wide-complex rhythm, flat P-waves, and peaked T-waves. Which of the following is the most critical first medication to administer?",
    options: [
      "Sodium bicarbonate 50mEq IV",
      "10% Calcium Gluconate or Calcium Chloride 10mL IV",
      "Furosemide (Lasix) 80mg IV",
      "Insulin 10 units IV with 50% Dextrose"
    ],
    correctIndex: 1,
    explanation: "Peaked T-waves, flattened P-waves, and a widened QRS are characteristic signs of severe, life-threatening hyperkalemia. Calcium (gluconate or chloride) does not lower serum potassium, but it is the critical first-line step because it stabilizes the cardiac myocyte membrane against depolarization-induced arrhythmias.",
    teachingPoint: "In hyperkalemia with ECG changes, calcium is the first-line medication to stabilize cardiac membranes and prevent ventricular fibrillation."
  },
  {
    id: "t4",
    vignette: "A 35-year-old male is brought to the resuscitation bay after a motor vehicle accident. He has absent breath sounds on the right side, tracheal deviation to the left, and a BP of 80/45 mmHg. What is the immediate intervention?",
    options: [
      "Obtain an urgent portable chest X-ray",
      "Perform immediate needle decompression in the right 2nd intercostal space",
      "Perform endotracheal intubation",
      "Administer 2 units of uncrossed O-negative packed red blood cells"
    ],
    correctIndex: 1,
    explanation: "This patient presents with classic signs of a tension pneumothorax (hypotension, unilateral absent breath sounds, tracheal deviation). Tension pneumothorax is a clinical diagnosis. You must never wait for an X-ray; immediate needle decompression or finger thoracostomy is required to relieve the pressure.",
    teachingPoint: "Tension pneumothorax is a clinical diagnosis. Immediate needle decompression must precede any diagnostic imaging."
  },
  {
    id: "t5",
    vignette: "An 18-month-old child presents with a barking cough and mild inspiratory stridor at rest. He has no chest wall retractions, is playful, and is drinking fluids. What is the recommended first-line therapy?",
    options: [
      "Nebulized racemic adrenaline",
      "Oral or intramuscular Dexamethasone (0.6 mg/kg)",
      "Intravenous antibiotics (Amoxicillin)",
      "Immediate endotracheal intubation"
    ],
    correctIndex: 1,
    explanation: "This child has mild croup (laryngotracheobronchitis). A single dose of oral dexamethasone is highly effective, reduces the rate of return visits, and is the standard of care. Racemic epinephrine is reserved for moderate-to-severe croup with stridor and accessory muscle retractions.",
    teachingPoint: "Dexamethasone is the cornerstone of treatment for croup, even in mild cases."
  }
];
