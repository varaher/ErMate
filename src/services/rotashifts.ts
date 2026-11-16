import { authenticatedFetch } from "./authenticatedFetch";
import type { RotaShift } from "../lib/rotasync";

export interface MyShift {
  id: string;
  shiftType: string;
  startIso: string;
  endIso: string;
  teamName: string;
  publishedAt: string;
}

/** HOD / Rota Manager: save the checked shifts on the server so each doctor's ErMate can remind them. */
export async function publishRota(shifts: RotaShift[]): Promise<{ saved: number; skipped: number; doctors: number }> {
  const res = await authenticatedFetch("/api/team/rota/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shifts }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Could not save the rota in ErMate.");
  return { saved: data.saved || 0, skipped: data.skipped || 0, doctors: data.doctors || 0 };
}

/** The signed-in doctor's own upcoming shifts. */
export async function fetchMyShifts(): Promise<{ shifts: MyShift[]; latestPublishedAt: string }> {
  const res = await authenticatedFetch("/api/team/rota/my-shifts");
  if (!res.ok) throw new Error("Could not load shifts.");
  const data = await res.json();
  return { shifts: Array.isArray(data.shifts) ? data.shifts : [], latestPublishedAt: data.latestPublishedAt || "" };
}