import { PediatricDrug, DrugCategory } from "./pediatricDrugs_types";
import { ANALGESICS_DRUGS } from "./pediatricDrugs_analgesics";
import { ANTIBIOTICS_DRUGS } from "./pediatricDrugs_antibiotics";
import { ANTICONVULSANTS_DRUGS } from "./pediatricDrugs_anticonvulsants";
import { ANTIHISTAMINICS_DRUGS } from "./pediatricDrugs_antihistaminics";
import { STEROIDS_DRUGS } from "./pediatricDrugs_steroids";
import { COMBINATION_DRUGS } from "./pediatricDrugs_combinations";
import { GASTROINTESTINAL_DRUGS } from "./pediatricDrugs_gastrointestinal";

export type { PediatricDrug, DrugCategory };

export const DRUG_CATEGORIES: DrugCategory[] = [
  {
    id: "analgesics",
    name: "Analgesics & Antipyretics",
    iconName: "Thermometer",
    colorClass: "text-rose-500",
    bgClass: "bg-rose-500/10 dark:bg-rose-950/20"
  },
  {
    id: "antibiotics-penicillins",
    name: "Antibiotics - Penicillins",
    iconName: "Shield",
    colorClass: "text-sky-500",
    bgClass: "bg-sky-500/10 dark:bg-sky-950/20"
  },
  {
    id: "antibiotics-cephalosporins",
    name: "Antibiotics - Cephalosporins",
    iconName: "Shield",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-400/10 dark:bg-blue-950/20"
  },
  {
    id: "antibiotics-fluoroquinolones",
    name: "Antibiotics - Fluoroquinolones",
    iconName: "Shield",
    colorClass: "text-indigo-500",
    bgClass: "bg-indigo-500/10 dark:bg-indigo-950/20"
  },
  {
    id: "antibiotics-macrolides",
    name: "Antibiotics - Macrolides",
    iconName: "Shield",
    colorClass: "text-cyan-500",
    bgClass: "bg-cyan-500/10 dark:bg-cyan-950/20"
  },
  {
    id: "antibiotics-others",
    name: "Antibiotics - Others",
    iconName: "Shield",
    colorClass: "text-slate-500",
    bgClass: "bg-slate-500/10 dark:bg-slate-950/20"
  },
  {
    id: "anti-leprosy",
    name: "Anti-Leprosy",
    iconName: "Circle",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/10 dark:bg-slate-950/20"
  },
  {
    id: "anti-malarial",
    name: "Anti-Malarial",
    iconName: "Droplet",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/10 dark:bg-purple-950/20"
  },
  {
    id: "anti-protozoal",
    name: "Anti-Protozoal",
    iconName: "Target",
    colorClass: "text-purple-600",
    bgClass: "bg-purple-600/10 dark:bg-purple-950/20"
  },
  {
    id: "anti-tubercular",
    name: "Anti-Tubercular",
    iconName: "Wind",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-950/20"
  },
  {
    id: "anti-helmintics",
    name: "Anti-Helmintics",
    iconName: "Crosshair",
    colorClass: "text-amber-600",
    bgClass: "bg-amber-600/10 dark:bg-amber-950/20"
  },
  {
    id: "anti-convulsants",
    name: "Anti-Convulsants",
    iconName: "Zap",
    colorClass: "text-pink-500",
    bgClass: "bg-pink-500/10 dark:bg-pink-950/20"
  },
  {
    id: "anti-emetics",
    name: "Anti-Emetics",
    iconName: "RotateCcw",
    colorClass: "text-teal-500",
    bgClass: "bg-teal-500/10 dark:bg-teal-950/20"
  },
  {
    id: "anti-histaminics",
    name: "Anti-Histaminics",
    iconName: "Leaf",
    colorClass: "text-fuchsia-500",
    bgClass: "bg-fuchsia-500/10 dark:bg-fuchsia-950/20"
  },
  {
    id: "anti-hypertensives",
    name: "Anti-Hypertensives",
    iconName: "Heart",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10 dark:bg-red-950/20"
  },
  {
    id: "diuretics",
    name: "Diuretics",
    iconName: "Droplet",
    colorClass: "text-sky-600",
    bgClass: "bg-sky-600/10 dark:bg-sky-950/20"
  },
  {
    id: "steroids-hormones",
    name: "Steroids/Hormones",
    iconName: "Sun",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10 dark:bg-amber-950/20"
  },
  {
    id: "anti-viral",
    name: "Anti-Viral",
    iconName: "ShieldAlert",
    colorClass: "text-cyan-600",
    bgClass: "bg-cyan-600/10 dark:bg-cyan-950/20"
  },
  {
    id: "sedation",
    name: "Sedation",
    iconName: "Moon",
    colorClass: "text-violet-500",
    bgClass: "bg-violet-500/10 dark:bg-violet-950/20"
  },
  {
    id: "bronchodilators",
    name: "Bronchodilators",
    iconName: "Wind",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-400/10 dark:bg-sky-950/20"
  },
  {
    id: "cardiotonics",
    name: "Cardiotonics",
    iconName: "Heart",
    colorClass: "text-rose-600",
    bgClass: "bg-rose-600/10 dark:bg-rose-950/20"
  },
  {
    id: "supplements-vitamins",
    name: "Supplements/Vitamins",
    iconName: "PlusCircle",
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-600/10 dark:bg-emerald-950/20"
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    iconName: "Box",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/10 dark:bg-slate-950/20"
  }
];

export const PEDIATRIC_DRUGS: PediatricDrug[] = [
  ...ANALGESICS_DRUGS,
  ...ANTIBIOTICS_DRUGS,
  ...ANTICONVULSANTS_DRUGS,
  ...ANTIHISTAMINICS_DRUGS,
  ...STEROIDS_DRUGS,
  ...COMBINATION_DRUGS,
  ...GASTROINTESTINAL_DRUGS
];
