/**
 * Recursively cleans objects before saving to Firestore.
 * Strips any properties whose value is `undefined` so that Firestore
 * `setDoc`, `addDoc`, or `updateDoc` calls do not throw:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T, visited = new WeakSet()): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (data instanceof Date) {
    return data as unknown as T;
  }
  if (visited.has(data)) {
    // Avoid circular reference infinite loop
    return null as unknown as T;
  }
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item, visited)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      cleanObj[key] = sanitizeForFirestore(val, visited);
    }
  }
  return cleanObj as T;
}
