export function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function toYear(value: unknown): number {
  const year = Number.parseInt(normalizeText(value), 10);
  if (!Number.isFinite(year) || year < 1970 || year > 2070) {
    throw new Error(`Invalid batch_start_year: ${value}`);
  }
  return year;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
