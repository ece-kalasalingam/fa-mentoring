import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Avatar, Badge, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  MenuItem, Snackbar, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LaunchIcon from "@mui/icons-material/Launch";
import GroupsIcon from "@mui/icons-material/Groups";
import SaveIcon from "@mui/icons-material/Save";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
} from "material-react-table";
import { mkConfig } from "export-to-csv";
import {
  getInitials,
  MUI_TABLE_PAPER_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import ExportToolbar from "./ExportToolbar";
import { formatIst } from "./dateTime";
import type { CreditStatus, StudentCreditSummary, StudentDirectoryRow } from "./types";
import { CREDIT_STATUSES, CREDIT_STATUS_LABELS } from "./constants";

type StudentPatch = Pick<
  StudentDirectoryRow,
  "registrationNumber" | "planOfStudyCode" | "currentSemester" | "batch" | "programme" | "graduated" | "mentorName"
>;

type Props = {
  rows: StudentDirectoryRow[];
  busy: boolean;
  initialGraduatedFilter?: "Yes" | "No" | null;
  initialCreditStatusFilter?: CreditStatus | null;
  initialBatchFilter?: number | null;
  canEdit?: boolean;
  showMentorName?: boolean;
  showProgramme?: boolean;
  showModifiedAudit?: boolean;
  planOfStudyOptions: Array<{ code: number; name: string }>;
  planSemesterBounds?: Record<number, { min: number; max: number }>;
  mentorNameOptions: string[];
  programmeOptions: Array<{ id: number; name: string }>;
  onSubmitRows: (updates: Array<Pick<StudentDirectoryRow, "userId"> & StudentPatch>) => Promise<void>;
  onOpenStudentCredits?: (row: StudentDirectoryRow) => void;
  onImportCredits?: (rows: Array<{ registrationNumber: string; semester: number; categoryCode: string; credits: number }>) => Promise<{ imported: number; failed: number; errors: string[] }>;
  onImportStudentsCsv?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onVisibleRowsChange?: (rows: StudentDirectoryRow[]) => void;
  creditSummaries?: Record<string, StudentCreditSummary>;
};

const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  email: false, planOfStudyCode: false, batch: false, programme: false, graduated: false, mentorName: false,
  crTarget: false, crEarned: false, crPercent: false, deficient: false,
};

const STATUS_ORDER: Record<CreditStatus, number> = {
  "off-track": 0, "marginal": 1, "on-track": 2, "complete": 3,
};

