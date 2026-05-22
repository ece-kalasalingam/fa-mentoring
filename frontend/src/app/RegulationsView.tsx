import {
  Alert, Box, Chip, IconButton, Paper, Stack,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tooltip, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { alpha, useTheme } from "@mui/material/styles";
import { formatCredits } from "./utils";
import type { PlanOfStudy, PlansValidationReport, Regulation } from "./types";

// Shared dense cell padding used everywhere
const CELL_PY = 0.6;

type Props = {
  regulations: Regulation[];
  plansOfStudy: PlanOfStudy[];
  plansValidationReport: PlansValidationReport | null;
  isStudentOnlySession: boolean;
  busy: boolean;
  onRefresh: () => void;
  visibleRegulations: Regulation[];
  filteredPlansOfStudy: PlanOfStudy[];
  regulationTab: number;
  setRegulationTab: (tab: number) => void;
  planOfStudyTab: number;
  setPlanOfStudyTab: (tab: number) => void;
};

export default function RegulationsView({
  regulations,
  plansValidationReport,
  isStudentOnlySession,
  busy,
  onRefresh,
  visibleRegulations,
  filteredPlansOfStudy,
  regulationTab,
  setRegulationTab,
  planOfStudyTab,
  setPlanOfStudyTab,
}: Props) {
  const safeRegTab = Math.min(regulationTab, Math.max(visibleRegulations.length - 1, 0));
  const safePlanTab = Math.min(planOfStudyTab, Math.max(filteredPlansOfStudy.length - 1, 0));

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Regulations &amp; Plan of Study
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Credit requirements and semester-wise course plan for your programme
          </Typography>
        </Box>
        <Tooltip title="Refresh" arrow>
          <span>
            <IconButton size="small" aria-label="Refresh" disabled={busy} onClick={onRefresh} sx={{ mt: { xs: 0.5, sm: 0 } }}>
              <RefreshIcon
                fontSize="small"
                sx={{
                  "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                  animation: busy ? "spin 0.8s linear infinite" : "none",
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {plansValidationReport?.hasErrors && !isStudentOnlySession ? (
        <Alert severity="error">
          {`Validation found ${plansValidationReport.totalErrors} issue(s).`}
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {plansValidationReport.byPlan
              .flatMap((p) => p.errors.map((e) => ({ planCode: p.planCode, planName: p.planName, message: e.message })))
              .slice(0, 5)
              .map((item, idx) => (
                <Box component="li" key={`val-${item.planCode}-${idx}`}>
                  <Typography variant="body2">
                    {item.planName} (Code {item.planCode}): {item.message}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Alert>
      ) : null}

      {/* Regulations */}
      {visibleRegulations.length > 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={safeRegTab}
              onChange={(_, v: number) => setRegulationTab(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {visibleRegulations.map((reg, i) => (
                <Tab key={reg.code} value={i} label={reg.name} sx={{ textTransform: "none", minWidth: 120 }} />
              ))}
            </Tabs>
          </Box>
          {visibleRegulations.map((reg, i) =>
            i !== safeRegTab ? null : <RegulationPanel key={reg.code} regulation={reg} />,
          )}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {isStudentOnlySession
              ? "No regulation found for your plan of study."
              : "No regulations found. Click Refresh to reload."}
          </Typography>
        </Paper>
      )}

      {/* Plans of Study */}
      {filteredPlansOfStudy.length > 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={safePlanTab}
              onChange={(_, v: number) => setPlanOfStudyTab(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {filteredPlansOfStudy.map((plan, i) => (
                <Tab
                  key={plan.planCode}
                  value={i}
                  label={plan.planName}
                  sx={{ textTransform: "none", minWidth: 120 }}
                />
              ))}
            </Tabs>
          </Box>
          {filteredPlansOfStudy.map((plan, i) =>
            i !== safePlanTab ? null : (
              <PlanPanel
                key={plan.planCode}
                plan={plan}
                regulation={regulations.find((r) => r.code === plan.regulationCode) ?? null}
              />
            ),
          )}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No course plan found for this regulation. Click Refresh to reload.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Regulation panel ─────────────────────────────────────────────────────────

function RegulationPanel({ regulation }: { regulation: Regulation }) {
  const theme = useTheme();
  const { totalCreditsRequired: total, totalUnitsRequired, categories } = regulation.curriculumStructure;
  const totalUnits = Number(totalUnitsRequired ?? 0);
  const creditCats = categories.filter((c) => (c.measure ?? "credits") === "credits");
  const unitCats = categories.filter((c) => (c.measure ?? "credits") !== "credits");
  const hasRanges = categories.some((c) => c.rule.type === "range");

  const headSx = {
    color: "text.secondary",
    fontWeight: 600,
    fontSize: "0.72rem",
    py: CELL_PY,
    borderBottom: `2px solid ${theme.palette.divider}`,
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      {/* Title + summary */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
        {regulation.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        You need{" "}
        <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
          {total} credits
        </Box>{" "}
        to complete this programme
        {totalUnits > 0 && (
          <>
            {" "}and{" "}
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {totalUnits} non-credit units
            </Box>
          </>
        )}
        .
      </Typography>

      {/* Course credits */}
      {creditCats.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: "block", mb: 0.5, color: "text.secondary", letterSpacing: 1 }}>
            Course Credits
          </Typography>
          <TableContainer sx={{ mb: unitCats.length > 0 ? 2 : 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& .MuiTableCell-head": headSx }}>
                  <TableCell sx={{ width: 52, pl: 0 }}>Code</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>Required</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ "& .MuiTableRow-root:nth-of-type(odd)": { bgcolor: "action.hover" } }}>
                {creditCats.map((cat) => {
                  const isRange = cat.rule.type === "range";
                  const rule = cat.rule as { min?: number; max?: number; value?: number };
                  const reqText = isRange ? `${rule.min}–${rule.max} credits` : `${rule.value} credits`;
                  return (
                    <TableRow key={cat.code} sx={{ "&:last-child td": { border: 0 } }}>
                      <TableCell sx={{ pl: 0, py: CELL_PY }}>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.secondary" }}>
                          {cat.code}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: CELL_PY }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                          <Typography variant="body2">{cat.name}</Typography>
                          {isRange && (
                            <Chip label="Flexible" size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0, py: CELL_PY }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: isRange ? "warning.main" : "text.primary" }}>
                          {reqText}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={2} sx={{ pl: 0, py: CELL_PY, borderTop: `2px solid ${theme.palette.divider}`, fontWeight: 700, fontSize: "0.8rem" }}>
                    Total Credits
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0, py: CELL_PY, borderTop: `2px solid ${theme.palette.divider}`, fontWeight: 700, fontSize: "0.8rem" }}>
                    {total} credits
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Non-Credit units */}
      {unitCats.length > 0 && (
        <>
          <Typography variant="overline" sx={{ display: "block", mb: 0.5, color: "text.secondary", letterSpacing: 1 }}>
            Non-Credit Units
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& .MuiTableCell-head": headSx }}>
                  <TableCell sx={{ width: 52, pl: 0 }}>Code</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>Required</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ "& .MuiTableRow-root:nth-of-type(odd)": { bgcolor: "action.hover" } }}>
                {unitCats.map((cat) => {
                  const rule = cat.rule as { value?: number };
                  const val = rule.value ?? 0;
                  return (
                    <TableRow key={cat.code} sx={{ "&:last-child td": { border: 0 } }}>
                      <TableCell sx={{ pl: 0, py: CELL_PY }}>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.secondary" }}>
                          {cat.code}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: CELL_PY }}>
                        <Typography variant="body2">{cat.name}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0, py: CELL_PY }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {val} {val === 1 ? "unit" : "units"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={2} sx={{ pl: 0, py: CELL_PY, borderTop: `2px solid ${theme.palette.divider}`, fontWeight: 700, fontSize: "0.8rem" }}>
                    Total Units
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0, py: CELL_PY, borderTop: `2px solid ${theme.palette.divider}`, fontWeight: 700, fontSize: "0.8rem" }}>
                    {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Flexible range note */}
      {hasRanges && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.warning.main, 0.06),
            border: "1px solid",
            borderColor: alpha(theme.palette.warning.main, 0.2),
            alignItems: "flex-start",
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: "warning.main", mt: 0.25, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 600, color: "warning.dark" }}>Flexible range</Box>
            {" — "}Your earned credits must fall within the shown min–max range to count towards graduation.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// ─── Plan of Study panel ──────────────────────────────────────────────────────

function PlanPanel({ plan, regulation }: { plan: PlanOfStudy; regulation: Regulation | null }) {
  const theme = useTheme();

  const measureByCode = new Map<string, "credits" | "units">(
    (regulation?.curriculumStructure.categories ?? []).map((c) => [c.code, c.measure ?? "credits"]),
  );
  const computedTotals = plan.semesters.reduce<Record<string, number>>((acc, sem) => {
    Object.entries(sem.categories ?? {}).forEach(([code, raw]) => {
      acc[code] = (acc[code] ?? 0) + Number(raw ?? 0);
    });
    return acc;
  }, {});
  const totalCredits = plan.semesters.reduce((a, s) => a + Number(s.totalCredits ?? 0), 0);
  const totalUnits = plan.semesters.reduce((a, s) => a + Number(s.totalUnits ?? 0), 0);

  const allCodes = Array.from(new Set(plan.semesters.flatMap((s) => Object.keys(s.categories ?? {}))));
  const creditCodes = allCodes.filter((c) => (measureByCode.get(c) ?? "credits") === "credits");
  const unitCodes = allCodes.filter((c) => (measureByCode.get(c) ?? "credits") !== "credits");
  const orderedCodes = [...creditCodes, ...unitCodes];
  const unitBoundary = creditCodes.length;

  const unitBorderSx = (idx: number) =>
    idx === unitBoundary && unitCodes.length > 0
      ? { borderLeft: "2px solid", borderLeftColor: "divider" }
      : undefined;

  const headSx = {
    color: "text.secondary",
    fontWeight: 600,
    fontSize: "0.72rem",
    py: CELL_PY,
    borderBottom: `2px solid ${theme.palette.divider}`,
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      {/* Plan meta */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
        {plan.planName}
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{plan.semesters.length} semesters</Typography>
        <Typography variant="body2" color="text.secondary">·</Typography>
        <Typography variant="body2" color="text.secondary">{totalCredits} credits</Typography>
        {totalUnits > 0 && (
          <>
            <Typography variant="body2" color="text.secondary">·</Typography>
            <Typography variant="body2" color="text.secondary">{totalUnits} non-credit units</Typography>
          </>
        )}
        <Typography variant="body2" color="text.secondary">·</Typography>
        <Typography variant="body2" color="text.secondary">Regulation: {plan.regulationCode}</Typography>
      </Stack>

      {/* Semester table */}
      <Box sx={{ overflowX: "auto", mx: { xs: -1.5, sm: -2 }, px: { xs: 1.5, sm: 2 } }}>
        <Table size="small" padding="none" sx={{ "& .MuiTableCell-root": { px: 1 } }}>
          <TableHead>
            <TableRow sx={{ "& .MuiTableCell-head": headSx }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>Semester</TableCell>
              {orderedCodes.map((code, idx) => (
                <TableCell key={code} align="right" sx={unitBorderSx(idx)}>{code}</TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main", borderLeft: "2px solid", borderLeftColor: "divider", whiteSpace: "nowrap" }}>
                Credits
              </TableCell>
              {unitCodes.length > 0 && (
                <TableCell align="right" sx={{ fontWeight: 700, color: "secondary.main", whiteSpace: "nowrap" }}>
                  Units
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody sx={{ "& .MuiTableRow-root:nth-of-type(odd)": { bgcolor: "action.hover" } }}>
            {plan.semesters.map((sem) => (
              <TableRow key={sem.semester} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                <TableCell sx={{ py: CELL_PY, fontWeight: 600, whiteSpace: "nowrap", color: "text.secondary" }}>
                  Sem {sem.semester}
                </TableCell>
                {orderedCodes.map((code, idx) => {
                  const v = Number(sem.categories?.[code] ?? 0);
                  return (
                    <TableCell key={`${sem.semester}-${code}`} align="right" sx={{ py: CELL_PY, ...unitBorderSx(idx) }}>
                      {v > 0 ? formatCredits(v) : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                  );
                })}
                <TableCell align="right" sx={{ py: CELL_PY, fontWeight: 600, color: "primary.main", borderLeft: "2px solid", borderLeftColor: "divider" }}>
                  {formatCredits(Number(sem.totalCredits ?? 0))}
                </TableCell>
                {unitCodes.length > 0 && (
                  <TableCell align="right" sx={{ py: CELL_PY, fontWeight: 600, color: "secondary.main" }}>
                    {Number(sem.totalUnits ?? 0) > 0
                      ? formatCredits(Number(sem.totalUnits ?? 0))
                      : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {/* Total row */}
            <TableRow>
              <TableCell sx={{ py: CELL_PY, fontWeight: 700, borderTop: `2px solid ${theme.palette.divider}` }}>
                Total
              </TableCell>
              {orderedCodes.map((code, idx) => (
                <TableCell
                  key={`tot-${code}`}
                  align="right"
                  sx={{ py: CELL_PY, fontWeight: 700, borderTop: `2px solid ${theme.palette.divider}`, ...unitBorderSx(idx) }}
                >
                  {formatCredits(Number(computedTotals[code] ?? 0))}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ py: CELL_PY, fontWeight: 700, borderTop: `2px solid ${theme.palette.divider}`, borderLeft: "2px solid", borderLeftColor: "divider", color: "primary.main" }}>
                {totalCredits}
              </TableCell>
              {unitCodes.length > 0 && (
                <TableCell align="right" sx={{ py: CELL_PY, fontWeight: 700, borderTop: `2px solid ${theme.palette.divider}`, color: "secondary.main" }}>
                  {totalUnits}
                </TableCell>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
