import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, Snackbar, TextField, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { mkConfig } from "export-to-csv";
import {
  MUI_TABLE_PAPER_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import ExportToolbar from "./ExportToolbar";
import type { StudentDirectoryRow } from "./types";

type StudentPatch = Pick<
  StudentDirectoryRow,
  "registrationNumber" | "planOfStudyCode" | "gender" | "section" | "mobileNumber" | "batch" | "programme" | "duration" | "mentorName"
>;

type Props = {
  rows: StudentDirectoryRow[];
  busy: boolean;
  canEdit?: boolean;
  planOfStudyOptions: Array<{ code: number; name: string }>;
  mentorNameOptions: string[];
  programmeOptions: Array<{ id: number; name: string }>;
  onSubmitRows: (updates: Array<Pick<StudentDirectoryRow, "userId"> & StudentPatch>) => Promise<void>;
};

function SelectEditField({
  label,
  initialValue,
  options,
  onCommit,
}: {
  label: string;
  initialValue: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (value: string) => void;
}) {
  const [local, setLocal] = useState(initialValue);
  return (
    <TextField
      fullWidth
      select
      label={label}
      variant="standard"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onCommit(e.target.value);
      }}
    >
      <MenuItem value="">None</MenuItem>
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
      ))}
    </TextField>
  );
}

const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  email: false, planOfStudyCode: false, gender: false, section: false,
  mobileNumber: false, batch: false, programme: false, duration: false, mentorName: false,
};

