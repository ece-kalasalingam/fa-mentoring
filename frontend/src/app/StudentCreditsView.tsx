import { Fragment, useMemo, useState } from "react";
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton,
  LinearProgress, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SaveIcon from "@mui/icons-material/Save";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { formatCredits, getInitials, normalizeCredits } from "./utils";
import type { CreditStatus, PlanOfStudy, Regulation, StudentDirectoryRow } from "./types";
import { CreditStatusChip } from "./CreditStatusChip";

type Props = {
  student: StudentDirectoryRow;
  plan: PlanOfStudy | null;
  regulation: Regulation | null;
  earnedCreditsBySemester: Record<number, Record<string, number>>;
  savedCreditsBySemester: Record<number, Record<string, number>>;
  earnedUnitsByCategory: Record<string, number>;
  savedUnitsByCategory: Record<string, number>;
  isSaving: boolean;
  creditStatus?: CreditStatus;
  isStudentOnly?: boolean;
  studentIndex?: number;
  studentCount?: number;
  onChangeEarnedCredit: (semester: number, categoryCode: string, value: number) => void;
  onChangeEarnedUnit: (categoryCode: string, value: number) => void;
  onSaveEarnedCredits: () => void;
  onNavigate?: (direction: -1 | 1) => void;
};

const TAB_IDS   = ["credits-tab-0",   "credits-tab-1"] as const;
const PANEL_IDS = ["credits-panel-0", "credits-panel-1"] as const;

const INPUT_SX = {
  width: { xs: 72, sm: 76 },
  "& .MuiOutlinedInput-input": { textAlign: "center", py: "5px", px: "6px", fontSize: "0.8125rem" },
  "& input[type=number]": { MozAppearance: "textfield" },
  "& input[type=number]::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 },
  "& input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
} as const;

