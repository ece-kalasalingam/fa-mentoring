import type { AdminDashboard } from "./types";

export type TursoUsageMetric = {
  label: "Reads" | "Writes" | "Syncs" | "Storage";
  value: number;
  max: number;
  isBytes: boolean;
};

export const TURSO_USAGE_METRICS: TursoUsageMetric[] = [
  { label: "Reads", value: 0, max: 500_000_000, isBytes: false },
  { label: "Writes", value: 0, max: 10_000_000, isBytes: false },
  { label: "Syncs", value: 0, max: 3_000_000_000, isBytes: true },
  { label: "Storage", value: 0, max: 5_000_000_000, isBytes: true },
];

export function getTursoUsageMetrics(system: AdminDashboard["system"]): TursoUsageMetric[] {
  if (!system?.turso) return TURSO_USAGE_METRICS;
  return [
    { label: "Reads", value: Number(system.turso.rowsRead ?? 0), max: 500_000_000, isBytes: false },
    { label: "Writes", value: Number(system.turso.rowsWritten ?? 0), max: 10_000_000, isBytes: false },
    { label: "Syncs", value: Number(system.turso.bytesSynced ?? 0), max: 3_000_000_000, isBytes: true },
    { label: "Storage", value: Number(system.turso.storageBytes ?? 0), max: 5_000_000_000, isBytes: true },
  ];
}

export function isTursoUsageAvailable(system: AdminDashboard["system"]): boolean {
  return Boolean(system?.turso);
}

export function formatTursoValue(value: number, isBytes: boolean): string {
  if (isBytes) {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)} KB`;
    return `${value} B`;
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

export function getTursoProgressColor(pct: number): "error" | "warning" | "success" {
  if (pct > 80) return "error";
  if (pct > 50) return "warning";
  return "success";
}
