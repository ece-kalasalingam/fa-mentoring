const INTERNAL_ID_KEY = /(^id$|_id$)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeResponsePayload<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeResponsePayload(item)) as T;
  }
  if (!isPlainObject(input)) {
    return input;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    // Strip internal database identifiers by convention:
    // - id
    // - *_id (snake_case/internal foreign keys)
    // Public identifiers should use names like publicId, userRef, slug, etc.
    if (INTERNAL_ID_KEY.test(key)) {
      continue;
    }
    out[key] = sanitizeResponsePayload(value);
  }
  return out as T;
}
