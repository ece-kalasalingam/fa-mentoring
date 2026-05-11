import { useMemo } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { Box, Button, TextField } from "@mui/material";
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
  onUpdateRow: (row: UserRow, patch: Partial<{ fullName: string; roles: string[]; active: boolean }>) => Promise<void>;
  formatIst: (value: string | null | undefined) => string;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
};

type TableRow = {
  id: string;
  user: string;
  username: string;
  roles: string[];
  active: boolean;
  provider: string;
  lastLogin: string;
  source: UserRow;
};

export default function ManageUsersTable(props: Props) {
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

  const tableRows = useMemo<TableRow[]>(
    () =>
      props.rows.map((row) => ({
        id: row.subject,
        user: row.fullName || row.email || row.subject,
        username: row.username || "—",
        roles: row.roles.length > 0 ? row.roles : ["guest"],
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
      },
      {
        accessorKey: "username",
        header: "Username",
        enableEditing: false,
      },
      {
        accessorKey: "roles",
        header: "Roles",
        editVariant: "select",
        editSelectOptions: ["admin", "moderator", "head", "faculty", "student", "guest"],
        muiEditTextFieldProps: {
          select: true,
          SelectProps: {
            multiple: true,
            displayEmpty: true,
            renderValue: (selected: unknown) => {
              const roles = Array.isArray(selected) ? selected.map((role) => String(role ?? "")) : [];
              return roles.length > 0 ? roles.join(", ") : "Select roles";
            },
          },
        },
        Cell: ({ row }) => {
          const roles = Array.isArray(row.original.roles) ? row.original.roles : [];
          return roles.length > 0 ? roles.join(", ") : "guest";
        },
        filterFn: (row, _id, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          const rowRoles = (row.original.source.roles ?? []).map((role) => String(role ?? "").trim().toLowerCase());
          // OR semantics among selected role chips.
          return filterValue.some((selectedRole) => rowRoles.includes(String(selectedRole).trim().toLowerCase()));
        },
      },
      {
        accessorKey: "active",
        header: "Active",
        editVariant: "select",
        editSelectOptions: [
          { value: true, label: "Active" },
          { value: false, label: "Disabled" },
        ],
        filterVariant: "select",
        filterSelectOptions: [
          { label: "Active", value: "true" },
          { label: "Disabled", value: "false" },
        ],
        filterFn: (row, id, filterValue) => {
          if (filterValue === undefined || filterValue === null || filterValue === "") return true;
          return String(row.getValue(id)) === String(filterValue);
        },
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
      editDisplayMode="row"
      enableRowActions
      enableRowSelection
      enableRowNumbers
      rowNumberDisplayMode="static"
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableColumnActions
      enableColumnFilters
      enableGlobalFilter
      enablePagination
      state={{ isLoading: props.busy, globalFilter: props.globalFilter, showGlobalFilter: true }}
      manualFiltering
      onGlobalFilterChange={(updater) => {
        const next = typeof updater === "function" ? updater(props.globalFilter) : updater;
        props.onGlobalFilterChange(String(next ?? ""));
      }}
      onEditingRowSave={async ({ row, values, exitEditingMode }) => {
        const patch: Partial<{ fullName: string; roles: string[]; active: boolean }> = {};

        const nextName = String(values.user ?? "").trim();
        const currentName = String(row.original.user ?? "").trim();
        if (nextName && nextName !== currentName) {
          patch.fullName = nextName;
        }

        const nextRolesRaw = Array.isArray(values.roles) ? values.roles : [values.roles];
        const nextRoles = nextRolesRaw
          .map((role) => String(role ?? "").trim().toLowerCase())
          .filter((role): role is string => role.length > 0);
        const uniqueNextRoles = Array.from(new Set(nextRoles));
        const normalizedNextRoles = uniqueNextRoles.length > 0 ? uniqueNextRoles : ["guest"];
        const currentRoles = (Array.isArray(row.original.roles) ? row.original.roles : [])
          .map((role) => String(role ?? "").trim().toLowerCase())
          .filter((role): role is string => role.length > 0);
        if (normalizedNextRoles.join("|") !== currentRoles.join("|")) {
          patch.roles = normalizedNextRoles;
        }

        const nextActiveRaw = values.active;
        const nextActive = typeof nextActiveRaw === "boolean" ? nextActiveRaw : String(nextActiveRaw) === "true";
        if (nextActive !== row.original.active) {
          patch.active = nextActive;
        }

        if (Object.keys(patch).length > 0) {
          await props.onUpdateRow(row.original.source, patch);
        }
        exitEditingMode();
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
                role: Array.isArray(row.original.roles) ? row.original.roles.join(", ") : "",
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
                Array.isArray(row.original.roles) ? row.original.roles.join(", ") : "",
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
