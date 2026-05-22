/**
 * Returns up to 2 initials from a display name.
 * Two+ words → first letter of first + last word.
 * One word → first two characters.
 * Empty string → "?".
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export const ROLE_COLORS: Record<string, "error" | "warning" | "secondary" | "primary" | "success" | "default"> = {
  admin: "error",
  moderator: "warning",
  head: "secondary",
  faculty: "primary",
  student: "success",
  guest: "default",
};

// Shared MUI table prop objects — spread these into MaterialReactTable props to keep
// visual style consistent across all table instances.
export const MUI_TABLE_PAPER_PROPS = {
  elevation: 0,
  sx: { border: "1px solid", borderColor: "divider", borderRadius: 2 },
} as const;

export const MUI_TABLE_CONTAINER_PROPS = { sx: { overflowX: "auto" } } as const;

export const MUI_TABLE_BODY_PROPS = {
  sx: { "& tr:nth-of-type(odd) > td": { backgroundColor: "action.hover" } },
} as const;

export const MUI_TABLE_HEAD_CELL_PROPS = {
  sx: { fontWeight: 700, fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", py: 1.25, whiteSpace: "nowrap" },
} as const;

export const MUI_TABLE_BODY_CELL_PROPS = { sx: { py: 1 } } as const;

export { computeCreditStatus } from "#shared/creditStatus";

export function normalizeCredits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function formatCredits(value: number): string {
  const normalized = normalizeCredits(value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2);
}

export const MUI_TABLE_PAGINATION_PROPS_BASE = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
] as const;
