import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { CreditStatus, FacultyCreditTableRow, FacultyStudentRow, PlanOfStudy, Regulation } from "./types";
import { CREDIT_STATUSES, CREDIT_STATUS_LABELS } from "./constants";
import { computeCreditStatus, formatCredits, normalizeCredits } from "./utils";

// ── Internal status types ─────────────────────────────────────────────────────
type OverallStatus = CreditStatus;

function catStatus(earned: number, required: number, expected: number): CreditStatus {
  return computeCreditStatus(required, earned, expected);
}

const OVERALL_STATUS_ORDER: readonly OverallStatus[] = CREDIT_STATUSES;
const OVERALL_LABELS = CREDIT_STATUS_LABELS;

// ── Data types ────────────────────────────────────────────────────────────────
type CategoryAnalytic = {
  code: string;
  name: string;
  totalRequired: number;
  totalEarned: number;
  completionPct: number;
  counts: Record<CreditStatus, number>;
};

type StudentAnalytic = {
  userId: string;
  registrationNumber: string;
  fullName: string;
  batch: number | null;
  currentSemester: number | null;
  graduated: "Yes" | "No";
  planName: string;
  totalRequired: number;
  totalEarned: number;
  completionPct: number;
  overallStatus: OverallStatus;
  categoryStatuses: Record<string, { earned: number; required: number; status: CreditStatus }>;
};

type Props = {
  students: FacultyStudentRow[];
  creditRows: FacultyCreditTableRow[];
  plansOfStudy: PlanOfStudy[];
  regulations: Regulation[];
  onViewStudents?: (creditStatusFilter: CreditStatus | null, batchFilter: number | null) => void;
  defaultExpandFirstBatch?: boolean;
  showBatchStatusByLabelCard?: boolean;
  chartOnly?: boolean;
};

// ── Colour helpers ────────────────────────────────────────────────────────────
function overallStatusColor(status: OverallStatus, theme: ReturnType<typeof useTheme>): string {
  switch (status) {
    case "complete":  return theme.palette.success.main;
    case "on-track":  return theme.palette.primary.main;
    case "marginal":  return theme.palette.warning.main;
    case "off-track": return theme.palette.error.main;
  }
}
function overallChipColor(status: OverallStatus): "success" | "primary" | "warning" | "error" {
  switch (status) {
    case "complete":  return "success";
    case "on-track":  return "primary";
    case "marginal":  return "warning";
    case "off-track": return "error";
  }
}

// ── Build category analytics from a student list ──────────────────────────────
function buildCategoryAnalytics(students: StudentAnalytic[], catNameMap: Map<string, string>): CategoryAnalytic[] {
  const allCodes = new Set<string>();
  for (const sa of students) for (const code of Object.keys(sa.categoryStatuses)) allCodes.add(code);

  return Array.from(allCodes)
    .map((code) => {
      const counts: Record<CreditStatus, number> = { complete: 0, "on-track": 0, marginal: 0, "off-track": 0 };
      let totalRequired = 0, totalEarned = 0;
      for (const sa of students) {
        const info = sa.categoryStatuses[code];
        if (info) { counts[info.status]++; totalRequired += info.required; totalEarned += info.earned; }
      }
      const completionPct = totalRequired > 0 ? Math.round((totalEarned / totalRequired) * 100) : 0;
      return {
        code,
        name: catNameMap.get(code) ?? code,
        totalRequired: normalizeCredits(totalRequired),
        totalEarned: normalizeCredits(totalEarned),
        completionPct,
        counts,
      };
    })
    .filter((c) => c.totalRequired > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ── BatchPanel ────────────────────────────────────────────────────────────────
type BatchPanelProps = {
  batch: number | null;
  batchLabel: string;
  students: StudentAnalytic[];
  catNameMap: Map<string, string>;
  onViewStudents?: (status: CreditStatus | null, batchFilter: number | null) => void;
};

// ── Tooltip that activates only when text is actually clipped ─────────────────
function OverflowTooltip({ text, sx }: { text: string; sx?: object }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setActive(el.scrollWidth > el.clientWidth);
  }, [text]);
  return (
    <Tooltip title={active ? text : ""} placement="top" arrow disableInteractive>
      <Box component="span" ref={ref} sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...sx }}>
        {text}
      </Box>
    </Tooltip>
  );
}

