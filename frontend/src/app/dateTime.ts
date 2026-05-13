function normalizeUtcText(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return normalized.endsWith("Z") ? normalized : `${normalized}Z`;
}

export function formatIst(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(normalizeUtcText(value));
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

export function formatIstHourMinute(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(normalizeUtcText(value));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
