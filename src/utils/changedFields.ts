// Autosave sends ONLY what this device changed, so a stale copy of an untouched field can never
// overwrite another device's newer edit. Used with setDoc(..., { merge: true }), which deep-merges maps.
const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** Leaves of `next` that differ from `base`. Arrays and scalars are compared whole; plain objects recurse.
 *  Keys missing from `next` are never deleted (undefined = "not touched"). */
export function diffForWrite(base: any, next: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlain(next)) return out;
  const b = isPlain(base) ? base : {};
  for (const key of Object.keys(next)) {
    const nv = (next as any)[key];
    if (nv === undefined) continue;
    const bv = b[key];
    if (isPlain(nv) && isPlain(bv)) {
      const sub = diffForWrite(bv, nv);
      if (Object.keys(sub).length) out[key] = sub;
    } else if (JSON.stringify(nv) !== JSON.stringify(bv)) {
      out[key] = nv;
    }
  }
  return out;
}