function BatchPanel({ batch, batchLabel, students, catNameMap, onViewStudents }: BatchPanelProps) {
  const theme = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isDark = theme.palette.mode === "dark";
  const echartsTheme = isDark ? "dark" : undefined;

  const [statusFilter, setStatusFilter] = useState<OverallStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<{ code: string; status: CreditStatus } | null>(null);

  const toggleStatusFilter = (s: OverallStatus) => {
    setStatusFilter((prev) => (prev === s ? null : s));
    setCategoryFilter(null);
  };

  const toggleCategoryFilter = useCallback((code: string, status: CreditStatus) => {
    setCategoryFilter((prev) => (prev?.code === code && prev?.status === status ? null : { code, status }));
    setStatusFilter(null);
  }, []);

  const { statusCounts, categoryAnalytics, grandRequired, grandEarned, grandPct } = useMemo(() => {
    const statusCounts: Record<OverallStatus, number> = { complete: 0, "on-track": 0, marginal: 0, "off-track": 0 };
    for (const sa of students) statusCounts[sa.overallStatus]++;
    const categoryAnalytics = buildCategoryAnalytics(students, catNameMap);
    const grandRequired = students.reduce((s, a) => s + a.totalRequired, 0);
    const grandEarned   = students.reduce((s, a) => s + a.totalEarned, 0);
    const grandPct = grandRequired > 0 ? Math.round((grandEarned / grandRequired) * 100) : 0;
    return { statusCounts, categoryAnalytics, grandRequired, grandEarned, grandPct };
  }, [students, catNameMap]);

  const filteredStudents = useMemo(() => {
    if (statusFilter) return students.filter((sa) => sa.overallStatus === statusFilter);
    if (categoryFilter) return students.filter((sa) => sa.categoryStatuses[categoryFilter.code]?.status === categoryFilter.status);
    return students;
  }, [students, statusFilter, categoryFilter]);

  // ── Donut ──────────────────────────────────────────────────────────────────
  const donutOption = useMemo<EChartsOption>(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "item", formatter: "{b}: <strong>{c}</strong> ({d}%)" },
    series: [{
      type: "pie",
      radius: ["42%", "70%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
      data: OVERALL_STATUS_ORDER
        .filter((s) => statusCounts[s] > 0)
        .map((s) => ({
          value: statusCounts[s],
          name: OVERALL_LABELS[s],
          itemStyle: { color: overallStatusColor(s, theme) },
        })),
    }],
  }), [statusCounts, theme]);

  // ── Category horizontal stacked bar ───────────────────────────────────────
  const barOption = useMemo<EChartsOption>(() => {
    const textColor = theme.palette.text.primary;
    const gridLine = isDark ? "#333" : "#f0f0f0";
    const total = students.length;
    const makeLabel = (v: number) => (v > 0 ? String(v) : "");
    const labelFontSize = isMobile ? 9 : 11;

    const series = (
      [
        { name: "Complete",  key: "complete"  as CreditStatus, color: theme.palette.success.main,      labelColor: "#fff" },
        { name: "On Track",  key: "on-track"  as CreditStatus, color: theme.palette.primary.main,      labelColor: "#fff" },
        { name: "Marginal",  key: "marginal"  as CreditStatus, color: theme.palette.warning.main,      labelColor: isDark ? "#fff" : "#333" },
        { name: "Off Track", key: "off-track" as CreditStatus, color: theme.palette.error.main,        labelColor: "#fff" },
      ] as const
    ).map(({ name, key, color, labelColor }) => ({
      name,
      type: "bar" as const,
      stack: "total",
      data: categoryAnalytics.map((c) => c.counts[key]),
      itemStyle: { color },
      emphasis: { focus: "series" as const },
      label: {
        show: !isMobile,
        position: "inside" as const,
        formatter: ({ value }: { value: number }) => makeLabel(value),
        fontSize: labelFontSize, fontWeight: "bold" as const, color: labelColor,
      },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        confine: true,
        formatter: (rawParams: unknown) => {
          const params = rawParams as Array<{ seriesName: string; value: number; color: string; axisValue: string }>;
          const catCode = params[0]?.axisValue ?? "";
          const cat = categoryAnalytics.find((c) => c.code === catCode);
          let html = `<div style="font-weight:700;margin-bottom:4px">${catCode} — ${cat?.name ?? ""}</div>`;
          for (const p of params) {
            if (p.value === 0) continue;
            const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
            html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.color}"></span>
              <span>${p.seriesName}: <strong>${p.value}</strong> <span style="opacity:0.6">(${pct}%)</span></span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        data: ["Complete", "On Track", "Marginal", "Off Track"],
        textStyle: { color: textColor, fontSize: isMobile ? 10 : 11 },
        itemGap: isMobile ? 8 : 14,
        top: 4,
        type: "scroll" as const,
        width: "90%",
      },
      grid: {
        left: 4,
        right: isMobile ? 4 : 16,
        top: isMobile ? 52 : 40,
        bottom: 4,
        containLabel: true,
      },
      xAxis: {
        type: "value", min: 0, max: total || 1,
        interval: Math.max(1, Math.ceil(total / (isMobile ? 3 : 5))),
        axisLabel: {
          color: theme.palette.text.secondary,
          fontSize: isMobile ? 10 : 11,
          formatter: (v: number) => (Number.isInteger(v) ? String(v) : ""),
        },
        splitLine: { lineStyle: { color: gridLine } },
        axisLine: { lineStyle: { color: gridLine } },
      },
      yAxis: {
        type: "category",
        data: categoryAnalytics.map((c) => c.code),
        inverse: true,
        axisLabel: {
          color: textColor,
          fontSize: isMobile ? 10 : 12,
          fontFamily: "monospace",
          fontWeight: "bold",
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series,
    };
  }, [categoryAnalytics, students.length, theme, isDark, isMobile]);

  // ── Chart click events ─────────────────────────────────────────────────────
  const LABEL_TO_STATUS = useMemo(
    () => Object.fromEntries(CREDIT_STATUSES.map((s) => [OVERALL_LABELS[s], s])) as Record<string, CreditStatus>,
    [],
  );

  const barEvents = useMemo(() => ({
    click: (params: { seriesName: string; name: string; value: number }) => {
      if (!params.value) return;
      const status = LABEL_TO_STATUS[params.seriesName];
      if (status) toggleCategoryFilter(params.name, status);
    },
  }), [LABEL_TO_STATUS, toggleCategoryFilter]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    const catCodes = categoryAnalytics.map((c) => c.code);
    const headers = [
      "Reg. No", "Name", "Batch", "Semester", "Graduated", "Plan",
      "Target Cr.", "Earned Cr.", "Overall %", "Overall Status",
      ...catCodes.flatMap((c) => [`${c} Req`, `${c} Earned`, `${c} Status`]),
    ];
    const rows = students.map((sa) => [
      sa.registrationNumber, sa.fullName,
      sa.batch?.toString() ?? "", sa.currentSemester?.toString() ?? "",
      sa.graduated, sa.planName,
      formatCredits(sa.totalRequired), formatCredits(sa.totalEarned),
      sa.completionPct.toString(), OVERALL_LABELS[sa.overallStatus],
      ...catCodes.flatMap((c) => {
        const info = sa.categoryStatuses[c];
        return info ? [formatCredits(info.required), formatCredits(info.earned), OVERALL_LABELS[info.status]] : [formatCredits(0), formatCredits(0), "—"];
      }),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchLabel.toLowerCase().replace(/\s+/g, "-")}-analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [students, categoryAnalytics, batchLabel]);

  const rowH = isMobile ? 34 : 46;
  const barChartHeight = Math.max(isMobile ? 160 : 200, categoryAnalytics.length * rowH + (isMobile ? 70 : 60));
  const maxCatCols = isMobile ? 0 : isDesktop ? 11 : 3;

  return (
    <Stack spacing={2}>

      {/* Charts row ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>

        {/* Left: Category stacked bar — grows to fill, wraps below ~400px */}
        <Paper variant="outlined" sx={{ flex: "1 1 400px", minWidth: 0, borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Category-wise Student Status</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.73rem", mb: 1.5 }}>
            Per credit category — click a bar segment to filter the student table below.
          </Typography>
          {categoryAnalytics.length > 0 ? (
            <Box sx={{ height: barChartHeight, width: "100%", minWidth: 0, overflow: "hidden" }}>
              <ReactECharts theme={echartsTheme} option={barOption} notMerge lazyUpdate onEvents={barEvents} style={{ height: "100%", width: "100%", cursor: "pointer" }} />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No category data recorded yet.</Typography>
          )}
        </Paper>

        {/* Right: Donut + status legend + credit totals — fixed basis, won't grow */}
        <Paper variant="outlined" sx={{ flex: "0 1 380px", minWidth: 300, borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Overall Distribution</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.73rem", mb: 1 }}>
            Click a legend row to filter the student table below.
          </Typography>
          <Box sx={{ height: 180, width: "100%", minWidth: 0, overflow: "hidden" }}>
            <ReactECharts theme={echartsTheme} option={donutOption} notMerge lazyUpdate style={{ height: "100%", width: "100%" }} />
          </Box>

          <Divider sx={{ my: 1.25 }} />
          <Stack spacing={0.5}>
            {OVERALL_STATUS_ORDER.map((s) => {
              const color = overallStatusColor(s, theme);
              const isActive = statusFilter === s;
              return (
                <Box key={s} onClick={() => toggleStatusFilter(s)} sx={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  px: 1, py: 0.5, borderRadius: 1, cursor: "pointer",
                  bgcolor: isActive ? alpha(color, 0.12) : "transparent",
                  border: isActive ? `1px solid ${alpha(color, 0.4)}` : "1px solid transparent",
                  "&:hover": { bgcolor: alpha(color, 0.07) }, transition: "all 0.12s",
                }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>{OVERALL_LABELS[s]}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem" }}>{statusCounts[s]}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                      {students.length > 0 ? `${Math.round((statusCounts[s] / students.length) * 100)}%` : "—"}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>

          <Divider sx={{ my: 1.25 }} />
          <Stack spacing={0.5} sx={{ px: 0.5 }}>
            {[
              { label: "Credits target", value: formatCredits(grandRequired), color: undefined },
              { label: "Credits earned", value: formatCredits(grandEarned), color: "success.main" as const },
              { label: "Completion", value: `${grandPct}%`, color: undefined },
            ].map(({ label, value, color }) => (
              <Stack key={label} direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>{label}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.7rem", color: color ?? "text.primary" }}>{value}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Box>

      {/* Category detail cards ──────────────────────────────────────────────── */}
      {categoryAnalytics.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>Category Detail</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 1.5 }}>
            {categoryAnalytics.map((cat) => {
              const atRisk = cat.counts.marginal + cat.counts["off-track"];
              const isHighlighted = categoryFilter?.code === cat.code;
              const highlightColor = isHighlighted ? overallStatusColor(categoryFilter!.status, theme) : undefined;
              return (
                <Paper key={cat.code} variant="outlined" sx={{
                  borderRadius: 2, p: 2,
                  ...(isHighlighted && {
                    borderColor: highlightColor,
                    borderWidth: 2,
                    bgcolor: alpha(highlightColor!, 0.06),
                    boxShadow: `0 0 0 2px ${alpha(highlightColor!, 0.18)}`,
                  }),
                  transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem" }}>
                      {cat.code}
                    </Typography>
                    <Chip size="small" label={`${cat.completionPct}%`}
                      color={cat.completionPct >= 100 ? "success" : cat.completionPct >= 60 ? "primary" : cat.completionPct >= 30 ? "warning" : "error"}
                      variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", display: "block", mb: 1.5, lineHeight: 1.4 }}>
                    {cat.name}
                  </Typography>
                  <Stack spacing={0.75}>
                    {CREDIT_STATUSES.map((s) => {
                      const n = cat.counts[s];
                      const color = overallStatusColor(s, theme);
                      const pct = students.length > 0 ? Math.round((n / students.length) * 100) : 0;
                      return (
                        <Stack key={s} direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{OVERALL_LABELS[s]}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.82rem", color: n > 0 ? color : "text.disabled" }}>{n}</Typography>
                            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "text.disabled" }}>{pct > 0 ? `${pct}%` : ""}</Typography>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                  <Box sx={{ mt: 1.25, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                    {atRisk > 0 ? (
                      <Typography variant="caption" sx={{ fontSize: "0.72rem", color: "warning.main", fontWeight: 600 }}>
                        {atRisk} student{atRisk === 1 ? "" : "s"} need attention
                      </Typography>
                    ) : (
                      <Typography variant="caption" sx={{ fontSize: "0.72rem", color: "success.main", fontWeight: 600 }}>
                        All on track ✓
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Student detail table ────────────────────────────────────────────────── */}
      <Box data-noprint>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }} spacing={1} sx={{ mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Student Detail
              {statusFilter ? ` — ${OVERALL_LABELS[statusFilter]} (${filteredStudents.length})`
                : categoryFilter ? ` — ${categoryFilter.code} · ${OVERALL_LABELS[categoryFilter.status]} (${filteredStudents.length})`
                : ` (${students.length})`}
            </Typography>
            {statusFilter && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.72rem", mt: 0.25 }}>
                Filtered by overall status: {OVERALL_LABELS[statusFilter]}. Click the legend to change or clear.
              </Typography>
            )}
            {categoryFilter && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.72rem", mt: 0.25 }}>
                Filtered by category <strong>{categoryFilter.code}</strong> · {OVERALL_LABELS[categoryFilter.status]}. Click the bar segment again to clear.
              </Typography>
            )}
          </Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
            {onViewStudents && CREDIT_STATUSES.map((s) => statusCounts[s] > 0 && (
              <Chip key={s} size="small" label={`${OVERALL_LABELS[s]} (${statusCounts[s]})`}
                color={overallChipColor(s)} variant="outlined"
                onClick={() => onViewStudents(s, batch)}
                sx={{ fontSize: "0.62rem", height: 22, cursor: "pointer" }}
              />
            ))}
            <Button size="small" variant="outlined" startIcon={<DownloadIcon fontSize="small" />} onClick={handleExportCsv} sx={{ flexShrink: 0 }}>
              CSV
            </Button>
          </Stack>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 400, overflowX: "auto" }}>
          <Table size="small" stickyHeader sx={{ tableLayout: "auto" }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", py: 1, whiteSpace: "nowrap", bgcolor: "background.paper" } }}>
                <TableCell sx={{ minWidth: 28 }}>#</TableCell>
                <TableCell sx={{ minWidth: isMobile ? 90 : 110 }}>Reg. No</TableCell>
                <TableCell sx={{ minWidth: isMobile ? 100 : 130 }}>Name</TableCell>
                {!isMobile && <TableCell align="center" sx={{ minWidth: 44 }}>Sem</TableCell>}
                {!isMobile && <TableCell align="right" sx={{ minWidth: 56 }}>Target</TableCell>}
                {!isMobile && <TableCell align="right" sx={{ minWidth: 56 }}>Earned</TableCell>}
                {!isMobile && <TableCell align="right" sx={{ minWidth: 44 }}>%</TableCell>}
                {isMobile  && <TableCell align="right" sx={{ minWidth: 72 }}>Cr. Earned / Target</TableCell>}
                <TableCell sx={{ minWidth: 80 }}>Status</TableCell>
                {categoryAnalytics.slice(0, maxCatCols).map((cat) => (
                  <Tooltip key={cat.code} title={cat.name} placement="top" arrow>
                    <TableCell align="center" sx={{ minWidth: 50, fontFamily: "monospace", fontSize: "0.68rem", cursor: "help" }}>
                      {cat.code}
                    </TableCell>
                  </Tooltip>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.map((sa, idx) => (
                <TableRow key={sa.userId} sx={{ "& td": { py: 0.75 }, "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}>
                  <TableCell sx={{ color: "text.disabled", fontSize: "0.7rem" }}>{idx + 1}</TableCell>
                  <TableCell sx={{ maxWidth: isMobile ? 90 : 120 }}>
                    <OverflowTooltip text={sa.registrationNumber} sx={{ fontFamily: "monospace", fontSize: "0.75rem" }} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: isMobile ? 110 : 150 }}>
                    <OverflowTooltip text={sa.fullName} sx={{ fontSize: "0.8rem" }} />
                  </TableCell>
                  {!isMobile && <TableCell align="center" sx={{ fontSize: "0.8rem" }}>{sa.currentSemester ?? "—"}</TableCell>}
                  {!isMobile && <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{formatCredits(sa.totalRequired)}</TableCell>}
                  {!isMobile && <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{formatCredits(sa.totalEarned)}</TableCell>}
                  {!isMobile && <TableCell align="right" sx={{ fontSize: "0.8rem", fontWeight: 700 }}>{sa.completionPct}%</TableCell>}
                  {isMobile  && (
                    <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                      <Typography component="span" sx={{ fontWeight: 700, fontSize: "inherit" }}>{formatCredits(sa.totalEarned)}</Typography>
                      <Typography component="span" sx={{ color: "text.secondary", fontSize: "0.7rem" }}> / {formatCredits(sa.totalRequired)}</Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip size="small" label={OVERALL_LABELS[sa.overallStatus]} color={overallChipColor(sa.overallStatus)}
                      variant="outlined" sx={{ fontSize: "0.63rem", height: 20 }} />
                  </TableCell>
                  {categoryAnalytics.slice(0, maxCatCols).map((cat) => {
                    const info = sa.categoryStatuses[cat.code];
                    if (!info) return <TableCell key={cat.code} align="center" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>—</TableCell>;
                    const cellBg = info.status === "complete" ? alpha(theme.palette.success.main, 0.1)
                      : info.status === "on-track" ? alpha(theme.palette.primary.main, 0.08)
                      : info.status === "marginal" ? alpha(theme.palette.warning.main, 0.1)
                      : alpha(theme.palette.error.main, 0.08);
                    const cellColor = info.status === "complete" ? theme.palette.success.main
                      : info.status === "on-track" ? theme.palette.primary.main
                      : info.status === "marginal" ? theme.palette.warning.main
                      : theme.palette.error.main;
                    return (
                      <Tooltip key={cat.code} title={`${cat.code}: ${formatCredits(info.earned)} / ${formatCredits(info.required)} cr — ${OVERALL_LABELS[info.status]}`} placement="top" arrow>
                        <TableCell align="center" sx={{ bgcolor: cellBg, fontSize: "0.72rem", fontWeight: 600, color: cellColor }}>
                          {info.status === "complete" ? "✓" : info.status === "off-track" ? "—" : `${formatCredits(info.earned)}`}
                        </TableCell>
                      </Tooltip>
                    );
                  })}
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(isMobile ? 5 : 8) + Math.min(categoryAnalytics.length, maxCatCols)} sx={{ textAlign: "center", py: 4, color: "text.secondary", fontSize: "0.8rem" }}>
                    No students match the current filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {categoryAnalytics.length > maxCatCols && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block", fontSize: "0.65rem" }}>
            Showing first {maxCatCols} of {categoryAnalytics.length} categories. Export CSV for all.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FacultyAnalyticsReport({
  students,
  creditRows,
  plansOfStudy,
  regulations,
  onViewStudents,
  defaultExpandFirstBatch = true,
  showBatchStatusByLabelCard = false,
  chartOnly = false,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const echartsTheme = isDark ? "dark" : undefined;
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const analytics = useMemo(() => {
    const activeMentored = students.filter((s) => s.studentActive);
    const planMap = new Map(plansOfStudy.map((p) => [p.planCode, p]));

    const regToStudent = new Map<string, FacultyStudentRow>();
    for (const s of activeMentored) {
      const reg = (s.registrationNumber ?? "").trim().toLowerCase();
      if (reg) regToStudent.set(reg, s);
    }

    const studentEarnedByCategory = new Map<string, Record<string, number>>();
    for (const row of creditRows) {
      const reg = (row.registrationNumber ?? "").trim().toLowerCase();
      const student = regToStudent.get(reg);
      if (!student) continue;
      const catId = (row.categoryId ?? "").trim();
      if (!catId) continue;
      const credits = Number(row.credits ?? 0);
      if (!Number.isFinite(credits) || credits <= 0) continue;
      const bycat = studentEarnedByCategory.get(student.userId) ?? {};
      bycat[catId] = (bycat[catId] ?? 0) + credits;
      studentEarnedByCategory.set(student.userId, bycat);
    }

    const catNameMap = new Map<string, string>();
    for (const reg of regulations) {
      for (const cat of reg.curriculumStructure.categories) {
        if (!catNameMap.has(cat.code)) catNameMap.set(cat.code, cat.name);
      }
    }

    const allCategoryCodes = new Set<string>();
    const studentAnalytics: StudentAnalytic[] = [];

    for (const s of activeMentored) {
      const plan = s.planOfStudyCode ? planMap.get(s.planOfStudyCode) : null;
      const categoryRequired: Record<string, number> = {};
      const categoryExpected: Record<string, number> = {};
      let totalRequired = 0;
      const currentSem = s.currentSemester ?? 1;

      if (plan) {
        for (const sem of plan.semesters) {
          for (const [cat, req] of Object.entries(sem.categories)) {
            const n = Number(req ?? 0);
            if (n > 0) {
              categoryRequired[cat] = (categoryRequired[cat] ?? 0) + n;
              allCategoryCodes.add(cat);
              if (sem.semester < currentSem) {
                categoryExpected[cat] = (categoryExpected[cat] ?? 0) + n;
              }
            }
          }
          totalRequired += Number(sem.totalCredits ?? 0);
        }
      }
      const categoryEarned = studentEarnedByCategory.get(s.userId) ?? {};
      for (const cat of Object.keys(categoryEarned)) allCategoryCodes.add(cat);
      const totalEarned = Object.values(categoryEarned).reduce((sum, v) => sum + v, 0);
      const completionPct = totalRequired > 0 ? Math.round((totalEarned / totalRequired) * 100) : 0;
      const expected = plan
        ? plan.semesters.filter((sem) => sem.semester < currentSem).reduce((sum, sem) => sum + sem.totalCredits, 0)
        : 0;

      const categoryStatuses: Record<string, { earned: number; required: number; status: CreditStatus }> = {};
      for (const code of allCategoryCodes) {
        const req = categoryRequired[code] ?? 0;
        if (req > 0) {
          const earned = categoryEarned[code] ?? 0;
          categoryStatuses[code] = { earned, required: req, status: catStatus(earned, req, categoryExpected[code] ?? 0) };
        }
      }

      studentAnalytics.push({
        userId: s.userId,
        registrationNumber: (s.registrationNumber ?? "").trim() || "—",
        fullName: (s.fullName ?? "").trim() || "Unnamed",
        batch: s.batch,
        currentSemester: s.currentSemester,
        graduated: s.graduated,
        planName: plan?.planName ?? "—",
        totalRequired,
        totalEarned,
        completionPct,
        overallStatus: computeCreditStatus(totalRequired, totalEarned, expected),
        categoryStatuses,
      });
    }

    // Group by batch, sort batches descending (most recent first)
    const batchMap = new Map<number | null, StudentAnalytic[]>();
    for (const sa of studentAnalytics) {
      const key = sa.batch;
      const arr = batchMap.get(key) ?? [];
      arr.push(sa);
      batchMap.set(key, arr);
    }
    const batchGroups = Array.from(batchMap.entries())
      .sort(([a], [b]) => (b ?? -1) - (a ?? -1))
      .map(([batch, batchStudents]) => ({
        batch,
        label: batch != null ? `Batch ${batch}` : "Unknown Batch",
        students: [...batchStudents].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber)),
      }));

    return { totalActive: activeMentored.length, batchGroups, catNameMap };
  }, [students, creditRows, plansOfStudy, regulations]);

  const { totalActive, batchGroups, catNameMap } = analytics;
  const batchStatusCardOption = useMemo<EChartsOption>(() => {
    const trendGroups = [...batchGroups].sort((a, b) => {
      const av = a.batch ?? Number.MAX_SAFE_INTEGER;
      const bv = b.batch ?? Number.MAX_SAFE_INTEGER;
      return av - bv;
    });
    const labels = trendGroups.map((group) => group.label);
    const statusCountsByBatch = trendGroups.map((group) =>
      CREDIT_STATUSES.map((status) => group.students.filter((student) => student.overallStatus === status).length)
    );
    const totalsByBatch = trendGroups.map((group) => group.students.length);
    const statusPercentsByBatch = statusCountsByBatch.map((counts, idx) => {
      const total = Math.max(1, totalsByBatch[idx] ?? 0);
      return counts.map((count) => Number(((count / total) * 100).toFixed(2)));
    });
    const statusColors: Record<CreditStatus, string> = {
      complete: theme.palette.success.main,
      "on-track": theme.palette.primary.main,
      marginal: theme.palette.warning.main,
      "off-track": theme.palette.error.main,
    };
    const stackedSeries = CREDIT_STATUSES.map((status, statusIdx) => ({
      name: OVERALL_LABELS[status],
      type: "bar" as const,
      stack: "composition",
      data: statusPercentsByBatch.map((pct) => pct[statusIdx] ?? 0),
      barMaxWidth: 44,
      emphasis: { focus: "series" as const },
      itemStyle: { color: statusColors[status] },
      label: {
        show: !isMobile,
        position: "inside" as const,
        formatter: ({ value }: { value: number }) => (Number(value) >= 8 ? `${Math.round(Number(value))}%` : ""),
        color: "#fff",
        fontSize: 10,
        fontWeight: 600,
      },
    }));
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items: Array<{ seriesName: string; value: number; dataIndex?: number }>) => {
          const rowIndex = Math.max(0, Math.min(labels.length - 1, Number(items?.[0]?.dataIndex ?? 0)));
          const counts = statusCountsByBatch[rowIndex] ?? [0, 0, 0, 0];
          const total = totalsByBatch[rowIndex] ?? 0;
          let html = `<div style="font-weight:700;margin-bottom:4px">${labels[rowIndex]}</div>`;
          CREDIT_STATUSES.forEach((status, sIdx) => {
            const pct = statusPercentsByBatch[rowIndex]?.[sIdx] ?? 0;
            html += `<div>${OVERALL_LABELS[status]}: <strong>${counts[sIdx]}</strong> <span style="opacity:0.75">(${pct.toFixed(1)}%)</span></div>`;
          });
          html += `<div style="margin-top:4px">Total Users: <strong>${total}</strong></div>`;
          return html;
        },
      },
      legend: {
        top: 4,
        data: CREDIT_STATUSES.map((status) => OVERALL_LABELS[status]),
        textStyle: { color: theme.palette.text.primary, fontSize: isMobile ? 10 : 11 },
      },
      grid: { left: 8, right: 18, top: isMobile ? 58 : 44, bottom: isMobile ? 58 : 24, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: theme.palette.text.secondary, fontSize: isMobile ? 10 : 11, rotate: isMobile ? 30 : 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: isDark ? "#333" : "#d9d9d9" } },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: theme.palette.text.primary, fontSize: isMobile ? 10 : 11, formatter: "{value}%" },
        splitLine: { lineStyle: { color: isDark ? "#333" : "#f0f0f0" } },
      },
      series: stackedSeries,
    };
  }, [batchGroups, isDark, isMobile, theme]);

  const handlePrintBatch = useCallback((contentId: string) => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @media print {
        @page { margin: 12mm; }
        body * { visibility: hidden !important; }
        #${contentId} {
          visibility: visible !important;
          position: fixed !important;
          inset: 0 !important;
          overflow: visible !important;
          background: #fff !important;
          padding: 8px !important;
        }
        #${contentId} * { visibility: visible !important; }
        #${contentId} [data-noprint] { display: none !important; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    window.addEventListener("afterprint", () => styleEl.remove(), { once: true });
  }, []);

  if (totalActive === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No active mentored students found. Analytics will appear once students and credits are recorded.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {showBatchStatusByLabelCard ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Status Composition by Batch
          </Typography>
          <Typography variant="caption" color="text.secondary" />
          <Box sx={{ mt: 1, height: 300 }}>
            <ReactECharts
              theme={echartsTheme}
              option={batchStatusCardOption}
              notMerge
              lazyUpdate
              style={{ height: "100%", width: "100%" }}
            />
          </Box>
        </Paper>
      ) : null}
      {!chartOnly ? batchGroups.map(({ batch, label, students: batchStudents }, idx) => (
        <Accordion
          key={batch ?? "unknown"}
          defaultExpanded={defaultExpandFirstBatch && idx === 0}
          disableGutters
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px !important",
            "&:before": { display: "none" },
            "&.Mui-expanded": { borderColor: "primary.main" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 52, "& .MuiAccordionSummary-content": { my: 1, mr: 1 } }}>
            <Stack sx={{ flex: 1, minWidth: 0, gap: 0.75 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem", flexShrink: 0 }}>
                  {batchStudents.length} student{batchStudents.length === 1 ? "" : "s"}
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5 }}>
                {CREDIT_STATUSES.map((s) => {
                  const count = batchStudents.filter((sa) => sa.overallStatus === s).length;
                  if (count === 0) return null;
                  return (
                    <Chip key={s} size="small"
                      label={`${OVERALL_LABELS[s]}: ${count}`}
                      color={overallChipColor(s)}
                      variant="outlined"
                      sx={{ fontSize: "0.6rem", height: 20 }}
                    />
                  );
                })}
              </Stack>
            </Stack>
          </AccordionSummary>
          <AccordionDetails id={`batch-content-${batch ?? "unknown"}`} sx={{ pt: 0, pb: 2, px: { xs: 1, sm: 2 } }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
              <Tooltip title="Print batch report" placement="top">
                <IconButton
                  size="small"
                  onClick={() => handlePrintBatch(`batch-content-${batch ?? "unknown"}`)}
                  sx={{ color: "text.secondary" }}
                >
                  <PrintIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <BatchPanel
              batch={batch}
              batchLabel={label}
              students={batchStudents}
              catNameMap={catNameMap}
              onViewStudents={onViewStudents}
            />
          </AccordionDetails>
        </Accordion>
      )) : null}
    </Stack>
  );
}
