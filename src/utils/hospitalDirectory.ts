// ============================================================
// ErMate — Hospital Directory
// File: src/utils/hospitalDirectory.ts
// ============================================================
// A shared list of HOSPITALS ONLY (name, place, district, state).
// It never stores which doctor works where. Entries created by users
// start as "unverified"; only the platform admin can edit or merge them.
// Picking a hospital from the directory is NOT proof of membership —
// team access still requires verified approval (team_members).

import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";

export const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export interface HospitalDirectoryEntry {
  id: string;
  name: string;
  place: string;
  district: string;
  state: string;
  status?: string;
}

/** "M.B.M. Hospital, Kochi" -> "mbm-hospital-kochi" */
export function directoryKey(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[.'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** One document per hospital name + district + state. */
export function hospitalDirectoryId(name: string, district: string, state: string): string {
  return `${directoryKey(name)}__${directoryKey(district)}__${directoryKey(state)}`.slice(0, 300);
}

export function formatHospitalLocation(e: Pick<HospitalDirectoryEntry, "place" | "district" | "state">): string {
  return [e.place, e.district, e.state].map(s => (s || "").trim()).filter(Boolean).join(", ");
}

/** Prefix search on hospital name. Returns [] on any error (never blocks the form). */
export async function searchHospitalDirectory(typed: string, max = 8): Promise<HospitalDirectoryEntry[]> {
  const prefix = directoryKey(typed);
  if (prefix.length < 2) return [];
  try {
    const snap = await getDocs(query(
      collection(db, "hospital_directory"),
      where("nameKey", ">=", prefix),
      where("nameKey", "<=", prefix + String.fromCharCode(0xf8ff)),
      limit(max)
    ));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as HospitalDirectoryEntry[];
  } catch (err) {
    console.warn("[HospitalDirectory] search failed:", err);
    return [];
  }
}

/**
 * Adds the hospital to the directory if it is not there yet and returns its id.
 * Existing entries are never modified by users.
 */
export async function ensureHospitalDirectoryEntry(input: { name: string; place: string; district: string; state: string }): Promise<string> {
  const name = input.name.trim().slice(0, 100);
  const place = input.place.trim().slice(0, 100);
  const district = input.district.trim().slice(0, 60);
  const state = input.state.trim().slice(0, 60);
  const id = hospitalDirectoryId(name, district, state);
  const ref = doc(db, "hospital_directory", id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      name,
      nameKey: directoryKey(name),
      place,
      district,
      state,
      status: "unverified",
      createdAt: new Date().toISOString(),
    });
  }
  return id;
}