export default function StudentCreditsView(props: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [tab, setTab] = useState(0);
  const [selectedSemNum, setSelectedSemNum] = useState<number | null>(null);

  const minSemester = useMemo(() => {
    if (!props.plan || props.plan.semesters.length === 0) return 1;
    return Math.min(...props.plan.semesters.map((s) => Number(s.semester)).filter((v) => Number.isFinite(v)));
  }, [props.plan]);

  const maxPlanSemester = useMemo(() => {
    if (!props.plan || props.plan.semesters.length === 0) return null;
    return Math.max(...props.plan.semesters.map((s) => Number(s.semester)).filter((v) => Number.isFinite(v)));
  }, [props.plan]);

  const currentSemesterBoundary = useMemo(() => {
    const current = Number(props.student.currentSemester ?? minSemester);
    return Math.max(minSemester, Number.isFinite(current) ? Math.floor(current) : minSemester);
  }, [props.student.currentSemester, minSemester]);

  const activeSemNum = selectedSemNum ?? currentSemesterBoundary;

  const categoryOrder = useMemo(() => {
    const regulationOrder = props.regulation?.curriculumStructure.categories.map((c) => c.code) ?? [];
    const planCodes = new Set<string>();
    for (const semester of props.plan?.semesters ?? []) {
      for (const code of Object.keys(semester.categories ?? {})) planCodes.add(code);
    }
    return [...regulationOrder, ...Array.from(planCodes).filter((code) => !regulationOrder.includes(code))];
  }, [props.regulation, props.plan]);

  const categoryNameByCode = useMemo(() => {
    const byCode: Record<string, string> = {};
    for (const item of props.regulation?.curriculumStructure.categories ?? []) {
      byCode[item.code] = item.name;
    }
    return byCode;
  }, [props.regulation]);
  const categoryMeasureByCode = useMemo(() => {
    const byCode: Record<string, "credits" | "units"> = {};
    for (const item of props.regulation?.curriculumStructure.categories ?? []) {
      byCode[item.code] = item.measure ?? "credits";
    }
    return byCode;
  }, [props.regulation]);

  const sortedSemesters = useMemo(
    () => (props.plan?.semesters ?? []).slice().sort((a, b) => a.semester - b.semester),
    [props.plan],
  );

  const activeCategoryCodes = useMemo(
    () =>
      categoryOrder.filter(
        (code) =>
          sortedSemesters.some((sem) => Number(sem.categories?.[code] ?? 0) > 0) ||
          Object.values(props.earnedCreditsBySemester).some((bySem) => Number(bySem[code] ?? 0) > 0),
      ),
    [categoryOrder, sortedSemesters, props.earnedCreditsBySemester],
  );

  const semesterSummaries = useMemo(
    () =>
      sortedSemesters.map((sem) => {
        const toBeEarned = Object.entries(sem.categories ?? {}).reduce((s, [code, v]) => {
          if ((categoryMeasureByCode[code] ?? "credits") !== "credits") return s;
          return s + Number(v);
        }, 0);
        const earned = activeCategoryCodes.reduce(
          (s, code) => ((categoryMeasureByCode[code] ?? "credits") === "credits"
            ? s + Number(props.earnedCreditsBySemester[sem.semester]?.[code] ?? 0)
            : s),
          0,
        );
        return { semester: sem.semester, toBeEarned, earned };
      }),
    [sortedSemesters, activeCategoryCodes, props.earnedCreditsBySemester, categoryMeasureByCode],
  );

  const overallEarned = useMemo(
    () => semesterSummaries.reduce((s, sem) => s + sem.earned, 0),
    [semesterSummaries],
  );

  const overallRequired = useMemo(
    () =>
      props.regulation?.curriculumStructure.totalCreditsRequired ??
      semesterSummaries.reduce((s, sem) => s + sem.toBeEarned, 0),
    [props.regulation, semesterSummaries],
  );

  const analyticsData = useMemo(
    () =>
      categoryOrder
        .map((code) => {
          if ((categoryMeasureByCode[code] ?? "credits") !== "credits") {
            return { code, name: categoryNameByCode[code] ?? code, planTotal: 0, earnedTotal: 0, onStudy: 0 };
          }
          const planTotal = sortedSemesters.reduce((s, sem) => s + Number(sem.categories?.[code] ?? 0), 0);
          const earnedTotal = Object.entries(props.earnedCreditsBySemester)
            .filter(([sem]) => Number(sem) < currentSemesterBoundary)
            .reduce((s, [, bySem]) => s + Number(bySem[code] ?? 0), 0);
          const onStudy = Number(props.earnedCreditsBySemester[currentSemesterBoundary]?.[code] ?? 0);
          return { code, name: categoryNameByCode[code] ?? code, planTotal, earnedTotal, onStudy };
        })
        .filter((row) => row.planTotal > 0 || row.onStudy > 0),
    [categoryOrder, sortedSemesters, props.earnedCreditsBySemester, currentSemesterBoundary, categoryNameByCode, categoryMeasureByCode],
  );

  const unitRows = useMemo(
    () =>
      categoryOrder
        .filter((code) => (categoryMeasureByCode[code] ?? "credits") === "units")
        .map((code) => {
          const required = sortedSemesters.reduce((s, sem) => s + Number(sem.categories?.[code] ?? 0), 0);
          const earned = Object.values(props.earnedCreditsBySemester).reduce(
            (s, bySem) => s + Number(bySem[code] ?? 0),
            0,
          );
          return { code, name: categoryNameByCode[code] ?? code, required, earned };
        })
        .filter((row) => row.required > 0 || row.earned > 0),
    [categoryOrder, categoryMeasureByCode, sortedSemesters, props.earnedCreditsBySemester, categoryNameByCode],
  );

  const creditsOnStudy = useMemo(
    () => analyticsData.reduce((s, r) => s + r.onStudy, 0),
    [analyticsData],
  );

  const unitsOnStudy = useMemo(
    () =>
      Object.entries(props.earnedCreditsBySemester[currentSemesterBoundary] ?? {})
        .filter(([code]) => (categoryMeasureByCode[code] ?? "credits") === "units")
        .reduce((s, [, v]) => s + Number(v), 0),
    [props.earnedCreditsBySemester, currentSemesterBoundary, categoryMeasureByCode],
  );

  const isDirty = useMemo(() => {
    const allSems = new Set([
      ...Object.keys(props.earnedCreditsBySemester).map(Number),
      ...Object.keys(props.savedCreditsBySemester).map(Number),
    ]);
    for (const sem of allSems) {
      const earned = props.earnedCreditsBySemester[sem] ?? {};
      const saved  = props.savedCreditsBySemester[sem]  ?? {};
      const allCodes = new Set([...Object.keys(earned), ...Object.keys(saved)]);
      for (const code of allCodes) {
        if (Number(earned[code] ?? 0) !== Number(saved[code] ?? 0)) return true;
      }
    }
    const allUnitCodes = new Set([
      ...Object.keys(props.earnedUnitsByCategory),
      ...Object.keys(props.savedUnitsByCategory),
    ]);
    for (const code of allUnitCodes) {
      if (Number(props.earnedUnitsByCategory[code] ?? 0) !== Number(props.savedUnitsByCategory[code] ?? 0)) return true;
    }
    return false;
  }, [props.earnedCreditsBySemester, props.savedCreditsBySemester, props.earnedUnitsByCategory, props.savedUnitsByCategory]);

  if (!props.plan) {
    return (
      <Card sx={{ boxShadow: "none", border: "none", backgroundImage: "none" }}>
        <CardContent>
          <Stack spacing={3}>
            <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
              <Typography variant="h6">Degree Audit</Typography>
              <Typography variant="body2" color="text.secondary">No plan of study assigned to this student.</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const categoryDeficit = analyticsData.reduce(
    (sum, row) => sum + Math.max(0, row.planTotal - row.earnedTotal - row.onStudy),
    0,
  );
  const overallRequiredUnits = unitRows.reduce((sum, row) => sum + Number(row.required ?? 0), 0);
  const overallEarnedUnits = unitRows.reduce((sum, row) => sum + Number(row.earned ?? 0), 0);
  const earnedComposite = `${formatCredits(overallEarned)}+${formatCredits(overallEarnedUnits)}`;
  const requiredComposite = `${formatCredits(overallRequired)}+${formatCredits(overallRequiredUnits)}`;
  const progressPct  = overallRequired > 0 ? Math.min(100, (overallEarned / overallRequired) * 100) : 0;
  const unitDeficit = unitRows.reduce((sum, row) => sum + Math.max(0, row.required - row.earned), 0);
  const isComplete   = overallEarned >= overallRequired && overallRequired > 0 && categoryDeficit === 0 && unitDeficit === 0;
  const remaining    = Math.max(Math.max(0, overallRequired - overallEarned), categoryDeficit);
  const pastEarned      = Math.max(0, overallEarned - creditsOnStudy);
  const pastEarnedUnits = Math.max(0, overallEarnedUnits - unitsOnStudy);
  const semesterLabel =
    maxPlanSemester != null
      ? `Semester ${currentSemesterBoundary} of ${maxPlanSemester}`
      : `Semester ${currentSemesterBoundary}`;

  // Active semester derived values
  const activeSem        = sortedSemesters.find((s) => s.semester === activeSemNum) ?? sortedSemesters[0];
  const isActivePast     = activeSemNum < currentSemesterBoundary;
  const isActiveCurrent  = activeSemNum === currentSemesterBoundary;
  const isActiveFuture   = activeSemNum > currentSemesterBoundary;
  const activeSummary    = semesterSummaries.find((s) => s.semester === activeSemNum);
  const activeSemEarned  = activeSummary?.earned ?? 0;
  const activeSemTarget  = activeSummary?.toBeEarned ?? 0;
  const activeSemCreditCodes = isActiveFuture
    ? activeCategoryCodes.filter((code) => (categoryMeasureByCode[code] ?? "credits") === "credits" && Number(activeSem?.categories?.[code] ?? 0) > 0)
    : activeCategoryCodes.filter((code) => (categoryMeasureByCode[code] ?? "credits") === "credits");
  const activeSemUnitCodes = isActiveFuture
    ? activeCategoryCodes.filter((code) => (categoryMeasureByCode[code] ?? "credits") === "units" && Number(activeSem?.categories?.[code] ?? 0) > 0)
    : activeCategoryCodes.filter((code) => (categoryMeasureByCode[code] ?? "credits") === "units");
  const activeSemCodes = [...activeSemCreditCodes, ...activeSemUnitCodes];
  const activeSemUnitTarget = activeSemCodes.reduce(
    (sum, code) => ((categoryMeasureByCode[code] ?? "credits") === "units" ? sum + Number(activeSem?.categories?.[code] ?? 0) : sum),
    0,
  );
  const activeSemUnitEarned = activeSemCodes.reduce(
    (sum, code) => ((categoryMeasureByCode[code] ?? "credits") === "units" ? sum + Number(props.earnedCreditsBySemester[activeSemNum]?.[code] ?? 0) : sum),
    0,
  );
  const activeSemComplete = activeSemEarned >= activeSemTarget && activeSemTarget > 0;
  const activeSemPct     = activeSemTarget > 0 ? Math.min(100, (activeSemEarned / activeSemTarget) * 100) : 0;

  return (
    <Card sx={{ boxShadow: "none", border: "none", backgroundImage: "none" }}>
      <CardContent>
        <Stack spacing={3}>

          {/* ── Header panel — same pattern as all other pages ── */}
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            {/* Navigation strip — hidden for student-only sessions */}
            {!props.isStudentOnly && props.studentCount != null && props.studentCount > 1 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
                <Tooltip title="Previous student" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => props.onNavigate?.(-1)}
                      disabled={(props.studentIndex ?? 0) <= 0}
                      aria-label="Previous student"
                      sx={{ p: 0.375 }}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: "center" }}>
                  {(props.studentIndex ?? 0) + 1} of {props.studentCount} students
                </Typography>
                <Tooltip title="Next student" arrow>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => props.onNavigate?.(1)}
                      disabled={(props.studentIndex ?? 0) >= (props.studentCount ?? 1) - 1}
                      aria-label="Next student"
                      sx={{ p: 0.375 }}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}
            >
              {/* Student identity */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                <Avatar
                  sx={{ width: 44, height: 44, bgcolor: "primary.main", fontSize: "1rem", fontWeight: 700, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  {getInitials(props.student.fullName)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ lineHeight: 1.25 }} noWrap>
                    {props.student.fullName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }} noWrap>
                    {props.student.registrationNumber || "No registration number"}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {props.plan.planName}
                    </Typography>
                    <Chip
                      label={semesterLabel}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
                    />
                    {props.creditStatus && <CreditStatusChip status={props.creditStatus} />}
                  </Box>
                </Box>
              </Box>

              {/* Overall degree progress */}
              <Box sx={{ minWidth: 180, flexShrink: 0 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 0.5, mb: 0.5 }}>
                  {isComplete && (
                    <CheckCircleIcon sx={{ fontSize: "0.9rem", color: "success.main" }} aria-hidden="true" />
                  )}
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
                    color={isComplete ? "success.main" : "text.primary"}
                    aria-label={`${earnedComposite} of ${requiredComposite} earned (cr+ut)`}
                  >
                    {earnedComposite}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    / {requiredComposite} (cr+ut)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progressPct}
                  color={isComplete ? "success" : "primary"}
                  aria-label={`Degree progress: ${Math.round(progressPct)}%`}
                  sx={{ borderRadius: 4, height: 7 }}
                />
                <Typography
                  variant="caption"
                  color={isComplete ? "success.main" : "text.secondary"}
                  sx={{ display: "block", textAlign: "right", mt: 0.375 }}
                >
                  {isComplete
                    ? "All requirements complete"
                    : overallEarned >= overallRequired && unitDeficit > 0
                      ? `${formatCredits(unitDeficit)} units still needed in non-credit categories`
                    : overallEarned >= overallRequired && categoryDeficit > 0
                      ? `${formatCredits(categoryDeficit)} credits still needed in specific categories`
                      : `${Math.round(progressPct)}% · ${formatCredits(remaining)} credits remaining`}
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                  <Tooltip title={isDirty ? "Save credit changes to the database" : "No unsaved changes"} arrow>
                    <span>
                      <Button
                        type="button"
                        size="small"
                        variant={isDirty ? "contained" : "outlined"}
                        color="primary"
                        startIcon={props.isSaving
                          ? <CircularProgress size={13} color="inherit" />
                          : <SaveIcon fontSize="small" />
                        }
                        disabled={!isDirty || props.isSaving}
                        onClick={props.onSaveEarnedCredits}
                        sx={{ minWidth: 110 }}
                      >
                        {props.isSaving ? "Saving…" : "Save edits"}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Stack>
          </Box>

          {/* ── Tab content — same Paper wrapper as My Account page ── */}
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Tabs
              value={tab}
              onChange={(_e, v) => setTab(v as number)}
              aria-label="Degree audit sections"
              sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 0 }}
            >
              <Tab label="Plan of Study" id={TAB_IDS[0]} aria-controls={PANEL_IDS[0]} />
              <Tab label="Analytics"    id={TAB_IDS[1]} aria-controls={PANEL_IDS[1]} />
            </Tabs>

        {/* ── Plan of Study panel ── */}
        <Box
          role="tabpanel"
          id={PANEL_IDS[0]}
          aria-labelledby={TAB_IDS[0]}
          hidden={tab !== 0}
          tabIndex={0}
          sx={{ outline: "none" }}
        >
          {tab === 0 && (
            <Stack spacing={1.5} sx={{ pt: 1.5 }}>

              {/* Semester selector pills */}
              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  overflowX: "auto",
                  pb: 0.5,
                  "&::-webkit-scrollbar": { display: "none" },
                  scrollbarWidth: "none",
                }}
                role="tablist"
                aria-label="Semester selector"
              >
                {sortedSemesters.map((sem) => {
                  const s        = semesterSummaries.find((x) => x.semester === sem.semester);
                  const isDone   = (s?.earned ?? 0) >= (s?.toBeEarned ?? 0) && (s?.toBeEarned ?? 0) > 0;
                  const isPast   = sem.semester < currentSemesterBoundary;
                  const isCurr   = sem.semester === currentSemesterBoundary;
                  const isActive = sem.semester === activeSemNum;

                  return (
                    <Chip
                      key={sem.semester}
                      label={`Sem ${sem.semester}${isCurr ? " ★" : ""}`}
                      size="small"
                      onClick={() => setSelectedSemNum(sem.semester)}
                      color={
                        isActive   ? "primary"
                        : isDone   ? "success"
                        : isPast   ? "warning"
                        : "default"
                      }
                      variant={isActive ? "filled" : "outlined"}
                      icon={isDone && !isActive
                        ? <CheckCircleIcon sx={{ fontSize: "0.65rem !important" }} />
                        : undefined
                      }
                      sx={{ flexShrink: 0, fontWeight: isActive ? 700 : 400, fontSize: "0.72rem" }}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Semester ${sem.semester}${isCurr ? ", current" : isDone ? ", complete" : isPast ? ", incomplete" : ", planned"}`}
                    />
                  );
                })}
              </Box>

              {/* Selected semester detail */}
              {activeSem && (
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: isActiveCurrent ? "primary.main" : "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {/* Semester card header */}
                  <Box
                    sx={(theme) => ({
                      px: 1.5,
                      py: 1,
                      bgcolor: isActiveCurrent
                        ? alpha(theme.palette.primary.main, 0.06)
                        : "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      flexWrap: "wrap",
                    })}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Semester {activeSemNum}
                      </Typography>
                      {isActiveCurrent && (
                        <Chip label="Current" size="small" color="primary" sx={{ height: 18, fontSize: "0.65rem" }} />
                      )}
                      {isActivePast && activeSemComplete && (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: "0.65rem !important" }} />}
                          label="Complete"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 18, fontSize: "0.65rem" }}
                        />
                      )}
                      {isActivePast && !activeSemComplete && (
                        <Chip
                          label="Incomplete"
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 18, fontSize: "0.65rem" }}
                        />
                      )}
                      {isActiveFuture && (
                        <Chip
                          label="Planned"
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: "0.65rem", borderColor: "divider", color: "text.disabled" }}
                        />
                      )}
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                      color={
                        isActiveFuture    ? "text.secondary"
                        : activeSemComplete ? "success.main"
                        : activeSemEarned > activeSemTarget && activeSemTarget > 0 ? "info.main"
                        : activeSemEarned > 0 ? "warning.main"
                        : "text.secondary"
                      }
                    >
                      {isActiveFuture
                        ? `${formatCredits(activeSemTarget)} cr + ${formatCredits(activeSemUnitTarget)} ut planned`
                        : `${formatCredits(activeSemEarned)}+${formatCredits(activeSemUnitEarned)} / ${formatCredits(activeSemTarget)}+${formatCredits(activeSemUnitTarget)} (cr+ut)`}
                    </Typography>
                  </Box>

                  {/* Semester progress bar — past/current only */}
                  {!isActiveFuture && activeSemTarget > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={activeSemPct}
                      color={activeSemComplete ? "success" : "primary"}
                      sx={{ height: 3 }}
                      aria-label={`Semester ${activeSemNum}: ${Math.round(activeSemPct)}%`}
                    />
                  )}

                  {/* Category table */}
                  <Table
                    size="small"
                    aria-label={`Semester ${activeSemNum} credit breakdown`}
                    sx={{ tableLayout: { xs: "auto", md: "fixed" } }}
                  >
                    <TableHead>
                      <TableRow
                        sx={{
                          "& .MuiTableCell-root": {
                            py: 0.625,
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: "text.secondary",
                            bgcolor: "action.hover",
                          },
                        }}
                      >
                        <TableCell scope="col" sx={{ pl: 1.5, width: { xs: "58%", md: "auto" } }}>Category</TableCell>
                        <TableCell scope="col" align="right" sx={{ width: { xs: 58, md: 110 } }}>Plan</TableCell>
                        {!isActiveFuture && (
                          <TableCell scope="col" align="center" sx={{ width: { xs: 88, md: 130 } }}>Earned</TableCell>
                        )}
                        {!isActiveFuture && (
                          <TableCell scope="col" align="right" sx={{ width: { xs: 52, md: 84 }, pr: 1.5 }}>Status</TableCell>
                        )}
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {activeSemCreditCodes.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={isActiveFuture ? 2 : 4} sx={{ pl: 1.5, py: 0.5, bgcolor: "action.hover" }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", letterSpacing: 0.2 }}>
                              Credits
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {activeSemCodes.map((code, idx) => {
                        const target       = Number(activeSem?.categories?.[code] ?? 0);
                        const earned       = Number(props.earnedCreditsBySemester[activeSemNum]?.[code] ?? 0);
                        const categoryName = categoryNameByCode[code] ?? code;
                        const isUnit = (categoryMeasureByCode[code] ?? "credits") === "units";
                        const met     = target > 0 && earned >= target;
                        const over    = met && earned > target;
                        const partial = target > 0 && earned > 0 && earned < target;
                        const extra   = target === 0 && earned > 0;
                        const diff    = earned - target;

                        return (
                          <Fragment key={code}>
                          {idx === activeSemCreditCodes.length && activeSemUnitCodes.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={isActiveFuture ? 2 : 4} sx={{ pl: 1.5, py: 0.5, bgcolor: "action.hover" }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 0.2 }}>
                                  Non-credits
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow
                            sx={(theme) => ({
                              bgcolor: met
                                ? alpha(theme.palette.success.main, 0.04)
                                : partial
                                  ? alpha(theme.palette.warning.main, 0.04)
                                  : extra
                                    ? alpha(theme.palette.info.main, 0.04)
                                    : "transparent",
                              "& .MuiTableCell-root": { py: 0.75, borderBottom: "1px solid", borderBottomColor: "divider" },
                            })}
                          >
                            {/* Category */}
                            <TableCell sx={{ pl: 1.5, overflow: "hidden", verticalAlign: "top" }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  lineHeight: 1.2,
                                  whiteSpace: { xs: "normal", md: "nowrap" },
                                  wordBreak: { xs: "break-word", md: "normal" },
                                }}
                                noWrap={!isMobile}
                              >
                                {categoryName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.65rem",
                                  whiteSpace: { xs: "normal", md: "nowrap" },
                                  wordBreak: { xs: "break-word", md: "normal" },
                                }}
                              >
                                {code} · {isUnit ? "ut" : "cr"}{target === 0 && !isActiveFuture && " · unplanned"}
                              </Typography>
                            </TableCell>

                            {/* Plan */}
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                color={target > 0 ? "text.secondary" : "text.disabled"}
                                sx={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {target > 0 ? formatCredits(target) : "—"}
                              </Typography>
                            </TableCell>

                            {/* Earned (editable) */}
                            {!isActiveFuture && (
                              <TableCell align="center">
                                <TextField
                                  size="small"
                                  type="number"
                                  value={earned}
                                  aria-label={`${categoryName}, semester ${activeSemNum} — earned.${target > 0 ? ` Plan: ${target}.` : " Unplanned."}`}
                                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                                  onChange={(e) => {
                                    const parsed = Number(e.target.value);
                                    props.onChangeEarnedCredit(
                                      activeSemNum,
                                      code,
                                      Number.isFinite(parsed) ? normalizeCredits(Math.max(0, parsed)) : 0,
                                    );
                                  }}
                                  sx={{
                                    ...INPUT_SX,
                                    "& .MuiOutlinedInput-root": {
                                      ...(met     ? { "& fieldset": { borderColor: "success.main" } } : {}),
                                      ...(partial ? { "& fieldset": { borderColor: "warning.main" } } : {}),
                                      ...(extra   ? { "& fieldset": { borderColor: "info.main"    } } : {}),
                                    },
                                  }}
                                />
                              </TableCell>
                            )}

                            {/* Status */}
                            {!isActiveFuture && (
                              <TableCell align="right" sx={{ pr: 1.5, whiteSpace: "nowrap" }}>
                                {met && !over && (
                                  <CheckCircleIcon sx={{ fontSize: "1rem", color: "success.main", verticalAlign: "middle" }} aria-label="Target met" />
                                )}
                                {over && (
                                  <Typography variant="caption" color="info.main" sx={{ fontVariantNumeric: "tabular-nums" }}>+{formatCredits(diff)}</Typography>
                                )}
                                {partial && (
                                  <Typography variant="caption" color="warning.main" sx={{ fontVariantNumeric: "tabular-nums" }}>−{formatCredits(Math.abs(diff))}</Typography>
                                )}
                                {extra && (
                                  <Typography variant="caption" color="info.main" sx={{ fontVariantNumeric: "tabular-nums" }}>+{formatCredits(earned)}</Typography>
                                )}
                                {!met && !partial && !extra && target > 0 && (
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                          </Fragment>
                        );
                      })}

                      {/* Semester total */}
                      <TableRow
                        sx={{
                          "& .MuiTableCell-root": {
                            py: 0.75,
                            borderTop: "2px solid",
                            borderTopColor: "divider",
                            borderBottom: "none",
                          },
                        }}
                      >
                        <TableCell sx={{ pl: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                            Total
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontSize: { xs: "0.78rem", md: "0.875rem" } }}
                          >
                            {formatCredits(activeSemTarget)} cr + {formatCredits(activeSemUnitTarget)} ut
                          </Typography>
                        </TableCell>
                        {!isActiveFuture && (
                          <>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontSize: { xs: "0.78rem", md: "0.875rem" } }}
                                color={
                                  activeSemComplete   ? "success.main"
                                  : activeSemEarned > 0 ? "warning.main"
                                  : "text.secondary"
                                }
                              >
                                {formatCredits(activeSemEarned)} cr + {formatCredits(activeSemUnitEarned)} ut
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ pr: 1.5 }}>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                                color={
                                  activeSemComplete ? "success.main"
                                  : activeSemEarned > activeSemTarget && activeSemTarget > 0 ? "info.main"
                                  : activeSemEarned > 0 ? "warning.main"
                                  : "text.secondary"
                                }
                              >
                                {activeSemComplete
                                  ? activeSemEarned > activeSemTarget ? `+${formatCredits(activeSemEarned - activeSemTarget)}` : "✓"
                                  : activeSemEarned > 0 ? `−${formatCredits(activeSemTarget - activeSemEarned)}` : "—"}
                              </Typography>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Degree total strip */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  pt: 0.5,
                  borderTop: "1px solid",
                  borderTopColor: "divider",
                }}
              >
                <Typography variant="caption" color={isComplete ? "success.main" : "text.secondary"}>
                  {isComplete ? "All requirements met" : `${formatCredits(remaining)} cr. remaining · ${Math.round(progressPct)}%`}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                  color={isComplete ? "success.main" : "text.secondary"}
                >
                  {earnedComposite} / {requiredComposite} total (cr+ut)
                </Typography>
              </Box>
            </Stack>
          )}
        </Box>

        {/* ── Analytics panel ── */}
        <Box
          role="tabpanel"
          id={PANEL_IDS[1]}
          aria-labelledby={TAB_IDS[1]}
          hidden={tab !== 1}
          tabIndex={0}
          sx={{ outline: "none" }}
        >
          {tab === 1 && (
            <Stack spacing={2} sx={{ pt: 1.5 }}>

              {/* 2×2 stat grid */}
              <Box
                component="dl"
                sx={{ display: "flex", flexWrap: "wrap", gap: 1, m: 0 }}
              >
                {([
                  { label: "Required",  value: `${formatCredits(overallRequired)}+${formatCredits(overallRequiredUnits)}`,  sub: "cr+ut",          color: "text.primary"  },
                  { label: "Earned",    value: `${formatCredits(pastEarned)}+${formatCredits(pastEarnedUnits)}`,        sub: "cr+ut",         color: isComplete ? "success.main" : "text.primary" },
                  { label: "On Study",  value: `${formatCredits(creditsOnStudy)}+${formatCredits(unitsOnStudy)}`,      sub: `cr+ut · sem ${currentSemesterBoundary}`, color: "info.main" },
                  { label: "Remaining", value: `${formatCredits(remaining)}+${formatCredits(unitDeficit)}`, sub: remaining === 0 && unitDeficit === 0 ? "done!" : "cr+ut needed", color: remaining === 0 && unitDeficit === 0 ? "success.main" : "error.main" },
                ] as const).map(({ label, value, sub, color }) => (
                  <Box
                    key={label}
                    sx={{ flex: "1 1 150px", p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper" }}
                  >
                    <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {label}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="h5"
                      sx={{ fontWeight: 800, m: 0, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}
                      color={color}
                    >
                      {typeof value === "number" ? formatCredits(value) : value}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.125 }}>
                      {sub}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Mobile: stacked cards */}
              <Stack spacing={1} aria-label="Per-category credit breakdown" sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column" }}>
                {analyticsData.length > 0 && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", letterSpacing: 0.2, px: 0.5 }}>
                    Credits
                  </Typography>
                )}
                {analyticsData.map(({ code, name, planTotal, earnedTotal, onStudy }) => {
                  const complete = planTotal > 0 && earnedTotal >= planTotal;
                  const deficit  = Math.max(0, planTotal - earnedTotal - onStudy);
                  const pct      = planTotal > 0 ? Math.min(100, (earnedTotal / planTotal) * 100) : 0;

                  return (
                    <Box
                      key={code}
                      sx={(theme) => ({
                        border: "1px solid",
                        borderColor: complete ? theme.palette.success.main : "divider",
                        borderRadius: 1.5,
                        overflow: "hidden",
                      })}
                    >
                      {/* Header: name + status chip */}
                      <Box
                        sx={(theme) => ({
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          px: 1.5,
                          py: 0.875,
                          bgcolor: complete
                            ? alpha(theme.palette.success.main, 0.06)
                            : "action.hover",
                        })}
                      >
                        <Box sx={{ minWidth: 0, mr: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                            {name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ fontFamily: "monospace", fontSize: "0.65rem" }}
                          >
                            {code}
                          </Typography>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          {complete ? (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: "0.75rem !important" }} />}
                              label="Done"
                              size="small"
                              color="success"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : deficit > 0 ? (
                            <Chip
                              label={`−${formatCredits(deficit)} cr`}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : onStudy > 0 ? (
                            <Chip
                              label="On Study"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : (
                            <Chip
                              label="Planned"
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.68rem",
                                "& .MuiChip-label": { px: 0.75 },
                                color: "text.disabled",
                                borderColor: "divider",
                              }}
                            />
                          )}
                        </Box>
                      </Box>

                      {/* Progress bar */}
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={complete ? "success" : earnedTotal > 0 ? "primary" : "inherit"}
                        sx={{ height: 3 }}
                        aria-label={`${name}: ${Math.round(pct)}%`}
                      />

                      {/* 4-stat row: Plan / Earned / On Study / Need */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          px: 1.5,
                          py: 0.875,
                        }}
                      >
                        {(([
                          { label: "Plan",     value: planTotal,   color: "text.secondary"                                                                    },
                          { label: "Earned",   value: earnedTotal, color: complete ? "success.main" : earnedTotal > 0 ? "text.primary" : "text.disabled"      },
                          { label: "On Study", value: onStudy,     color: onStudy > 0 ? "info.main" : "text.disabled"                                         },
                          { label: "Need",     value: deficit,     color: deficit > 0 ? "error.main" : "text.disabled"                                        },
                        ]) as Array<{ label: string; value: number; color: string }>).map(({ label, value, color }) => (
                          <Box key={label} sx={{ textAlign: "center" }}>
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              sx={{ display: "block", fontSize: "0.6rem", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: "0.04em" }}
                            >
                              {label}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                              color={color}
                            >
                              {value > 0 ? formatCredits(value) : "—"}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}

                {unitRows.length > 0 && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 0.2, px: 0.5 }}>
                    Non-credits
                  </Typography>
                )}
                {unitRows.map(({ code, name, required, earned }) => {
                  const complete = required > 0 && earned >= required;
                  const deficit  = Math.max(0, required - earned);
                  const pct      = required > 0 ? Math.min(100, (earned / required) * 100) : 0;

                  return (
                    <Box
                      key={code}
                      sx={(theme) => ({
                        border: "1px solid",
                        borderColor: complete ? theme.palette.success.main : "divider",
                        borderRadius: 1.5,
                        overflow: "hidden",
                      })}
                    >
                      <Box
                        sx={(theme) => ({
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          px: 1.5,
                          py: 0.875,
                          bgcolor: complete ? alpha(theme.palette.success.main, 0.06) : "action.hover",
                        })}
                      >
                        <Box sx={{ minWidth: 0, mr: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                            {name}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace", fontSize: "0.65rem" }}>
                            {code} · ut
                          </Typography>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          {complete ? (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: "0.75rem !important" }} />}
                              label="Done"
                              size="small"
                              color="success"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : deficit > 0 ? (
                            <Chip
                              label={`−${formatCredits(deficit)} ut`}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : (
                            <Chip
                              label="Planned"
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 }, color: "text.disabled", borderColor: "divider" }}
                            />
                          )}
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={complete ? "success" : earned > 0 ? "secondary" : "inherit"}
                        sx={{ height: 3 }}
                        aria-label={`${name}: ${Math.round(pct)}%`}
                      />
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", px: 1.5, py: 0.875 }}>
                        {(([
                          { label: "Plan",   value: required, color: "text.secondary"                                                               },
                          { label: "Earned", value: earned,   color: complete ? "success.main" : earned > 0 ? "text.primary" : "text.disabled"      },
                          { label: "Need",   value: deficit,  color: deficit > 0 ? "error.main" : "text.disabled"                                   },
                        ]) as Array<{ label: string; value: number; color: string }>).map(({ label, value, color }) => (
                          <Box key={label} sx={{ textAlign: "center" }}>
                            <Typography variant="caption" color="text.disabled" sx={{ display: "block", fontSize: "0.6rem", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} color={color}>
                              {value > 0 ? formatCredits(value) : "—"}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>

              {/* Desktop: table view */}
              <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                <Table size="small" aria-label="Per-category credit breakdown">
                  <TableHead>
                    <TableRow
                      sx={{
                        "& .MuiTableCell-root": {
                          fontWeight: 600,
                          color: "text.secondary",
                          fontSize: "0.75rem",
                          bgcolor: "action.hover",
                        },
                      }}
                    >
                      <TableCell scope="col">Category</TableCell>
                      <TableCell scope="col" align="right">Plan</TableCell>
                      <TableCell scope="col" align="right">Earned</TableCell>
                      <TableCell scope="col" align="right">On Study</TableCell>
                      <TableCell scope="col" sx={{ minWidth: 100 }}>Progress</TableCell>
                      <TableCell scope="col" align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0.5, bgcolor: "action.hover" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", letterSpacing: 0.2 }}>
                            Credits
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {analyticsData.map(({ code, name, planTotal, earnedTotal, onStudy }) => {
                      const complete = planTotal > 0 && earnedTotal >= planTotal;
                      const deficit  = Math.max(0, planTotal - earnedTotal - onStudy);
                      const pct      = planTotal > 0 ? Math.min(100, (earnedTotal / planTotal) * 100) : 0;
                      return (
                        <TableRow key={code}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{name}</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{code}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatCredits(planTotal)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: complete ? 700 : 400, fontVariantNumeric: "tabular-nums" }}
                              color={complete ? "success.main" : earnedTotal > 0 ? "text.primary" : "text.secondary"}
                            >
                              {formatCredits(earnedTotal)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={onStudy > 0 ? "info.main" : "text.disabled"}
                              sx={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {onStudy > 0 ? formatCredits(onStudy) : "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={complete ? "success" : earnedTotal > 0 ? "primary" : "inherit"}
                              aria-label={`${name}: ${Math.round(pct)}%`}
                              sx={{ borderRadius: 3, height: 5 }}
                            />
                            {onStudy > 0 && !complete && (
                              <Typography variant="caption" color="info.main" sx={{ fontSize: "0.62rem" }}>
                                +{formatCredits(onStudy)} on study
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {complete ? (
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.25 }} aria-label="Complete">
                                <CheckCircleIcon sx={{ fontSize: "0.875rem", color: "success.main" }} aria-hidden="true" />
                                <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>Done</Typography>
                              </Box>
                            ) : deficit > 0 ? (
                              <Typography variant="body2" color="error.main" sx={{ fontVariantNumeric: "tabular-nums" }}>−{formatCredits(deficit)}</Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {unitRows.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0.5, bgcolor: "action.hover" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 0.2 }}>
                            Non-credits
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {unitRows.map(({ code, name, required, earned }) => {
                      const complete = required > 0 && earned >= required;
                      const deficit  = Math.max(0, required - earned);
                      const pct      = required > 0 ? Math.min(100, (earned / required) * 100) : 0;
                      return (
                        <TableRow key={code}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{name}</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{code} · ut</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatCredits(required)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: complete ? 700 : 400, fontVariantNumeric: "tabular-nums" }}
                              color={complete ? "success.main" : earned > 0 ? "text.primary" : "text.secondary"}
                            >
                              {formatCredits(earned)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          </TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={complete ? "success" : earned > 0 ? "secondary" : "inherit"}
                              aria-label={`${name}: ${Math.round(pct)}%`}
                              sx={{ borderRadius: 3, height: 5 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {complete ? (
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.25 }} aria-label="Complete">
                                <CheckCircleIcon sx={{ fontSize: "0.875rem", color: "success.main" }} aria-hidden="true" />
                                <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>Done</Typography>
                              </Box>
                            ) : deficit > 0 ? (
                              <Typography variant="body2" color="error.main" sx={{ fontVariantNumeric: "tabular-nums" }}>−{formatCredits(deficit)} ut</Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </Box>
          </Paper>
        </Stack>
      </CardContent>
    </Card>
  );
}
