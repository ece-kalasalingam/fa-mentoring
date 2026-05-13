import { useEffect, useMemo, useRef, useState } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  ListItemText,
  MenuList,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getInitials } from "./utils";

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
  onUpdateRow: (
    row: UserRow,
    patch: Partial<{ fullName: string; email: string; username: string; roles: string[]; active: boolean }>
  ) => Promise<void>;
  formatIst: (value: string | null | undefined) => string;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
};

type TableRow = {
  id: string;
  fullName: string;
  email: string | null;
  username: string;
  roles: string[];
  active: boolean;
  provider: string;
  lastLogin: string;
  source: UserRow;
};

const ROLE_OPTIONS = ["admin", "moderator", "head", "faculty", "student", "guest"] as const;
const PROVIDER_OPTIONS = ["local", "google"] as const;
const ROLE_COLORS: Record<string, "error" | "warning" | "secondary" | "primary" | "success" | "default"> = {
  admin: "error",
  moderator: "warning",
  head: "secondary",
  faculty: "primary",
  student: "success",
  guest: "default",
};

export default function ManageUsersTable(props: Props) {
  // Always-current ref — fixes the stale closure problem where columns ([] deps)
  // captured the first-render onUpdateRow whose processUserGridRowUpdate had an
  // empty userRows array and silently returned without hitting the DB.
  const onUpdateRowRef = useRef(props.onUpdateRow);
  onUpdateRowRef.current = props.onUpdateRow;

  const [rolesPopover, setRolesPopover] = useState<{ anchorTop: number; anchorLeft: number; row: TableRow } | null>(null);
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);
  const [showGlobalFilter, setShowGlobalFilter] = useState(false);

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
        fullName: row.fullName || row.subject,
        email: row.email,
        username: row.username || "—",
        roles: row.roles.length > 0 ? row.roles : ["guest"],
        active: row.active,
        provider: row.provider,
        lastLogin:
          row.lastLoginAt && row.createdAt !== row.lastLoginAt
            ? props.formatIst(row.lastLoginAt)
            : "--",
        source: row,
      })),
    [props.rows, props.formatIst]
  );

  const handleRolesClose = async () => {
    if (rolesPopover) {
      const normalized = pendingRoles.length > 0 ? pendingRoles : ["guest"];
      const currentSet = new Set(rolesPopover.row.roles);
      const changed =
        normalized.length !== currentSet.size ||
        normalized.some((r) => !currentSet.has(r));
      if (changed) {
        await onUpdateRowRef.current(rolesPopover.row.source, { roles: normalized });
      }
    }
    setRolesPopover(null);
  };

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        id: "user",
        accessorFn: (row) => `${row.fullName} ${row.email ?? ""}`.trim(),
        header: "User",
        size: 200,
        enableColumnFilterModes: true,
        Edit: ({ row, table }) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 260 }}>
            <TextField
              autoFocus
              fullWidth
              label="First name"
              type="text"
              defaultValue={row.original.fullName}
              size="small"
              variant="standard"
              slotProps={{ htmlInput: { autoComplete: "off" } }}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                if (value && value !== row.original.fullName) {
                  void onUpdateRowRef.current(row.original.source, { fullName: value });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              defaultValue={row.original.email ?? ""}
              size="small"
              variant="standard"
              disabled={row.original.source.provider !== "local"}
              slotProps={{ htmlInput: { autoComplete: "off" } }}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                if (value !== (row.original.email ?? "")) {
                  void onUpdateRowRef.current(row.original.source, { email: value });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="small" type="button" onClick={() => table.setEditingCell(null)}>
                Done
              </Button>
            </Box>
          </Box>
        ),
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                fontSize: "0.8rem",
                fontWeight: 700,
                bgcolor: "primary.main",
                flexShrink: 0,
              }}
            >
              {getInitials(row.original.fullName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontSize: "0.875rem", fontWeight: 500 }}
                noWrap
              >
                {row.original.fullName}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", fontSize: "0.75rem" }}
                noWrap
              >
                {row.original.email || "—"}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        size: 130,
        enableColumnFilterModes: true,
        enableEditing: (row) => row.original.source.provider === "local",
        Edit: ({ row, table }) => (
          <TextField
            autoFocus
            fullWidth
            type="text"
            defaultValue={row.original.username === "—" ? "" : row.original.username}
            size="small"
            variant="standard"
            slotProps={{ htmlInput: { autoComplete: "off" } }}
            onBlur={(e) => {
              const value = e.currentTarget.value.trim();
              const current = row.original.username === "—" ? "" : row.original.username;
              if (value !== current) {
                void onUpdateRowRef.current(row.original.source, { username: value });
              }
              table.setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
          />
        ),
        Cell: ({ row }) =>
          <Typography
            variant="body2"
            color={row.original.username === "—" ? "text.disabled" : "text.primary"}
          >
            {row.original.username}
          </Typography>,
      },
      {
        accessorKey: "roles",
        header: "Roles",
        size: 170,
        enableColumnFilterModes: false,
        filterVariant: "multi-select",
        filterSelectOptions: [...ROLE_OPTIONS],
        Cell: ({ row }) => {
          const roles = Array.isArray(row.original.roles) ? row.original.roles : [];
          return (
            <Tooltip title="Click to edit roles" arrow>
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  flexWrap: "wrap",
                  cursor: "pointer",
                  minHeight: 24,
                  alignItems: "center",
                }}
                onClick={(e) => {
                  e.stopPropagation(); // prevent MRT cell-click handler
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRolesPopover({
                    anchorTop: rect.bottom + window.scrollY,
                    anchorLeft: rect.left + window.scrollX,
                    row: row.original,
                  });
                  setPendingRoles(roles);
                }}
              >
                {roles.map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    size="small"
                    color={ROLE_COLORS[role] ?? "default"}
                    variant="outlined"
                    sx={{ fontWeight: 500, fontSize: "0.7rem" }}
                  />
                ))}
              </Box>
            </Tooltip>
          );
        },
        // Keep array-aware role matching while using native MRT multi-select UI.
        filterFn: (row, _id, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          const rowRoles = (row.original.source.roles ?? []).map((r) =>
            String(r ?? "").trim().toLowerCase()
          );
          return filterValue.some((sel) =>
            rowRoles.includes(String(sel).trim().toLowerCase())
          );
        },
      },
      {
        id: "active",
        accessorFn: (originalRow) => (originalRow.active ? "true" : "false"),
        header: "Status",
        size: 80,
        enableColumnFilterModes: false,
        filterVariant: "checkbox",
        // Toggle active/inactive by clicking the lock icon directly
        Cell: ({ row }) => (
          <Tooltip
            title={row.original.active ? "Click to deactivate" : "Click to activate"}
            arrow
          >
            <IconButton
              size="small"
              onClick={() =>
                void onUpdateRowRef.current(row.original.source, {
                  active: !row.original.active,
                })
              }
            >
              {row.original.active ? (
                <LockOpenIcon fontSize="small" color="success" />
              ) : (
                <LockIcon fontSize="small" color="error" />
              )}
            </IconButton>
          </Tooltip>
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider",
        size: 100,
        enableColumnFilterModes: false,
        filterVariant: "select",
        filterSelectOptions: [...PROVIDER_OPTIONS],
        Cell: ({ row }) => {
          const p = row.original.provider;
          return (
            <Chip
              label={p.charAt(0).toUpperCase() + p.slice(1)}
              size="small"
              variant="outlined"
              color={p === "google" ? "primary" : "default"}
              sx={{ fontWeight: 500, fontSize: "0.7rem" }}
            />
          );
        },
      },
      {
        accessorFn: (row) =>
          row.source.lastLoginAt && row.source.createdAt !== row.source.lastLoginAt
            ? new Date(row.source.lastLoginAt)
            : null,
        id: "lastLogin",
        header: "Last Login",
        size: 150,
        enableColumnFilterModes: false,
        filterFn: "greaterThan",
        filterVariant: "date",
        enableGlobalFilter: false,
        Cell: ({ cell, row }) => (
          <Typography
            variant="body2"
            color={cell.getValue<Date | null>() ? "text.primary" : "text.disabled"}
          >
            {cell.getValue<Date | null>() ? row.original.lastLogin : "--"}
          </Typography>
        ),
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: tableRows,
    getRowId: (row) => row.id,

    enableEditing: true,
    editDisplayMode: "cell",

    layoutMode: "semantic",
    enableRowActions: true,
    enableRowSelection: true,
    enableRowNumbers: true,
    rowNumberDisplayMode: "static",
    enableKeyboardShortcuts: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnResizing: false,
    enableColumnActions: true,
    enableColumnFilters: true,
    enableColumnFilterModes: true,
    enableGlobalFilter: true,
    enablePagination: true,

    displayColumnDefOptions: {
      "mrt-row-numbers": { size: 48, header: "#" },
      "mrt-row-select": { size: 48 },
      "mrt-row-actions": { size: 56, header: "" },
    },

    manualFiltering: false,
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(props.globalFilter) : updater;
      props.onGlobalFilterChange(String(next ?? ""));
    },
    onShowGlobalFilterChange: (updater) => {
      const next = typeof updater === "function" ? updater(showGlobalFilter) : updater;
      setShowGlobalFilter(Boolean(next));
    },
    state: {
      isLoading: props.busy,
      globalFilter: props.globalFilter,
      showGlobalFilter,
    },

    renderRowActions: ({ row }) =>
      row.original.source.provider === "local" ? (
        <Tooltip title="Reset password" arrow>
          <span>
            <IconButton
              size="small"
              color="warning"
              disabled={props.busy}
              onClick={() => props.onResetPassword(row.original.source)}
            >
              <KeyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : null,

    renderTopToolbarCustomActions: ({ table }) => (
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
                const hasSel =
                  table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
                const rows = hasSel
                  ? table.getSelectedRowModel().rows
                  : table.getPrePaginationRowModel().rows;
                download(csvConfig)(
                  generateCsv(csvConfig)(
                    rows.map((r) => ({
                      user: `${r.original.fullName} (${r.original.email ?? "—"})`,
                      username: r.original.username,
                      roles: r.original.roles.join(", "),
                      active: r.original.active ? "Active" : "Disabled",
                      provider: r.original.provider,
                      lastLogin: r.original.lastLogin,
                    }))
                  )
                );
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
                const hasSel =
                  table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
                const rows = hasSel
                  ? table.getSelectedRowModel().rows
                  : table.getPrePaginationRowModel().rows;
                const doc = new jsPDF({ orientation: "landscape" });
                autoTable(doc, {
                  head: [["User", "Username", "Roles", "Status", "Provider", "Last Login"]],
                  body: rows.map((r) => [
                    `${r.original.fullName} (${r.original.email ?? "—"})`,
                    r.original.username,
                    r.original.roles.join(", "),
                    r.original.active ? "Active" : "Disabled",
                    r.original.provider,
                    r.original.lastLogin,
                  ]),
                });
                doc.save("manage-users-export.pdf");
              }}
            >
              Export PDF
            </Button>
          </span>
        </Tooltip>
      </Box>
    ),

    muiTablePaperProps: {
      elevation: 0,
      sx: { border: "1px solid", borderColor: "divider", borderRadius: 2 },
    },
    muiTableContainerProps: { sx: { overflowX: "auto" } },
    muiTableBodyProps: {
      sx: { "& tr:nth-of-type(odd) > td": { backgroundColor: "action.hover" } },
    },
    muiTableHeadCellProps: {
      sx: { fontWeight: 700, fontSize: "0.75rem", py: 1.25, whiteSpace: "nowrap" },
    },
    muiTableBodyCellProps: { sx: { py: 0.5 } },

    initialState: {
      columnOrder: [
        "mrt-row-select",
        "mrt-row-numbers",
        "user",
        "username",
        "roles",
        "active",
        "provider",
        "lastLogin",
        "mrt-row-actions",
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      showColumnFilters: false,
    },
    muiPaginationProps: ({ table }) => {
      const rowCount = table.getRowCount();
      const fixed = [
        { label: "10", value: 10 },
        { label: "25", value: 25 },
        { label: "50", value: 50 },
      ];
      return {
        rowsPerPageOptions: rowCount > 50
          ? [...fixed, { label: "All", value: rowCount }]
          : fixed,
      };
    },

    renderEmptyRowsFallback: () => (
      <Box sx={{ py: 5, textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled">
          No users found for current filters.
        </Typography>
      </Box>
    ),
  });

  return (
    <>
      <MaterialReactTable table={table} />

      {/* Roles popover — multi-select outside MRT's edit machinery */}
      {rolesPopover && <Popover
        open
        anchorReference="anchorPosition"
        anchorPosition={{ top: rolesPopover.anchorTop, left: rolesPopover.anchorLeft }}
        onClose={handleRolesClose}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ minWidth: 180 }}>
          <Typography
            variant="caption"
            sx={{ px: 2, py: 1, display: "block", fontWeight: 600, color: "text.secondary" }}
          >
            Assign Roles
          </Typography>
          <Divider />
          <MenuList dense disablePadding>
            {ROLE_OPTIONS.map((role) => (
              <MenuItem
                key={role}
                onClick={() =>
                  setPendingRoles((prev) =>
                    prev.includes(role)
                      ? prev.filter((r) => r !== role)
                      : [...prev, role]
                  )
                }
              >
                <Checkbox size="small" checked={pendingRoles.includes(role)} sx={{ py: 0 }} />
                <ListItemText primary={role} />
              </MenuItem>
            ))}
          </MenuList>
        </Box>
      </Popover>}
    </>
  );
}
