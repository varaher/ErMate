/** One-tap order sets for the Investigations tab. Test names are exactly as the lab lists them. */
export interface OrderPanel {
  name: string;
  group: "adult" | "pediatric";
  tests: string[];
}

export const ORDER_PANELS: OrderPanel[] = [
  { name: "ER BASIC", group: "adult", tests: ["CBC", "URE"] },
  { name: "ER ADVANCE", group: "adult", tests: ["CBC", "CRP", "RFT", "LFT", "URE", "S.ELECTROLYTES"] },
  { name: "NSTEMI PANEL", group: "adult", tests: ["CBC", "CRP", "RFT", "S.ELECTROLYTES", "URE"] },
  { name: "ACUTE STROKE CODE 7", group: "adult", tests: ["CBC", "BLOOD GROUPING WITH ANTIBODY SCREENING", "LFT", "S.ELECTROLYTES", "PT INR", "URE", "CT ANGIOGRAM", "MRI SINGLE SEQUENCE", "X RAY CHEST AP", "HIV ANTIGEN AND ANTIBODY", "HBSAG", "ANTI HCV"] },
  { name: "STEMI PANEL", group: "adult", tests: ["CBC", "CRP", "RFT", "LFT", "S.ELECTROLYTES", "URE", "BLOOD GROUPING WITH ANTIBODY SCREENING", "HBSAG", "ANTI HCV", "HIV ANTIGEN AND ANTIBODY"] },
  { name: "PA PANEL EMERGENCY", group: "adult", tests: ["LFT", "CBC", "CRP", "RFT", "S.ELECTROLYTES", "PT INR", "BLOOD GROUPING WITH ANTIBODY SCREENING", "ANTI HCV", "HBSAG", "X RAY CHEST AP"] },
  { name: "ADULT SEIZURE PANEL", group: "adult", tests: ["CBC", "CRP", "LFT", "RFT", "S.ELECTROLYTES", "URE", "CALCIUM", "MAGNESIUM", "PHOSPHORUS"] },
  { name: "PEDIA MINI PANEL", group: "pediatric", tests: ["CBC", "CRP", "CREATININE", "LFT MINI", "S.ELECTROLYTES"] },
  { name: "PA PANEL PEDIATRICS SURGERY", group: "pediatric", tests: ["CBC", "CRP", "RFT", "HIV ANTIGEN AND ANTIBODY", "HBSAG", "ANTI HCV", "LFT MINI PANEL"] },
  { name: "PEDIATRIC FEBRILE SEIZURE PANEL", group: "pediatric", tests: ["CBC", "CRP", "RFT", "LFT", "S.ELECTROLYTES", "URE", "CALCIUM", "PHOSPHORUS", "MAGNESIUM", "ESR", "CULTURE AND SENSITIVITY BLOOD"] },
];
