import { useEffect, useMemo, useState } from "react";
import { MaterialReactTable, type MRT_ColumnDef, type MRT_ColumnFiltersState } from "material-react-table";
import { Box, Button, Checkbox, Chip } from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type UserRow = {
  subject: string;
  provider: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  roles: string[];
  active: boolean;
  isSuperuser: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

type Props = {
  rows: UserRow[];
  busy: boolean;
  onResetPassword: (row: UserRow) => void;
  onUpdateRow: (row: UserRow, patch: Partial<{ fullName: string; role: string; active: boolean }>) => Promise<void>;
  formatIst: (value: string | null | undefined) => string;
  quickFilters?: Array<"active" | "disabled" | "neverLoggedIn">;
  roleFilters?: string[];
};

type TableRow = {
  id: string;
  user: string;
  username: string;
  role: string;
  active: boolean;
  provider: string;
  lastLogin: string;
  source: UserRow;
};

export default function ManageUsersTable(props: Props) {
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "manage-users-export",
      }),
    []
  );

  const saveEditedCell = async (row: TableRow, columnId: string, value: unknown) => {
    if (columnId === "user") {
      const next = String(value ?? "").trim();
      const current = String(row.user ?? "").trim();
      if (next && next !== current) {
        await props.onUpdateRow(row.source, { fullName: next });
      }
      return;
    }

    if (columnId === "role") {
      const nextRole = String(value ?? "").trim();
      if (nextRole && nextRole !== row.role) {
        await props.onUpdateRow(row.source, { role: nextRole });
      }
    }
  };

  useEffect(() => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== "active" && f.id !== "lastLogin" && f.id !== "role");
      const selected = props.quickFilters ?? [];
      const hasActive = selected.includes("active");
      const hasDisabled = selected.includes("disabled");
      const hasNeverLoggedIn = selected.includes("neverLoggedIn");
      let next = rest;
      if (hasActive && hasDisabled) {
        // OR semantics on the same column: true OR false => no active filter needed.
      } else if (hasActive) {
        next = [...next, { id: "active", value: "true" }];
      } else if (hasDisabled) {
        next = [...next, { id: "active", value: "false" }];
      }
      if (hasNeverLoggedIn) {
        next = [...next, { id: "lastLogin", value: "--" }];
      }
      const normalizedRoleFilters = (props.roleFilters ?? [])
        .map((role) => String(role ?? "").trim().toLowerCase())
        .filter((role) => role.length > 0);
      if (normalizedRoleFilters.length > 0) {
        next = [...next, { id: "role", value: normalizedRoleFilters }];
      }
      return next;
    });
  }, [props.quickFilters, props.roleFilters]);

  const tableRows = useMemo<TableRow[]>(
    () =>
      props.rows.map((row) => ({
        id: row.subject,
        user: row.fullName || row.email || row.subject,
        username: row.username || "—",
        role: row.roles[0] || "guest",
        active: row.active,
        provider: row.provider,
        lastLogin: row.lastLoginAt && row.createdAt !== row.lastLoginAt ? props.formatIst(row.lastLoginAt) : "--",
        source: row,
      })),
    [props.rows, props.formatIst]
  );

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "user",
        header: "User",
        enableEditing: true,
        muiEditTextFieldProps: ({ row, column }) => ({
          onBlur: (event) => {
            void saveEditedCell(row.original, column.id, event.target.value);
          },
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              void saveEditedCell(row.original, column.id, (event.target as HTMLInputElement).value);
            }
          },
        }),
      },
      {
        accessorKey: "username",
        header: "Username",
        enableEditing: false,
      },
      {
        accessorKey: "role",
        header: "Role",
        editVariant: "select",
        editSelectOptions: ["admin", "moderator", "head", "faculty", "student", "guest"],
        muiEditTextFieldProps: ({ row, column }) => ({
          onChange: (event) => {
            void saveEditedCell(row.original, column.id, event.target.value);
          },
        }),
        filterFn: (row, _id, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          const rowRoles = (row.original.source.roles ?? []).map((role) => String(role ?? "").trim().toLowerCase());
          // OR semantics among selected role chips.
          return filterValue.some((selectedRole) => rowRoles.includes(String(selectedRole).trim().toLowerCase()));
        },
        Cell: ({ cell }) => {
          const role = String(cell.getValue() ?? "guest");
          return (
            <Chip
              size="small"
              label={role.toUpperCase()}
              color={role === "admin" ? "error" : role === "moderator" ? "warning" : "default"}
              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
            />
          );
        },
      },
      {
        accessorKey: "active",
        header: "Active",
        enableEditing: false,
        filterVariant: "select",
        filterSelectOptions: [
          { text: "Active", value: "true" },
          { text: "Disabled", value: "false" },
        ],
        filterFn: (row, id, filterValue) => {
          if (filterValue === undefined || filterValue === null || filterValue === "") return true;
          return String(row.getValue(id)) === String(filterValue);
        },
        Cell: ({ row }) => (
          <Checkbox
            checked={Boolean(row.original.active)}
            disabled={props.busy}
            onChange={(_e, checked) => {
              void props.onUpdateRow(row.original.source, { active: checked });
            }}
          />
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider",
        enableEditing: false,
      },
      {
        accessorKey: "lastLogin",
        header: "Last Login",
        enableEditing: false,
        filterFn: "equals",
      },
      {
        id: "actions",
        header: "Actions",
        enableEditing: false,
        Cell: ({ row }) =>
          row.original.source.provider === "local" ? (
            <Button
              type="button"
              size="small"
              variant="outlined"
              disabled={props.busy}
              onClick={() => props.onResetPassword(row.original.source)}
              startIcon={<KeyIcon fontSize="small" />}
            >
              Reset Password
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [props.busy, props.onResetPassword, props.onUpdateRow]
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={tableRows}
      enableEditing
      editDisplayMode="cell"
      enableRowSelection
      enableRowNumbers
      rowNumberDisplayMode="static"
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableColumnActions
      enableColumnFilters
      enableGlobalFilter
      enablePagination
      displayColumnDefOptions={{
        "mrt-row-select": {
          size: 56,
        },
        "mrt-row-numbers": {
          header: "#",
          size: 56,
        },
      }}
      state={{ isLoading: props.busy, columnFilters }}
      onColumnFiltersChange={setColumnFilters}
      muiTablePaperProps={{
        sx: {
          border: "none",
        },
      }}
      muiTableContainerProps={{
        sx: {
          border: "none",
        },
      }}
      muiTableProps={{
        sx: {
          border: "none",
        },
      }}
      renderTopToolbarCustomActions={({ table }) => (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={() => {
              const hasSelectedRows = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
              const rows = hasSelectedRows ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
              const csvRows = rows.map((row) => ({
                user: row.original.user,
                username: row.original.username,
                role: row.original.role,
                active: row.original.active ? "Active" : "Disabled",
                provider: row.original.provider,
                lastLogin: row.original.lastLogin,
              }));
              const csv = generateCsv(csvConfig)(csvRows);
              download(csvConfig)(csv);
            }}
            disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon fontSize="small" />}
            onClick={() => {
              const hasSelectedRows = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
              const rows = hasSelectedRows ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
              const body = rows.map((row) => [
                row.original.user,
                row.original.username,
                row.original.role,
                row.original.active ? "Active" : "Disabled",
                row.original.provider,
                row.original.lastLogin,
              ]);
              const doc = new jsPDF({ orientation: "landscape" });
              autoTable(doc, {
                head: [["User", "Username", "Role", "Active", "Provider", "Last Login"]],
                body,
              });
              doc.save("manage-users-export.pdf");
            }}
            disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
          >
            Export PDF
          </Button>
        </Box>
      )}
      initialState={{
        pagination: { pageIndex: 0, pageSize: 10 },
        showColumnFilters: false,
      }}
      muiPaginationProps={{
        rowsPerPageOptions: [
          { label: "10", value: 10 },
          { label: "25", value: 25 },
          { label: "50", value: 50 },
          { label: "All", value: tableRows.length || 10 },
        ],
      }}
      renderEmptyRowsFallback={() => "No users found for current filters."}
    />
  );
}