export default function StudentsDirectoryTable(props: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const canEdit = props.canEdit ?? true;
  const [draftRows, setDraftRows] = useState<StudentDirectoryRow[]>(props.rows);
  const [pendingByUserId, setPendingByUserId] = useState<Record<string, StudentPatch>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    isDesktop ? {} : MOBILE_HIDDEN_COLUMNS
  );

  useEffect(() => {
    setColumnVisibility(isDesktop ? {} : MOBILE_HIDDEN_COLUMNS);
  }, [isDesktop]);
  const pendingCount = Object.keys(pendingByUserId).length;

  useEffect(() => {
    setDraftRows(props.rows);
    setPendingByUserId({});
  }, [props.rows]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  const toPatch = (row: StudentDirectoryRow): StudentPatch => ({
    registrationNumber: row.registrationNumber,
    planOfStudyCode: row.planOfStudyCode,
    gender: row.gender,
    section: row.section,
    mobileNumber: row.mobileNumber,
    batch: row.batch,
    programme: row.programme,
    duration: row.duration,
    mentorName: row.mentorName,
  });

  const patchesEqual = (a: StudentPatch, b: StudentPatch) =>
    a.registrationNumber === b.registrationNumber
    && a.planOfStudyCode === b.planOfStudyCode
    && a.gender === b.gender
    && a.section === b.section
    && a.mobileNumber === b.mobileNumber
    && a.batch === b.batch
    && a.programme === b.programme
    && a.duration === b.duration
    && a.mentorName === b.mentorName;

  const stageRowPatch = (sourceRow: StudentDirectoryRow, patch: StudentPatch) => {
    const base = draftRows.find((row) => row.userId === sourceRow.userId) ?? sourceRow;
    const merged = { ...base, ...patch };

    setDraftRows((prev) => prev.map((row) => (row.userId === sourceRow.userId ? merged : row)));

    const original = props.rows.find((row) => row.userId === sourceRow.userId) ?? sourceRow;
    const mergedPatch = toPatch(merged);
    const originalPatch = toPatch(original);

    setPendingByUserId((prev) => {
      if (patchesEqual(mergedPatch, originalPatch)) {
        const { [sourceRow.userId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [sourceRow.userId]: mergedPatch };
    });
  };

  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "students-directory-export",
      }),
    []
  );

  const columns = useMemo<MRT_ColumnDef<StudentDirectoryRow>[]>(
    () => [
      { accessorKey: "fullName", header: "Full Name", enableColumnFilterModes: true, enableEditing: false },
      { accessorKey: "email", header: "Email", enableColumnFilterModes: true, enableEditing: false },
      {
        accessorKey: "registrationNumber",
        header: "Registration Number",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            label="Registration Number"
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.registrationNumber) {
                stageRowPatch(row.original, {
                  registrationNumber: next,
                  planOfStudyCode: row.original.planOfStudyCode,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "planOfStudyCode",
        header: "Plan Of Study Code",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const code = cell.getValue<number | null>();
          if (code == null) return "Not Allotted";
          const option = props.planOfStudyOptions.find((item) => item.code === code);
          return option ? option.name : `Code ${code}`;
        },
        Edit: ({ row, table }) => (
          <SelectEditField
            label="Plan of Study"
            initialValue={
              row.original.planOfStudyCode != null &&
              props.planOfStudyOptions.some((o) => o.code === row.original.planOfStudyCode)
                ? String(row.original.planOfStudyCode)
                : ""
            }
            options={props.planOfStudyOptions.map((o) => ({ value: String(o.code), label: o.name }))}
            onCommit={(next) => {
              const value = next === "" ? null : Number(next);
              if (value !== row.original.planOfStudyCode) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: value,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "gender",
        header: "Gender",
        enableColumnFilterModes: false,
        Edit: ({ row, table }) => (
          <SelectEditField
            label="Gender"
            initialValue={String(row.original.gender ?? "")}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
            onCommit={(next) => {
              if (next !== row.original.gender) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  gender: next,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "section",
        header: "Sec.",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            label="Section"
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.section) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  gender: row.original.gender,
                  section: next,
                  mobileNumber: row.original.mobileNumber,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "mobileNumber",
        header: "Mobile Number",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            label="Mobile Number"
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.mobileNumber) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: next,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "batch",
        header: "Batch",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            label="Batch Year"
            type="number"
            variant="standard"
            defaultValue={String(cell.getValue<number | null>() ?? "")}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const next = raw === "" ? null : Number(raw);
              if ((next === null || Number.isFinite(next)) && next !== row.original.batch) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  batch: next,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "programme",
        header: "Pgm.",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const id = cell.getValue<number | null>();
          if (id == null) return "Not Allotted";
          const option = props.programmeOptions.find((item) => item.id === id);
          return option ? option.name : `Code ${id}`;
        },
        Edit: ({ row, table }) => (
          <SelectEditField
            label="Programme"
            initialValue={
              row.original.programme != null &&
              props.programmeOptions.some((o) => o.id === row.original.programme)
                ? String(row.original.programme)
                : ""
            }
            options={props.programmeOptions.map((o) => ({ value: String(o.id), label: o.name }))}
            onCommit={(next) => {
              const value = next === "" ? null : Number(next);
              if (value !== row.original.programme) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  batch: row.original.batch,
                  programme: value,
                  duration: row.original.duration,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "duration",
        header: "Duration",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            label="Duration (semesters)"
            type="number"
            variant="standard"
            defaultValue={String(cell.getValue<number | null>() ?? "")}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const next = raw === "" ? null : Number(raw);
              if ((next === null || Number.isFinite(next)) && next !== row.original.duration) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: next,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: row.original.mentorName,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "mentorName",
        header: "Mentor Name",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const mentor = String(cell.getValue<string>() ?? "").trim();
          return mentor.length > 0 ? mentor : "Not Allotted";
        },
        Edit: ({ row, table }) => (
          <SelectEditField
            label="Mentor"
            initialValue={String(row.original.mentorName ?? "")}
            options={props.mentorNameOptions.map((name) => ({ value: name, label: name }))}
            onCommit={(next) => {
              if (next !== row.original.mentorName) {
                stageRowPatch(row.original, {
                  registrationNumber: row.original.registrationNumber,
                  planOfStudyCode: row.original.planOfStudyCode,
                  batch: row.original.batch,
                  programme: row.original.programme,
                  duration: row.original.duration,
                  gender: row.original.gender,
                  section: row.original.section,
                  mobileNumber: row.original.mobileNumber,
                  mentorName: next,
                });
              }
              if (isDesktop) table.setEditingCell(null);
            }}
          />
        ),
      },
    ],
    [draftRows, isDesktop, props.mentorNameOptions, props.planOfStudyOptions, props.programmeOptions, props.rows]
  );

  return (
    <>
    <MaterialReactTable
      columns={columns}
      data={draftRows}
      getRowId={(row) => row.userId}
      layoutMode="grid"
      enableEditing={canEdit}
      editDisplayMode={isDesktop ? "cell" : "modal"}
      onEditingRowSave={({ table }) => table.setEditingRow(null)}
      enableRowSelection
      enableRowNumbers
      rowNumberDisplayMode="static"
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableColumnResizing={false}
      enableHiding={isDesktop}
      enableColumnActions
      enableColumnFilters
      enableColumnFilterModes
      enableGlobalFilter
      enablePagination
      displayColumnDefOptions={{
        "mrt-row-numbers": { size: 48, header: "#" },
        "mrt-row-select": { size: 48 },
      }}
      state={{
        isLoading: props.busy,
        showSkeletons: props.busy && draftRows.length === 0,
      }}
      muiTableBodyCellProps={({ cell, column, table }) => ({
        onClick: () => {
          if (!canEdit) return;
          if (column.columnDef.enableEditing === false) return;
          table.setEditingCell(cell);
        },
        sx: {
          cursor: !canEdit || column.columnDef.enableEditing === false ? "default" : "pointer",
          py: 1,
        },
      })}
      renderTopToolbarCustomActions={({ table }) => (
        <ExportToolbar
          table={table}
          busy={props.busy}
          csvConfig={csvConfig}
          getCsvRows={(rows) =>
            rows.map((r) => ({
              fullName: r.fullName,
              email: r.email,
              registrationNumber: r.registrationNumber,
              planOfStudyCode:
                r.planOfStudyCode == null
                  ? "Not Allotted"
                  : (props.planOfStudyOptions.find((item) => item.code === r.planOfStudyCode)?.name ?? `Code ${r.planOfStudyCode}`),
              gender: r.gender || "",
              section: r.section || "",
              mobileNumber: r.mobileNumber || "",
              batch: r.batch ?? "",
              programme:
                r.programme == null
                  ? "Not Allotted"
                  : (props.programmeOptions.find((item) => item.id === r.programme)?.name ?? `Code ${r.programme}`),
              duration: r.duration ?? "",
              mentorName: r.mentorName || "Not Allotted",
            }))
          }
          pdfFilename="students-directory-export.pdf"
          pdfHeaders={["Full Name", "Email", "Reg. No.", "Plan", "Gender", "Section", "Mobile", "Batch", "Programme", "Duration", "Mentor"]}
          getPdfBody={(rows) =>
            rows.map((r) => [
              r.fullName,
              r.email,
              r.registrationNumber,
              r.planOfStudyCode == null
                ? "Not Allotted"
                : (props.planOfStudyOptions.find((item) => item.code === r.planOfStudyCode)?.name ?? `Code ${r.planOfStudyCode}`),
              r.gender || "",
              r.section || "",
              r.mobileNumber || "",
              String(r.batch ?? ""),
              r.programme == null
                ? "Not Allotted"
                : (props.programmeOptions.find((item) => item.id === r.programme)?.name ?? `Code ${r.programme}`),
              String(r.duration ?? ""),
              r.mentorName || "Not Allotted",
            ])
          }
        >
          {canEdit ? (
            <Tooltip title="Save all staged student edits in one request" arrow>
              <span>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  disabled={props.busy || pendingCount === 0}
                  onClick={() => {
                    const updates = Object.entries(pendingByUserId).map(([userId, patch]) => ({ userId, ...patch }));
                    void props.onSubmitRows(updates).then(() => {
                      setPendingByUserId({});
                      setSaveSuccess(true);
                    });
                  }}
                >
                  Save the edits ({pendingCount})
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </ExportToolbar>
      )}
      muiTablePaperProps={MUI_TABLE_PAPER_PROPS}
      muiTableContainerProps={MUI_TABLE_CONTAINER_PROPS}
      muiTableBodyProps={MUI_TABLE_BODY_PROPS}
      muiTableHeadCellProps={MUI_TABLE_HEAD_CELL_PROPS}
      renderEmptyRowsFallback={() => (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No students found. Try adjusting or clearing your filters.
          </Typography>
        </Box>
      )}
      renderDetailPanel={isDesktop ? undefined : ({ row }) => {
        const planName =
          row.original.planOfStudyCode == null
            ? "Not Allotted"
            : (props.planOfStudyOptions.find((o) => o.code === row.original.planOfStudyCode)?.name ?? `Code ${row.original.planOfStudyCode}`);
        const programmeName =
          row.original.programme == null
            ? "Not Allotted"
            : (props.programmeOptions.find((o) => o.id === row.original.programme)?.name ?? `Code ${row.original.programme}`);
        const items = [
          { label: "Email", value: row.original.email || "—" },
          { label: "Gender", value: row.original.gender || "—" },
          { label: "Section", value: row.original.section || "—" },
          { label: "Mobile", value: row.original.mobileNumber || "—" },
          { label: "Batch", value: row.original.batch != null ? String(row.original.batch) : "—" },
          { label: "Programme", value: programmeName },
          { label: "Plan of Study", value: planName },
          { label: "Duration", value: row.original.duration != null ? `${row.original.duration} sem` : "—" },
          { label: "Mentor", value: String(row.original.mentorName ?? "").trim() || "Not Allotted" },
        ];
        return (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1.5, px: 2, py: 1.5 }}>
            {items.map(({ label, value }) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="body2">{value}</Typography>
              </Box>
            ))}
          </Box>
        );
      }}
      state={{ columnVisibility }}
      onColumnVisibilityChange={(updater) =>
        setColumnVisibility((prev) => (typeof updater === "function" ? updater(prev) : updater))
      }
      initialState={{
        pagination: { pageIndex: 0, pageSize: 10 },
        showColumnFilters: false,
        showGlobalFilter: false,
        sorting: [{ id: "registrationNumber", desc: false }],
      }}
      muiPaginationProps={({ table }) => {
        const rowCount = table.getRowCount();
        return {
          rowsPerPageOptions: [...MUI_TABLE_PAGINATION_PROPS_BASE, { label: "All", value: Math.max(1, rowCount) }],
        };
      }}
      renderBottomToolbarCustomActions={({ table }) => (
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{ position: "absolute", width: 1, height: 1, p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
        >
          {`${table.getFilteredRowModel().rows.length} students`}
        </Box>
      )}
    />

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
  </>
  );
}
