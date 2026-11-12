/**
 * ErMate — ICU Mode Firestore access (Phase 1, personal workspace).
 * Paths: users/{uid}/icuUnits, users/{uid}/icuAdmissions, users/{uid}/icuAdmissions/{id}/notes
 */

import {
  collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, where, getDocs, limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { sanitizeForFirestore } from "../utils/firestoreSanitizer";
import type { IcuAdmission, IcuAdmissionSource, IcuNote, IcuOutcome, IcuUnit, IcuUnitType } from "./icuTypes";
import {
  IcuProblemsPreview, carryForwardNote, fastHugsGapCount, newId, newNote, supportChips,
} from "./icuLogic";

function uidOrThrow(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Please sign in again.");
  return uid;
}

const unitsCol = (uid: string) => collection(db, "users", uid, "icuUnits");
const admCol = (uid: string) => collection(db, "users", uid, "icuAdmissions");
const notesCol = (uid: string, admId: string) => collection(db, "users", uid, "icuAdmissions", admId, "notes");

// ── Units ─────────────────────────────────────────────────────
export function subscribeUnits(onData: (u: IcuUnit[]) => void, onError: (e: Error) => void): () => void {
  const uid = uidOrThrow();
  return onSnapshot(
    query(unitsCol(uid), orderBy("createdAt", "asc")),
    (snap) => onData(snap.docs.map((d) => d.data() as IcuUnit)),
    (err) => onError(err),
  );
}

export async function createUnit(args: { name: string; type: IcuUnitType; bedCount: number }): Promise<IcuUnit> {
  const uid = uidOrThrow();
  const name = args.name.trim().slice(0, 40);
  if (!name) throw new Error("Enter a unit name, e.g. MICU 1.");
  const count = Math.round(args.bedCount);
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error("Beds must be a whole number from 1 to 60.");
  const unit: IcuUnit = {
    id: newId("unit"), name, type: args.type,
    beds: Array.from({ length: count }, (_, i) => String(i + 1)),
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(unitsCol(uid), unit.id), sanitizeForFirestore(unit));
  return unit;
}

// ── Admissions ────────────────────────────────────────────────
export function subscribeActiveAdmissions(onData: (a: IcuAdmission[]) => void, onError: (e: Error) => void): () => void {
  const uid = uidOrThrow();
  return onSnapshot(
    query(admCol(uid), where("status", "==", "active")),
    (snap) => onData(snap.docs.map((d) => d.data() as IcuAdmission)),
    (err) => onError(err),
  );
}

export async function admitPatient(args: {
  unit: IcuUnit; bed: string; patientLabel: string; uhid?: string; ageYears?: number | null;
  sex?: "M" | "F" | "Other" | null; source: IcuAdmissionSource; occupiedBeds: Set<string>;
}): Promise<IcuAdmission> {
  const uid = uidOrThrow();
  const label = args.patientLabel.trim().slice(0, 100);
  if (!label) throw new Error("Enter the patient's name or label.");
  if (!args.unit.beds.includes(args.bed)) throw new Error("Pick a bed in this unit.");
  if (args.occupiedBeds.has(`${args.unit.id}|${args.bed}`)) throw new Error(`${args.unit.name} Bed ${args.bed} is occupied.`);
  const now = new Date().toISOString();
  const age = typeof args.ageYears === "number" && Number.isFinite(args.ageYears) && args.ageYears >= 0 && args.ageYears < 130
    ? Math.floor(args.ageYears) : null;
  const adm: IcuAdmission = {
    id: newId("adm"), patientLabel: label, uhid: args.uhid?.trim().slice(0, 40) || null,
    ageYears: age, sex: args.sex || null, source: args.source, admittedAt: now,
    status: "active", outcome: null, outcomeAt: null,
    unitId: args.unit.id, unitName: args.unit.name, unitType: args.unit.type, bed: args.bed,
    stays: [{ unitId: args.unit.id, unitName: args.unit.name, bed: args.bed, inAt: now, outAt: null }],
    problemsPreview: null, supportChips: [], fastHugsGapCount: 11, openFlagCount: 0, latestNoteId: null, updatedAt: now,
  };
  await setDoc(doc(admCol(uid), adm.id), sanitizeForFirestore(adm));
  return adm;
}

export async function moveBed(adm: IcuAdmission, unit: IcuUnit, bed: string, occupiedBeds: Set<string>): Promise<void> {
  const uid = uidOrThrow();
  if (!unit.beds.includes(bed)) throw new Error("Pick a bed in this unit.");
  if (adm.unitId === unit.id && adm.bed === bed) return;
  if (occupiedBeds.has(`${unit.id}|${bed}`)) throw new Error(`${unit.name} Bed ${bed} is occupied.`);
  const now = new Date().toISOString();
  const stays = adm.stays.map((s) => (s.outAt ? s : { ...s, outAt: now }));
  stays.push({ unitId: unit.id, unitName: unit.name, bed, inAt: now, outAt: null });
  await updateDoc(doc(admCol(uid), adm.id), sanitizeForFirestore({
    unitId: unit.id, unitName: unit.name, unitType: unit.type, bed, stays, updatedAt: now,
  }));
}

export async function closeAdmission(adm: IcuAdmission, outcome: IcuOutcome): Promise<void> {
  const uid = uidOrThrow();
  const now = new Date().toISOString();
  const stays = adm.stays.map((s) => (s.outAt ? s : { ...s, outAt: now }));
  await updateDoc(doc(admCol(uid), adm.id), { status: "closed", outcome, outcomeAt: now, stays, updatedAt: now });
}

// ── Notes ─────────────────────────────────────────────────────
export function subscribeNotes(admId: string, onData: (n: IcuNote[]) => void, onError: (e: Error) => void): () => void {
  const uid = uidOrThrow();
  return onSnapshot(
    query(notesCol(uid, admId), orderBy("createdAt", "desc")),
    (snap) => onData(snap.docs.map((d) => d.data() as IcuNote)),
    (err) => onError(err),
  );
}

/** First note = admission note; afterwards a daily note carrying forward the stable record. */
export async function startNote(adm: IcuAdmission, authorName: string | null): Promise<IcuNote> {
  const uid = uidOrThrow();
  const prevSnap = await getDocs(query(notesCol(uid, adm.id), orderBy("createdAt", "desc"), limit(1)));
  const prev = prevSnap.empty ? null : (prevSnap.docs[0].data() as IcuNote);
  const note = prev
    ? carryForwardNote(prev, { authorUid: uid, authorName })
    : newNote({ admissionId: adm.id, kind: "admission", authorUid: uid, authorName });
  await setDoc(doc(notesCol(uid, adm.id), note.id), sanitizeForFirestore(note));
  await refreshCensus(adm.id, note);
  return note;
}

export async function saveNote(note: IcuNote): Promise<void> {
  const uid = uidOrThrow();
  if (note.status === "signed") throw new Error("This note is signed and can no longer be edited.");
  const next = { ...note, updatedAt: new Date().toISOString() };
  await setDoc(doc(notesCol(uid, note.admissionId), note.id), sanitizeForFirestore(next));
  await refreshCensus(note.admissionId, next);
}

export async function signNote(note: IcuNote): Promise<void> {
  const uid = uidOrThrow();
  const now = new Date().toISOString();
  const next = { ...note, status: "signed" as const, signedAt: now, updatedAt: now };
  await setDoc(doc(notesCol(uid, note.admissionId), note.id), sanitizeForFirestore(next));
  await refreshCensus(note.admissionId, next);
}

/** Task ticks are allowed on signed notes (rules permit only tasks/updatedAt to change). */
export async function saveTasks(note: IcuNote): Promise<void> {
  const uid = uidOrThrow();
  await updateDoc(doc(notesCol(uid, note.admissionId), note.id), sanitizeForFirestore({
    tasks: note.tasks, updatedAt: new Date().toISOString(),
  }));
}

async function refreshCensus(admId: string, note: IcuNote): Promise<void> {
  const uid = uidOrThrow();
  try {
    await updateDoc(doc(admCol(uid), admId), sanitizeForFirestore({
      problemsPreview: IcuProblemsPreview(note.sections.problems),
      supportChips: supportChips(note),
      fastHugsGapCount: fastHugsGapCount(note.fastHugs),
      openFlagCount: note.flags.filter((f) => !f.resolved).length,
      latestNoteId: note.id,
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    // Census badges are a convenience; the note itself is already saved.
    console.warn("[ICU] census refresh failed", e);
  }
}