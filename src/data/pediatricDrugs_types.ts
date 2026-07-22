export interface PediatricDrug {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  standardDose: string;
  route: string;
  frequency: string;
  maxDose?: string;
  source: string;
  indications?: string[];
  formulations?: string[];
  calculateDose?: (weight: number) => {
    doseValue: string;
    unit: string;
    breakdown?: string;
    notes?: string;
  };
}

export interface DrugCategory {
  id: string;
  name: string;
  iconName: string; // lucide icon name
  colorClass: string; // tailwind color configuration
  bgClass: string;
}
