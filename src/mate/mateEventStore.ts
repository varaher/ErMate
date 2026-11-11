/**
 * ErMate — shared MATE Events store (MATE Events Phase 1, Step 8).
 *
 * useMateEvents (mounted once in App.tsx) publishes the live event list and the
 * doctor actions here. Any component (case cards, bell) reads them with
 * useMateEventStore() — no prop drilling through App.tsx.
 */

import { useSyncExternalStore } from "react";
import type { MateEvent } from "../utils/mateEventEngine";

export interface MateEventActions {
  seen: (eventId: string) => Promise<boolean>;
  reviewed: (eventId: string) => Promise<boolean>;
  snooze: (eventId: string, minutes: number) => Promise<boolean>;
}

interface MateEventState {
  events: MateEvent[];
  actions: MateEventActions | null;
}

let state: MateEventState = { events: [], actions: null };
const listeners = new Set<() => void>();

export function publishMateEvents(events: MateEvent[], actions: MateEventActions | null): void {
  state = { events, actions };
  listeners.forEach((l) => {
    try { l(); } catch { /* a broken listener must not stop the others */ }
  });
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): MateEventState {
  return state;
}

export function useMateEventStore(): MateEventState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}