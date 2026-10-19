/**
 * Clinician-update timestamps.
 * The server has no idea of the clinician's time zone (its clock is UTC), so a server-formatted
 * "hh:mm" shows the wrong time on the case sheet. Each update therefore carries the exact instant
 * (`at`, ISO-8601 UTC) and a display time formatted on the clinician's own device.
 */
const HM: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

export function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString([], HM);
}

export function stampClinicianUpdates<T extends Record<string, any>>(fields: T, now: Date = new Date()): T {
  if (!fields || !Array.isArray((fields as any).clinicianUpdates)) return fields;
  const at = now.toISOString();
  const timestamp = formatLocalTime(now);
  const stamped = (fields as any).clinicianUpdates
    .map((u: any) => (typeof u === "string" ? { text: u } : u))
    .filter((u: any) => u && typeof u.text === "string" && u.text.trim())
    .map((u: any) => ({ ...u, at, timestamp }));
  return { ...fields, clinicianUpdates: stamped };
}

/** Display time for an update: derived from the instant when present, else the stored string, else now. */
export function displayTimeForUpdate(item: any, now: Date = new Date()): string {
  if (item && typeof item === "object") {
    if (typeof item.at === "string") {
      const d = new Date(item.at);
      if (!Number.isNaN(d.getTime())) return formatLocalTime(d);
    }
    if (typeof item.timestamp === "string" && item.timestamp.trim()) return item.timestamp;
  }
  return formatLocalTime(now);
}