export default function StudentsDirectoryTable(props: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const canEdit = props.canEdit ?? true;
  const showMentorName = props.showMentorName ?? true;
  const showProgramme = props.showProgramme ?? true;
  const showModifiedAudit = props.showModifiedAudit ?? false;
  const [draftRows, setDraftRows] = useState<StudentDirectoryRow[]>(props.rows);
  const [baselineRows, setBaselineRows] = useState<StudentDirectoryRow[]>(props.rows);
  const [pendingByRowKey, setPendingByRowKey] = useState<Record<string, StudentPatch>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [creditImportResult, setCreditImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [creditImportBusy, setCreditImportBusy] = useState(false);
  const creditFileInputRef = useRef<HTMLInputElement>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    isDesktop ? {} : MOBILE_HIDDEN_COLUMNS,
  );
  const [tableSorting, setTableSorting] = useState<MRT_SortingState>([{ id: "registrationNumber", desc: false }]);
  const [tableColumnFilters, setTableColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [tableGlobalFilter, setTableGlobalFilter] = useState<string>("");
  const lastAppliedInitialGraduatedFilterRef = useRef<"Yes" | "No" | null | undefined>(undefined);
  const lastAppliedCreditStatusFilterRef = useRef<string | null | undefined>(undefined);
  const lastAppliedInitialBatchFilterRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    setColumnVisibility(isDesktop ? {} : MOBILE_HIDDEN_COLUMNS);
  }, [isDesktop]);
  const pendingCount = Object.keys(pendingByRowKey).length;

  useEffect(() => {
    setDraftRows(props.rows);
    setBaselineRows(props.rows);
    setPendingByRowKey({});
  }, [props.rows]);

  useEffect(() => {
    if (props.initialGraduatedFilter === lastAppliedInitialGraduatedFilterRef.current) {
      return;
    }
    lastAppliedInitialGraduatedFilterRef.current = props.initialGraduatedFilter;

    setTableColumnFilters((prev) => {
      const withoutGraduated = prev.filter((f) => f.id !== "graduated");
      if (props.initialGraduatedFilter == null) {
        return withoutGraduated;
      }
      const graduatedFilterValue = props.initialGraduatedFilter === "Yes";
      return [...withoutGraduated, { id: "graduated", value: graduatedFilterValue }];
    });
  }, [props.initialGraduatedFilter]);

  useEffect(() => {
    if (props.initialCreditStatusFilter === lastAppliedCreditStatusFilterRef.current) {
      return;
    }
    lastAppliedCreditStatusFilterRef.current = props.initialCreditStatusFilter ?? null;

    setTableColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== "status");
      if (props.initialCreditStatusFilter == null) return without;
      return [...without, { id: "status", value: props.initialCreditStatusFilter }];
    });
  }, [props.initialCreditStatusFilter]);

  useEffect(() => {
    if (props.initialBatchFilter === lastAppliedInitialBatchFilterRef.current) {
      return;
    }
    lastAppliedInitialBatchFilterRef.current = props.initialBatchFilter ?? null;

    setTableColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== "batch");
      if (props.initialBatchFilter == null) return without;
      return [...without, { id: "batch", value: String(props.initialBatchFilter) }];
    });
  }, [props.initialBatchFilter]);

  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  const CREDIT_TEMPLATE_HEADERS = "Registration Number,Semester,Course Code,Course Name,Credits,Att.Code,Grade,Category Code,Year of Passing\r\n";
  const PASSING_GRADES = new Set(["S", "A", "B", "C", "D", "E", "P"]);
  const CREDIT_COL_ALIASES: Record<string, string> = {
    "registration number": "regNo", "registration_number": "regNo", "reg no": "regNo", "reg_no": "regNo",
    "semester": "semester",
    "credits": "credits",
    "category code": "categoryCode", "category_code": "categoryCode",
    "grade": "grade",
  };

  function handleDownloadCreditTemplate() {
    const blob = new Blob([CREDIT_TEMPLATE_HEADERS], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credits-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !props.onImportCredits) return;
    e.target.value = "";

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;

    const rawHeaders = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const colIndex: Record<string, number> = {};
    rawHeaders.forEach((h, i) => {
      const mapped = CREDIT_COL_ALIASES[h];
      if (mapped) colIndex[mapped] = i;
    });

    if (colIndex.regNo == null || colIndex.semester == null || colIndex.categoryCode == null || colIndex.credits == null) {
      setCreditImportResult({ imported: 0, failed: 0, errors: ["CSV must have columns: Registration Number, Semester, Category Code, Credits"] });
      return;
    }

    const readCell = (cells: string[], key: string) =>
      cells[colIndex[key] ?? -1]?.replace(/^"|"$/g, "").trim() ?? "";

    const hasGradeCol = colIndex.grade != null;
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(",");
      return {
        registrationNumber: readCell(cells, "regNo"),
        semester: Number(readCell(cells, "semester")),
        categoryCode: readCell(cells, "categoryCode"),
        credits: Number(readCell(cells, "credits")),
        grade: readCell(cells, "grade").toUpperCase(),
      };
    }).filter((r) =>
      r.registrationNumber &&
      r.semester > 0 &&
      r.categoryCode &&
      r.credits > 0 &&
      (!hasGradeCol || PASSING_GRADES.has(r.grade)),
    );

    if (rows.length === 0) {
      setCreditImportResult({ imported: 0, failed: 0, errors: ["No valid data rows found."] });
      return;
    }

    setCreditImportBusy(true);
    try {
      const result = await props.onImportCredits(rows);
      setCreditImportResult(result);
    } finally {
      setCreditImportBusy(false);
    }
  }

  const toPatch = (row: StudentDirectoryRow): StudentPatch => ({
    registrationNumber: row.registrationNumber,
    planOfStudyCode: row.planOfStudyCode,
    currentSemester: row.currentSemester,
    batch: row.batch,
    programme: row.programme,
    graduated: row.graduated,
    mentorName: row.mentorName,
  });

  const patchesEqual = (a: StudentPatch, b: StudentPatch) =>
    a.registrationNumber === b.registrationNumber
    && a.planOfStudyCode === b.planOfStudyCode
    && a.currentSemester === b.currentSemester
    && a.batch === b.batch
    && a.programme === b.programme
    && a.graduated === b.graduated
    && a.mentorName === b.mentorName;

  const getStableRowKey = (row: StudentDirectoryRow): string => {
    const userId = String(row.userId ?? "").trim();
    if (userId) return `uid:${userId}`;
    const email = String(row.email ?? "").trim().toLowerCase();
    if (email) return `email:${email}`;
    const reg = String(row.registrationNumber ?? "").trim().toLowerCase();
    if (reg) return `reg:${reg}`;
    return `name:${String(row.fullName ?? "").trim().toLowerCase()}`;
  };

  const stageRowPatch = (sourceRow: StudentDirectoryRow, patch: StudentPatch) => {
    const sourceKey = getStableRowKey(sourceRow);
    const base = draftRows.find((row) => getStableRowKey(row) === sourceKey) ?? sourceRow;
    const merged = { ...base, ...patch };

    setDraftRows((prev) => prev.map((row) => (getStableRowKey(row) === sourceKey ? merged : row)));

    const original = baselineRows.find((row) => getStableRowKey(row) === sourceKey) ?? sourceRow;
    const mergedPatch = toPatch(merged);
    const originalPatch = toPatch(original);

    setPendingByRowKey((prev) => {
      if (patchesEqual(mergedPatch, originalPatch)) {
        const { [sourceKey]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [sourceKey]: mergedPatch };
    });
  };

  const stageFieldPatch = (sourceRow: StudentDirectoryRow, changes: Partial<StudentPatch>) => {
    const sourceKey = getStableRowKey(sourceRow);
    const base = draftRows.find((row) => getStableRowKey(row) === sourceKey) ?? sourceRow;
    const nextPatch: StudentPatch = {
      registrationNumber: changes.registrationNumber ?? base.registrationNumber,
      planOfStudyCode: changes.planOfStudyCode ?? base.planOfStudyCode,
      currentSemester: changes.currentSemester ?? base.currentSemester,
      batch: changes.batch ?? base.batch,
      programme: changes.programme ?? base.programme,
      graduated: changes.graduated ?? base.graduated,
      mentorName: changes.mentorName ?? base.mentorName,
    };
    stageRowPatch(sourceRow, nextPatch);
  };

  const getCurrentSemesterBounds = (sourceRow: StudentDirectoryRow): { min: number; max: number } => {
    const current = draftRows.find((r) => getStableRowKey(r) === getStableRowKey(sourceRow)) ?? sourceRow;
    const planCode = current.planOfStudyCode == null ? null : Number(current.planOfStudyCode);
    if (planCode != null && Number.isInteger(planCode)) {
      const fromPlan = props.planSemesterBounds?.[planCode];
      if (fromPlan && Number.isFinite(fromPlan.min) && Number.isFinite(fromPlan.max) && fromPlan.max >= fromPlan.min) {
        return {
          min: Math.max(1, Math.floor(fromPlan.min)),
          max: Math.max(1, Math.floor(fromPlan.max)),
        };
      }
    }
    return { min: 1, max: 12 };
  };

  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "students-directory-export",
      }),
    [],
  );

  const columns = useMemo<MRT_ColumnDef<StudentDirectoryRow>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Full Name",
        enableColumnFilterModes: true,
        enableEditing: false,
        muiTableHeadCellProps: { align: "left" },
        muiTableBodyCellProps: { align: "left" },
        Cell: ({ row, cell }) => {
          const hasUserId = String(row.original.userId ?? "").trim().length > 0;
          const fullName = String(cell.getValue<string>() ?? "");
          const hasRegNo = String(row.original.registrationNumber ?? "").trim().length > 0;
          const canOpenCredits = hasUserId && Boolean(props.onOpenStudentCredits);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  flexShrink: 0,
                  bgcolor: hasUserId ? "primary.main" : "error.main",
                }}
                aria-hidden="true"
              >
                {getInitials(fullName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  aria-label={canOpenCredits ? `Open credit view for ${fullName}` : fullName}
                  endIcon={canOpenCredits ? <LaunchIcon sx={{ fontSize: "0.7rem !important", opacity: 0.6 }} /> : undefined}
                  sx={{
                    px: 0,
                    minWidth: 0,
                    textTransform: "none",
                    justifyContent: "flex-start",
                    textAlign: "left",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    ...(hasUserId ? {} : { color: "error.main", fontWeight: 700 }),
                  }}
                  disabled={!canOpenCredits}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onOpenStudentCredits?.(row.original);
                  }}
                >
                  {fullName}
                </Button>
                {!hasRegNo && hasUserId && (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    sx={{ display: "block", lineHeight: 1, mt: 0.15, fontSize: "0.6rem" }}
                    aria-label="No registration number assigned"
                  >
                    No reg. no.
                  </Typography>
                )}
              </Box>
            </Box>
          );
        },
      },
      { accessorKey: "email", header: "Email", enableColumnFilterModes: true, enableEditing: false },
      {
        accessorKey: "registrationNumber",
        header: "Reg. Number",
        enableColumnFilterModes: true,
        Cell: ({ cell }) => {
          const val = String(cell.getValue<string>() ?? "").trim();
          return val
            ? <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{val}</Typography>
            : <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>—</Typography>;
        },
        muiEditTextFieldProps: ({ row, table }) => ({
          autoFocus: true,
          variant: "standard" as const,
          onBlur: (e) => {
            const next = e.currentTarget.value.trim();
            if (next !== row.original.registrationNumber) {
              stageFieldPatch(row.original, { registrationNumber: next });
            }
            if (isDesktop) table.setEditingCell(null);
          },
        }),
      },
      {
        accessorKey: "planOfStudyCode",
        header: "Plan of Study",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const code = cell.getValue<number | null>();
          if (code == null || code === 0) {
            return (
              <Chip
                label="Not Allotted"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 500 }}
              />
            );
          }
          const option = props.planOfStudyOptions.find((item) => item.code === code);
          const label = option ? option.name : `Code ${code}`;
          return (
            <Chip
              label={label}
              size="small"
              color="default"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.65rem", maxWidth: 160 }}
            />
          );
        },
        Edit: ({ row, table }) => {
          const current = draftRows.find((r) => r.userId === row.original.userId) ?? row.original;
          const value = current.planOfStudyCode == null ? 0 : current.planOfStudyCode;
          return (
            <TextField
              select
              fullWidth
              autoFocus
              label="Plan of Study"
              variant="standard"
              value={value}
              onChange={(e) => {
                const next = Number(String(e.target.value ?? "0"));
                stageFieldPatch(row.original, { planOfStudyCode: next });
              }}
              onBlur={() => {
                if (isDesktop) table.setEditingCell(null);
              }}
            >
              <MenuItem value={0}>0 — Not Allotted</MenuItem>
              {props.planOfStudyOptions.map((o) => (
                <MenuItem key={o.code} value={o.code}>{o.code} — {o.name}</MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        accessorKey: "batch",
        header: "Batch",
        enableColumnFilterModes: false,
        muiEditTextFieldProps: ({ row, table }) => ({
          autoFocus: true,
          type: "number",
          variant: "standard" as const,
          inputProps: { min: 2010, max: 2040, step: 1 },
          onBlur: (e) => {
            const raw = e.currentTarget.value.trim();
            const parsed = raw === "" ? null : Number(raw);
            const next = parsed == null
              ? null
              : Math.max(2010, Math.min(2040, Math.floor(parsed)));
            if ((next === null || Number.isFinite(next)) && next !== row.original.batch) {
              stageFieldPatch(row.original, { batch: next });
            }
            if (isDesktop) table.setEditingCell(null);
          },
        }),
      },
      {
        accessorKey: "currentSemester",
        header: "Semester",
        enableColumnFilterModes: true,
        Cell: ({ row, cell }) => {
          const sem = cell.getValue<number | null>();
          if (sem == null) return <Typography variant="body2" color="text.disabled">—</Typography>;
          const planCode = row.original.planOfStudyCode;
          const bounds = planCode ? props.planSemesterBounds?.[planCode] : null;
          return (
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {sem}
              {bounds ? (
                <Box component="span" sx={{ color: "text.disabled", fontSize: "0.75em" }}>
                  {" "}/ {bounds.max}
                </Box>
              ) : null}
            </Typography>
          );
        },
        muiEditTextFieldProps: ({ row, table }) => ({
          autoFocus: true,
          type: "number",
          variant: "standard" as const,
          inputProps: {
            min: getCurrentSemesterBounds(row.original).min,
            max: getCurrentSemesterBounds(row.original).max,
            step: 1,
          },
          onBlur: (e) => {
            const raw = e.currentTarget.value.trim();
            const parsed = Number(raw);
            const bounds = getCurrentSemesterBounds(row.original);
            const next = raw === "" || !Number.isFinite(parsed) || !Number.isInteger(parsed)
              ? bounds.min
              : Math.max(bounds.min, Math.min(bounds.max, parsed));
            if (next !== (row.original.currentSemester ?? 1)) {
              stageFieldPatch(row.original, { currentSemester: next });
            }
            if (isDesktop) table.setEditingCell(null);
          },
        }),
      },
      ...(showProgramme ? [{
        accessorKey: "programme",
        header: "Pgm.",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const id = cell.getValue<number | null>();
          if (id == null || id === 0) return <Typography variant="body2" color="text.disabled">—</Typography>;
          const option = props.programmeOptions.find((item) => item.id === id);
          return <Typography variant="body2">{option ? option.name : `Code ${id}`}</Typography>;
        },
        Edit: ({ row, table }) => {
          const current = draftRows.find((r) => r.userId === row.original.userId) ?? row.original;
          const value = current.programme == null ? 0 : current.programme;
          return (
            <TextField
              select
              fullWidth
              autoFocus
              label="Programme"
              variant="standard"
              value={value}
              onChange={(e) => {
                const next = Number(String(e.target.value ?? "0"));
                stageFieldPatch(row.original, { programme: next });
              }}
              onBlur={() => {
                if (isDesktop) table.setEditingCell(null);
              }}
            >
              <MenuItem value={0}>0 — Not Allotted</MenuItem>
              {props.programmeOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.id} — {o.name}</MenuItem>
              ))}
            </TextField>
          );
        },
      }] as MRT_ColumnDef<StudentDirectoryRow>[] : []),
      {
        accessorKey: "graduated",
        header: "Passed Out",
        enableColumnFilterModes: false,
        filterVariant: "checkbox",
        accessorFn: (row) => row.graduated === "Yes",
        Cell: ({ row }) => (
          <Chip
            label={row.original.graduated}
            size="small"
            color={row.original.graduated === "Yes" ? "success" : "default"}
            variant={row.original.graduated === "Yes" ? "filled" : "outlined"}
            sx={{ height: 22, fontSize: "0.7rem" }}
          />
        ),
        Edit: ({ row, table }) => {
          const current = draftRows.find((r) => r.userId === row.original.userId) ?? row.original;
          return (
            <TextField
              select
              fullWidth
              autoFocus
              label="Passed Out"
              variant="standard"
              value={current.graduated}
              onChange={(e) => {
                const next = String(e.target.value ?? "No") === "Yes" ? "Yes" : "No";
                stageFieldPatch(row.original, { graduated: next });
              }}
              onBlur={() => {
                if (isDesktop) table.setEditingCell(null);
              }}
            >
              <MenuItem value="No">No</MenuItem>
              <MenuItem value="Yes">Yes</MenuItem>
            </TextField>
          );
        },
      },
      {
        id: "crTarget",
        header: "Cr. Target",
        enableEditing: false,
        enableColumnFilterModes: true,
        accessorFn: (row) => props.creditSummaries?.[row.userId]?.target ?? -1,
        Cell: ({ row }) => {
          const s = props.creditSummaries?.[row.original.userId];
          if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
          return <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{s.target}</Typography>;
        },
      },
      {
        id: "crEarned",
        header: "Cr. Earned",
        enableEditing: false,
        enableColumnFilterModes: true,
        accessorFn: (row) => props.creditSummaries?.[row.userId]?.earned ?? -1,
        Cell: ({ row }) => {
          const s = props.creditSummaries?.[row.original.userId];
          if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
          return (
            <Typography
              variant="body2"
              sx={{ fontVariantNumeric: "tabular-nums" }}
              color={s.status === "complete" ? "success.main" : s.earned > 0 ? "text.primary" : "text.secondary"}
            >
              {s.earned}
            </Typography>
          );
        },
      },
      {
        id: "crPercent",
        header: "%",
        enableEditing: false,
        enableColumnFilterModes: true,
        accessorFn: (row) => {
          const s = props.creditSummaries?.[row.userId];
          if (!s || s.target <= 0) return -1;
          return (s.earned / s.target) * 100;
        },
        Cell: ({ row }) => {
          const s = props.creditSummaries?.[row.original.userId];
          if (!s || s.target <= 0) return <Typography variant="body2" color="text.disabled">—</Typography>;
          const percent = (s.earned / s.target) * 100;
          return (
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {`${percent.toFixed(1)}%`}
            </Typography>
          );
        },
      },
      {
        id: "deficient",
        header: "Deficient",
        enableEditing: false,
        enableColumnFilterModes: false,
        accessorFn: (row) => props.creditSummaries?.[row.userId]?.deficit ?? -1,
        Cell: ({ row }) => {
          const s = props.creditSummaries?.[row.original.userId];
          if (!s || s.deficit === 0) return <Typography variant="body2" color="text.disabled">—</Typography>;
          return (
            <Typography variant="body2" color="error.main" sx={{ fontVariantNumeric: "tabular-nums" }}>
              −{s.deficit}
            </Typography>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        enableEditing: false,
        enableColumnFilterModes: true,
        filterVariant: "select",
        filterSelectOptions: CREDIT_STATUSES.map((v) => ({ label: CREDIT_STATUS_LABELS[v], value: v })),
        accessorFn: (row) => props.creditSummaries?.[row.userId]?.status ?? "",
        sortingFn: (rowA, rowB, columnId) => {
          const a = STATUS_ORDER[(rowA.getValue(columnId) as StudentCreditSummary["status"])] ?? -1;
          const b = STATUS_ORDER[(rowB.getValue(columnId) as StudentCreditSummary["status"])] ?? -1;
          return a - b;
        },
        Cell: ({ row }) => {
          const s = props.creditSummaries?.[row.original.userId];
          if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
          if (s.status === "complete") {
            return (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: "0.7rem !important" }} />}
                label="Complete"
                size="small"
                color="success"
                sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            );
          }
          if (s.status === "on-track") {
            return (
              <Chip
                label="On Track"
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            );
          }
          if (s.status === "marginal") {
            return (
              <Chip
                label="Marginal"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            );
          }
          return (
            <Chip
              label="Off Track"
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
            />
          );
        },
      },
      ...(showMentorName
        ? [{
            accessorKey: "mentorName",
            header: "Mentor",
            enableColumnFilterModes: false,
            Cell: ({ cell }) => {
              const mentor = String(cell.getValue<string>() ?? "").trim();
              return mentor.length > 0
                ? <Typography variant="body2">{mentor}</Typography>
                : <Typography variant="body2" color="text.disabled">—</Typography>;
            },
            editVariant: "select",
            editSelectOptions: props.mentorNameOptions.map((name) => ({ label: name, value: name })),
            muiEditTextFieldProps: ({ row, table }) => ({
              select: true,
              variant: "standard" as const,
              onChange: (e) => {
                const next = String(e.target.value ?? "");
                if (next !== row.original.mentorName) {
                  stageFieldPatch(row.original, { mentorName: next });
                }
              },
              onBlur: () => {
                if (isDesktop) table.setEditingCell(null);
              },
            }),
          }] as MRT_ColumnDef<StudentDirectoryRow>[]
        : []),
      ...(showModifiedAudit
        ? [({
            accessorKey: "modifiedByName",
            header: "Modified By",
            enableColumnFilterModes: false,
            enableEditing: false,
            Cell: ({ cell }) => {
              const value = String(cell.getValue<string>() ?? "").trim();
              return value.length > 0
                ? <Typography variant="body2">{value}</Typography>
                : <Typography variant="body2" color="text.disabled">—</Typography>;
            },
          } as MRT_ColumnDef<StudentDirectoryRow>),
          ({
            accessorKey: "modifiedAt",
            header: "Modified At (IST)",
            filterVariant: "date",
            filterFn: "greaterThan",
            enableGlobalFilter: false,
            enableColumnFilterModes: false,
            enableEditing: false,
            Cell: ({ cell }) => (
              <Typography variant="body2">{formatIst(cell.getValue<string | null>())}</Typography>
            ),
          } as MRT_ColumnDef<StudentDirectoryRow>)]
        : []),
    ],
    [baselineRows, draftRows, isDesktop, props.creditSummaries, props.mentorNameOptions, props.planOfStudyOptions, props.planSemesterBounds, props.programmeOptions, showMentorName, showModifiedAudit, showProgramme],
  );

  const table = useMaterialReactTable({
    columns,
    data: draftRows,
    getRowId: (row, index) => {
      const id = String(row.userId ?? "").trim();
      if (id) return id;
      return `no-id-${String(row.email ?? "").trim() || String(row.registrationNumber ?? "").trim() || index}`;
    },
    layoutMode: "grid",
    enableEditing: canEdit,
    editDisplayMode: isDesktop ? "cell" : "modal",
    onEditingRowSave: ({ table: t }) => t.setEditingRow(null),
    enableRowSelection: true,
    enableRowNumbers: true,
    rowNumberDisplayMode: "static",
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnResizing: false,
    enableHiding: isDesktop,
    enableColumnActions: true,
    enableColumnFilters: true,
    enableColumnFilterModes: true,
    enableGlobalFilter: true,
    enablePagination: true,
    displayColumnDefOptions: {
      "mrt-row-numbers": { size: 48, header: "#" },
      "mrt-row-select": { size: 48 },
    },
    state: {
      isLoading: props.busy || creditImportBusy,
      showSkeletons: (props.busy || creditImportBusy) && draftRows.length === 0,
      columnVisibility,
      sorting: tableSorting,
      columnFilters: tableColumnFilters,
      globalFilter: tableGlobalFilter,
    },
    onSortingChange: setTableSorting,
    onColumnFiltersChange: setTableColumnFilters,
    onGlobalFilterChange: (val) => setTableGlobalFilter(String(val ?? "")),
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility((prev) => (typeof updater === "function" ? updater(prev) : updater)),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      showColumnFilters: false,
      showGlobalFilter: false,
    },
    muiTableBodyCellProps: ({ cell, column, table: t }) => ({
      onClick: () => {
        if (!canEdit) return;
        if (!String(cell.row.original.userId ?? "").trim()) return;
        if (column.columnDef.enableEditing === false) return;
        t.setEditingCell(cell);
      },
      sx: {
        cursor:
          !canEdit || !String(cell.row.original.userId ?? "").trim() || column.columnDef.enableEditing === false
            ? "default"
            : "pointer",
        py: 0.75,
      },
    }),
    renderTopToolbarCustomActions: ({ table: t }) => (
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <ExportToolbar
          table={t}
          busy={props.busy}
          csvConfig={csvConfig}
          getCsvRows={(rows) =>
            rows.map((r) => ({
              fullName: r.fullName,
              email: r.email,
              registrationNumber: r.registrationNumber,
              planOfStudyCode:
                r.planOfStudyCode == null || r.planOfStudyCode === 0
                  ? "Not Allotted"
                  : (props.planOfStudyOptions.find((item) => item.code === r.planOfStudyCode)?.name ?? `Code ${r.planOfStudyCode}`),
              batch: r.batch ?? "",
              currentSemester: r.currentSemester ?? 1,
              ...(showProgramme
                ? {
                    programme:
                      r.programme == null || r.programme === 0
                        ? "Not Allotted"
                        : (props.programmeOptions.find((item) => item.id === r.programme)?.name ?? `Code ${r.programme}`),
                  }
                : {}),
              graduated: r.graduated,
              ...(showMentorName ? { mentorName: r.mentorName || "Not Allotted" } : {}),
            }))
          }
          pdfFilename="students-directory-export.pdf"
          pdfHeaders={
            showProgramme && showMentorName
              ? ["Full Name", "Email", "Reg. No.", "Plan", "Batch", "Semester", "Programme", "Passed Out", "Mentor"]
              : showProgramme
                ? ["Full Name", "Email", "Reg. No.", "Plan", "Batch", "Semester", "Programme", "Passed Out"]
                : showMentorName
                  ? ["Full Name", "Email", "Reg. No.", "Plan", "Batch", "Semester", "Passed Out", "Mentor"]
                  : ["Full Name", "Email", "Reg. No.", "Plan", "Batch", "Semester", "Passed Out"]
          }
          getPdfBody={(rows) =>
            rows.map((r) => [
              r.fullName,
              r.email,
              r.registrationNumber,
              r.planOfStudyCode == null || r.planOfStudyCode === 0
                ? "Not Allotted"
                : (props.planOfStudyOptions.find((item) => item.code === r.planOfStudyCode)?.name ?? `Code ${r.planOfStudyCode}`),
              String(r.batch ?? ""),
              String(r.currentSemester ?? 1),
              ...(showProgramme
                ? [
                    r.programme == null || r.programme === 0
                      ? "Not Allotted"
                      : (props.programmeOptions.find((item) => item.id === r.programme)?.name ?? `Code ${r.programme}`),
                  ]
                : []),
              r.graduated,
              ...(showMentorName ? [r.mentorName || "Not Allotted"] : []),
            ])
          }
        >
          {props.onImportStudentsCsv ? (
            <Tooltip title="Update student details (reg number, plan, semester, batch…) via CSV" arrow>
              <span>
                <Button
                  component="label"
                  size="small"
                  variant="outlined"
                  startIcon={<UploadIcon fontSize="small" />}
                  disabled={props.busy}
                >
                  Update student details
                  <input hidden accept=".csv,text/csv" type="file" onChange={props.onImportStudentsCsv} />
                </Button>
              </span>
            </Tooltip>
          ) : null}
          {props.onImportCredits ? (
            <>
              <Tooltip title="Download a CSV template matching the SIS column format" arrow>
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={handleDownloadCreditTemplate}
                >
                  Credits Template
                </Button>
              </Tooltip>
              <Tooltip title="Upload a filled credits CSV to bulk-import earned credits" arrow>
                <span>
                  <Button
                    component="label"
                    size="small"
                    variant="outlined"
                    startIcon={creditImportBusy
                      ? <CircularProgress size={13} color="inherit" />
                      : <UploadIcon fontSize="small" />
                    }
                    disabled={props.busy || creditImportBusy}
                  >
                    {creditImportBusy ? "Importing…" : "Import Credits"}
                    <input
                      hidden
                      ref={creditFileInputRef}
                      accept=".csv,text/csv"
                      type="file"
                      onChange={handleCreditFileChange}
                    />
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : null}
        </ExportToolbar>

        {canEdit ? (
          <Tooltip title={pendingCount > 0 ? `Save ${pendingCount} unsaved change${pendingCount === 1 ? "" : "s"}` : "No unsaved changes"} arrow>
            <span>
              <Badge badgeContent={pendingCount} color="error" max={99}>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon fontSize="small" />}
                  disabled={props.busy || pendingCount === 0}
                  aria-label={`Save ${pendingCount} pending student edit${pendingCount === 1 ? "" : "s"}`}
                  onClick={async () => {
                    const updates = Object.entries(pendingByRowKey).map(([rowKey, patch]) => {
                      const source =
                        draftRows.find((row) => getStableRowKey(row) === rowKey)
                        ?? baselineRows.find((row) => getStableRowKey(row) === rowKey);
                      return { userId: String(source?.userId ?? ""), ...patch };
                    });
                    try {
                      await props.onSubmitRows(updates);
                      setPendingByRowKey({});
                      setSaveSuccess(true);
                    } catch {
                      // Status is handled by caller; keep staged edits for retry.
                    }
                  }}
                >
                  Save edits
                </Button>
              </Badge>
            </span>
          </Tooltip>
        ) : null}
      </Box>
    ),
    muiTablePaperProps: MUI_TABLE_PAPER_PROPS,
    muiTableContainerProps: MUI_TABLE_CONTAINER_PROPS,
    muiTableBodyProps: MUI_TABLE_BODY_PROPS,
    muiTableHeadCellProps: MUI_TABLE_HEAD_CELL_PROPS,
    renderEmptyRowsFallback: () => (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <GroupsIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} aria-hidden="true" />
        <Typography variant="body2" color="text.disabled">
          No students found.
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Try adjusting or clearing your filters.
        </Typography>
      </Box>
    ),
    renderDetailPanel: isDesktop ? undefined : ({ row }) => {
      const planName =
        row.original.planOfStudyCode == null || row.original.planOfStudyCode === 0
          ? null
          : (props.planOfStudyOptions.find((o) => o.code === row.original.planOfStudyCode)?.name ?? `Code ${row.original.planOfStudyCode}`);
      const programmeName =
        row.original.programme == null || row.original.programme === 0
          ? null
          : (props.programmeOptions.find((o) => o.id === row.original.programme)?.name ?? `Code ${row.original.programme}`);
      const sem = row.original.currentSemester;
      const bounds = row.original.planOfStudyCode ? props.planSemesterBounds?.[row.original.planOfStudyCode] : null;
      const semLabel = sem != null
        ? bounds ? `${sem} / ${bounds.max}` : String(sem)
        : "—";
      const items = [
        { label: "Email", value: row.original.email || "—" },
        { label: "Batch", value: row.original.batch != null ? String(row.original.batch) : "—" },
        ...(showProgramme ? [{ label: "Programme", value: programmeName ?? "Not Allotted" }] : []),
        { label: "Plan of Study", value: planName ?? "Not Allotted" },
        { label: "Semester", value: semLabel },
        { label: "Passed Out", value: row.original.graduated },
        ...(showMentorName ? [{ label: "Mentor", value: String(row.original.mentorName ?? "").trim() || "—" }] : []),
        ...(showModifiedAudit ? [{ label: "Modified By", value: String(row.original.modifiedByName ?? "").trim() || "—" }] : []),
        ...(showModifiedAudit ? [{ label: "Modified At (IST)", value: formatIst(row.original.modifiedAt) }] : []),
      ];
      return (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1.5 }}>
            {items.map(({ label, value }) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, color: value === "Not Allotted" || value === "—" ? "text.disabled" : "text.primary" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    },
    muiPaginationProps: ({ table: t }) => {
      const rowCount = t.getRowCount();
      return {
        rowsPerPageOptions: [...MUI_TABLE_PAGINATION_PROPS_BASE, { label: "All", value: Math.max(1, rowCount) }],
      };
    },
    renderBottomToolbarCustomActions: ({ table: t }) => (
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: "absolute", width: 1, height: 1, p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {`${t.getFilteredRowModel().rows.length} students`}
      </Box>
    ),
  });

  // Emit sorted+filtered rows whenever the user changes sort, filter, global search, or the data itself.
  // The parent uses this list to drive Prev/Next navigation in the student credits view.
  useEffect(() => {
    props.onVisibleRowsChange?.(table.getSortedRowModel().rows.map((r) => r.original));
  }, [tableSorting, tableColumnFilters, tableGlobalFilter, draftRows]);

  return (
    <>
      <MaterialReactTable table={table} />

      <Snackbar
        open={saveSuccess}
        autoHideDuration={3500}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)} sx={{ width: "100%" }}>
          Students updated successfully.
        </Alert>
      </Snackbar>

      <Dialog
        open={creditImportResult !== null}
        onClose={() => setCreditImportResult(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="credit-import-result-title"
      >
        <DialogTitle id="credit-import-result-title">Credits Import Result</DialogTitle>
        <DialogContent>
          {creditImportResult && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Alert severity={creditImportResult.failed > 0 ? "warning" : "success"}>
                {creditImportResult.imported} student{creditImportResult.imported !== 1 ? "s" : ""} updated
                {creditImportResult.failed > 0 ? `, ${creditImportResult.failed} unrecognised registration number${creditImportResult.failed !== 1 ? "s" : ""}` : ""}
                .
              </Alert>
              {creditImportResult.errors.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {creditImportResult.errors.map((err, i) => (
                    <Typography key={i} component="li" variant="caption" color="error.main">
                      {err}
                    </Typography>
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary">
                Credits are aggregated by semester and category code. Existing credits for updated students are replaced.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
