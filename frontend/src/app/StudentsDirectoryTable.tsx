import { useMemo } from "react";
import { Box, Button, MenuItem, TextField, Tooltip } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentDirectoryRow } from "./types";

type Props = {
  rows: StudentDirectoryRow[];
  busy: boolean;
  canEdit?: boolean;
  planOfStudyOptions: Array<{ code: number; name: string }>;
  mentorNameOptions: string[];
  programmeOptions: Array<{ id: number; name: string }>;
  onUpdateRow: (row: StudentDirectoryRow, patch: Pick<StudentDirectoryRow, "registrationNumber" | "planOfStudyCode" | "gender" | "section" | "mobileNumber" | "batch" | "programme" | "duration" | "mentorName">) => Promise<void>;
};

export default function StudentsDirectoryTable(props: Props) {
  const canEdit = props.canEdit ?? true;
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
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.registrationNumber) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
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
        Edit: ({ cell, row, table }) => {
          const cellValue = cell.getValue<number | null>();
          const hasMatchingOption =
            cellValue != null && props.planOfStudyOptions.some((option) => option.code === cellValue);
          const editValue = hasMatchingOption ? String(cellValue) : "";
          return (
            <TextField
              autoFocus
              fullWidth
              select
              variant="standard"
              value={editValue}
              onChange={(e) => {
                const raw = String(e.target.value ?? "").trim();
                const next = raw === "" ? null : Number(raw);
                if (next != null && !Number.isInteger(next)) return;
                if (next !== row.original.planOfStudyCode) {
                  void props.onUpdateRow(row.original, {
                    registrationNumber: row.original.registrationNumber,
                    planOfStudyCode: next,
                    batch: row.original.batch,
                    programme: row.original.programme,
                    duration: row.original.duration,
                    gender: row.original.gender,
                    section: row.original.section,
                    mobileNumber: row.original.mobileNumber,
                    mentorName: row.original.mentorName,
                  });
                }
                table.setEditingCell(null);
              }}
            >
              <MenuItem value="">None</MenuItem>
              {props.planOfStudyOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>{option.name}</MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        accessorKey: "gender",
        header: "Gender",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.gender) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "section",
        header: "Section",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.section) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
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
            variant="standard"
            defaultValue={String(cell.getValue<string>() ?? "")}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== row.original.mobileNumber) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
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
            type="number"
            variant="standard"
            defaultValue={String(cell.getValue<number | null>() ?? "")}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const next = raw === "" ? null : Number(raw);
              if ((next === null || Number.isFinite(next)) && next !== row.original.batch) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
            }}
          />
        ),
      },
      {
        accessorKey: "programme",
        header: "Programme",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const id = cell.getValue<number | null>();
          if (id == null) return "Not Allotted";
          const option = props.programmeOptions.find((item) => item.id === id);
          return option ? option.name : `Code ${id}`;
        },
        Edit: ({ cell, row, table }) => {
          const cellValue = cell.getValue<number | null>();
          const hasMatchingOption =
            cellValue != null && props.programmeOptions.some((option) => option.id === cellValue);
          const editValue = hasMatchingOption ? String(cellValue) : "";
          return (
            <TextField
              autoFocus
              fullWidth
              select
              variant="standard"
              value={editValue}
              onChange={(e) => {
                const raw = String(e.target.value ?? "").trim();
                const next = raw === "" ? null : Number(raw);
                if (next != null && !Number.isInteger(next)) return;
                if (next !== row.original.programme) {
                  void props.onUpdateRow(row.original, {
                    registrationNumber: row.original.registrationNumber,
                    planOfStudyCode: row.original.planOfStudyCode,
                    batch: row.original.batch,
                    programme: next,
                    duration: row.original.duration,
                    gender: row.original.gender,
                    section: row.original.section,
                    mobileNumber: row.original.mobileNumber,
                    mentorName: row.original.mentorName,
                  });
                }
                table.setEditingCell(null);
              }}
            >
              <MenuItem value="">None</MenuItem>
              {props.programmeOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        accessorKey: "duration",
        header: "Duration",
        enableColumnFilterModes: false,
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            type="number"
            variant="standard"
            defaultValue={String(cell.getValue<number | null>() ?? "")}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const next = raw === "" ? null : Number(raw);
              if ((next === null || Number.isFinite(next)) && next !== row.original.duration) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
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
        Edit: ({ cell, row, table }) => (
          <TextField
            autoFocus
            fullWidth
            select
            variant="standard"
            value={String(cell.getValue<string>() ?? "")}
            onChange={(e) => {
              const next = String(e.target.value ?? "").trim();
              if (next !== row.original.mentorName) {
                void props.onUpdateRow(row.original, {
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
              table.setEditingCell(null);
            }}
          >
            <MenuItem value="">None</MenuItem>
            {props.mentorNameOptions.map((mentorName) => (
              <MenuItem key={mentorName} value={mentorName}>{mentorName}</MenuItem>
            ))}
          </TextField>
        ),
      },
    ],
    [props]
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={props.rows}
      getRowId={(row) => row.userId}
      layoutMode="semantic"
      enableEditing={canEdit}
      editDisplayMode="cell"
      enableRowSelection
      enableRowNumbers
      rowNumberDisplayMode="static"
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableColumnResizing={false}
      enableColumnActions
      enableColumnFilters
      enableColumnFilterModes
      enableGlobalFilter
      enablePagination
      displayColumnDefOptions={{
        "mrt-row-numbers": { size: 48, header: "#" },
        "mrt-row-select": { size: 48 },
      }}
      state={{ isLoading: props.busy }}
      muiTableBodyCellProps={({ cell, column, table }) => ({
        onClick: () => {
          if (!canEdit) return;
          if (column.columnDef.enableEditing === false) return;
          table.setEditingCell(cell);
        },
        sx: {
          cursor: !canEdit || column.columnDef.enableEditing === false ? "default" : "pointer",
        },
      })}
      renderTopToolbarCustomActions={({ table }) => (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Export visible or selected rows to CSV" arrow>
            <span>
              <Button
                type="button"
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon fontSize="small" />}
                disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
                onClick={() => {
                  const selected = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
                  const rows = selected ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
                  const csv = generateCsv(csvConfig)(
                    rows.map((r) => ({
                      fullName: r.original.fullName,
                      email: r.original.email,
                      registrationNumber: r.original.registrationNumber,
                      planOfStudyCode:
                        r.original.planOfStudyCode == null
                          ? "Not Allotted"
                          : (props.planOfStudyOptions.find((item) => item.code === r.original.planOfStudyCode)?.name ?? `Code ${r.original.planOfStudyCode}`),
                      gender: r.original.gender || "",
                      section: r.original.section || "",
                      mobileNumber: r.original.mobileNumber || "",
                      batch: r.original.batch ?? "",
                      programme: r.original.programme == null
                        ? "Not Allotted"
                        : (props.programmeOptions.find((item) => item.id === r.original.programme)?.name ?? `Code ${r.original.programme}`),
                      duration: r.original.duration ?? "",
                      mentorName: r.original.mentorName || "Not Allotted",
                    }))
                  );
                  download(csvConfig)(csv);
                }}
              >
                Export CSV
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Export visible or selected rows to PDF" arrow>
            <span>
              <Button
                type="button"
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfIcon fontSize="small" />}
                disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
                onClick={() => {
                  const selected = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
                  const rows = selected ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
                  const doc = new jsPDF({ orientation: "landscape" });
                  autoTable(doc, {
                    head: [["Full Name", "Email", "Registration Number", "Plan Of Study Code", "Gender", "Section", "Mobile Number", "Batch", "Programme", "Duration", "Mentor Name"]],
                    body: rows.map((r) => [
                      r.original.fullName,
                      r.original.email,
                      r.original.registrationNumber,
                      r.original.planOfStudyCode == null
                        ? "Not Allotted"
                        : (props.planOfStudyOptions.find((item) => item.code === r.original.planOfStudyCode)?.name ?? `Code ${r.original.planOfStudyCode}`),
                      r.original.gender || "",
                      r.original.section || "",
                      r.original.mobileNumber || "",
                      String(r.original.batch ?? ""),
                      r.original.programme == null
                        ? "Not Allotted"
                        : (props.programmeOptions.find((item) => item.id === r.original.programme)?.name ?? `Code ${r.original.programme}`),
                      String(r.original.duration ?? ""),
                      r.original.mentorName || "Not Allotted",
                    ]),
                  });
                  doc.save("students-directory-export.pdf");
                }}
              >
                Export PDF
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}
      muiTablePaperProps={{ elevation: 0, sx: { border: "none" } }}
      initialState={{ pagination: { pageIndex: 0, pageSize: 10 }, showColumnFilters: false }}
      muiPaginationProps={({ table }) => {
        const rowCount = table.getRowCount();
        const fixed = [
          { label: "10", value: 10 },
          { label: "25", value: 25 },
          { label: "50", value: 50 },
        ];
        return {
          rowsPerPageOptions: [...fixed, { label: "All", value: Math.max(1, rowCount) }],
        };
      }}
    />
  );
}
