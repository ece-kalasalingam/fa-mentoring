import { useEffect, useMemo, useState } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from "material-react-table";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemText,
  MenuList,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LogoutIcon from "@mui/icons-material/Logout";
import { mkConfig } from "export-to-csv";
import {
  getInitials,
  ROLE_COLORS,
  MUI_TABLE_PAPER_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import ExportToolbar from "./ExportToolbar";
import { useDateTimeContext } from "./dateTimeContext";

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

type UserPatch = Partial<{ fullName: string; email: string; username: string; roles: string[]; active: boolean }>;

type Props = {
  rows: UserRow[];
  busy: boolean;
  onResetPassword: (row: UserRow) => void;
  onLogoutSessions: (row: UserRow) => Promise<void>;
  onSubmitRows: (updates: Array<{ row: UserRow; patch: UserPatch }>) => Promise<void>;
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

export default function ManageUsersTable(props: Props) {
  const { formatIst } = useDateTimeContext();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [draftRows, setDraftRows] = useState<UserRow[]>(props.rows);
  const [pendingBySubject, setPendingBySubject] = useState<Record<string, UserPatch>>({});
  const [rolesDialog, setRolesDialog] = useState<TableRow | null>(null);
  const [logoutDialogRow, setLogoutDialogRow] = useState<TableRow | null>(null);
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tablePagination, setTablePagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [tableSorting, setTableSorting] = useState<MRT_SortingState>([]);
  const [tableColumnFilters, setTableColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [tableGlobalFilter, setTableGlobalFilter] = useState("");

  const pendingCount = Object.keys(pendingBySubject).length;

  useEffect(() => {
    setDraftRows(props.rows);
    setPendingBySubject({});
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

  const normalizeRoles = (input: unknown): string[] => {
    const roles = Array.isArray(input) ? input : [];
    const normalized = roles
      .map((role) => String(role ?? "").trim().toLowerCase())
      .filter((role): role is string => role.length > 0);
    const unique = Array.from(new Set(normalized));
    return unique.length > 0 ? unique : ["guest"];
  };

  const toPatch = (row: UserRow): UserPatch => ({
    fullName: String(row.fullName ?? row.email ?? row.subject).trim(),
    email: String(row.email ?? "").trim().toLowerCase(),
    username: String(row.username ?? "").trim().toLowerCase(),
    roles: normalizeRoles(row.roles),
    active: Boolean(row.active),
  });

  const patchesEqual = (a: UserPatch, b: UserPatch): boolean => {
    const rolesA = normalizeRoles(a.roles ?? []);
    const rolesB = normalizeRoles(b.roles ?? []);
    return String(a.fullName ?? "") === String(b.fullName ?? "")
      && String(a.email ?? "") === String(b.email ?? "")
      && String(a.username ?? "") === String(b.username ?? "")
      && Boolean(a.active) === Boolean(b.active)
      && rolesA.length === rolesB.length
      && rolesA.every((role, idx) => role === rolesB[idx]);
  };

  const stageUserPatch = (subject: string, patch: UserPatch) => {
    const sourceRow = draftRows.find((row) => row.subject === subject);
    if (!sourceRow) return;
    const merged: UserRow = {
      ...sourceRow,
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.email !== undefined ? { email: patch.email || null } : {}),
      ...(patch.username !== undefined ? { username: patch.username || null } : {}),
      ...(patch.roles !== undefined ? { roles: normalizeRoles(patch.roles) } : {}),
      ...(patch.active !== undefined ? { active: Boolean(patch.active) } : {}),
    };

    setDraftRows((prev) => prev.map((row) => (row.subject === subject ? merged : row)));

    const original = props.rows.find((row) => row.subject === subject);
    if (!original) return;
    const mergedPatch = toPatch(merged);
    const originalPatch = toPatch(original);

    setPendingBySubject((prev) => {
      if (patchesEqual(mergedPatch, originalPatch)) {
        const { [subject]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [subject]: mergedPatch };
    });
  };

  const tableRows = useMemo<TableRow[]>(
    () =>
      draftRows.map((row) => ({
        id: row.subject,
        fullName: row.fullName || row.subject,
        email: row.email,
        username: row.username || "—",
        roles: row.roles.length > 0 ? row.roles : ["guest"],
        active: row.active,
        provider: row.provider,
        lastLogin:
          row.lastLoginAt && row.createdAt !== row.lastLoginAt
            ? formatIst(row.lastLoginAt)
            : "--",
        source: row,
      })),
    [draftRows, formatIst]
  );

  useEffect(() => {
    const maxPageIndex = Math.max(0, Math.ceil(tableRows.length / tablePagination.pageSize) - 1);
    if (tablePagination.pageIndex > maxPageIndex) {
      setTablePagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [tableRows.length, tablePagination.pageIndex, tablePagination.pageSize]);

  const handleRolesClose = () => {
    if (rolesDialog) {
      const normalized = pendingRoles.length > 0 ? pendingRoles : ["guest"];
      const currentSet = new Set(rolesDialog.roles);
      const changed =
        normalized.length !== currentSet.size ||
        normalized.some((r) => !currentSet.has(r));
      if (changed) {
        stageUserPatch(rolesDialog.source.subject, { roles: normalized });
      }
    }
    setRolesDialog(null);
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
              label="Full name"
              type="text"
              defaultValue={row.original.fullName}
              size="small"
              variant="standard"
              slotProps={{ htmlInput: { autoComplete: "off" } }}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                if (value && value !== row.original.fullName) {
                  stageUserPatch(row.original.source.subject, { fullName: value });
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
                const value = e.currentTarget.value.trim().toLowerCase();
                if (value !== String(row.original.email ?? "").trim().toLowerCase()) {
                  stageUserPatch(row.original.source.subject, { email: value });
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
              aria-label={`Avatar for ${row.original.fullName}`}
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
              <Typography variant="body2" sx={{ fontSize: "0.875rem", fontWeight: 500 }} noWrap>
                {row.original.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.75rem" }} noWrap>
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
              const value = e.currentTarget.value.trim().toLowerCase();
              const current = row.original.username === "—" ? "" : row.original.username;
              if (value !== current) {
                stageUserPatch(row.original.source.subject, { username: value });
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
        Cell: ({ row }) => (
          <Typography variant="body2" color={row.original.username === "—" ? "text.disabled" : "text.primary"}>
            {row.original.username}
          </Typography>
        ),
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
                role="button"
                tabIndex={0}
                aria-label={`Roles: ${roles.join(", ")}. Click to edit.`}
                sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", cursor: "pointer", minHeight: 24, alignItems: "center" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRolesDialog(row.original);
                  setPendingRoles(roles);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setRolesDialog(row.original);
                    setPendingRoles(roles);
                  }
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
        filterFn: (row, _id, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          const rowRoles = (row.original.source.roles ?? []).map((r) => String(r ?? "").trim().toLowerCase());
          return filterValue.some((sel) => rowRoles.includes(String(sel).trim().toLowerCase()));
        },
      },
      {
        accessorKey: "provider",
        header: "Provider",
        size: 100,
        enableEditing: false,
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
        accessorFn: (row) => row.source.lastLoginAt && row.source.createdAt !== row.source.lastLoginAt ? new Date(row.source.lastLoginAt) : null,
        id: "lastLogin",
        header: "Last Login",
        size: 150,
        enableEditing: false,
        enableColumnFilterModes: false,
        filterFn: "greaterThan",
        filterVariant: "date",
        enableGlobalFilter: false,
        Cell: ({ cell, row }) => (
          <Typography variant="body2" color={cell.getValue<Date | null>() ? "text.primary" : "text.disabled"}>
            {cell.getValue<Date | null>() ? row.original.lastLogin : "--"}
          </Typography>
        ),
      },
    ],
    [draftRows]
  );

  const table = useMaterialReactTable({
    columns,
    data: tableRows,
    getRowId: (row) => row.id,

    enableEditing: true,
    editDisplayMode: "cell",

    layoutMode: "grid",
    enableRowActions: true,
    positionActionsColumn: "first",
    enableRowSelection: true,
    enableRowNumbers: true,
    rowNumberDisplayMode: "static",
    enableKeyboardShortcuts: false,
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
      "mrt-row-actions": { size: 88, header: "Actions" },
    },

    manualFiltering: false,
    state: {
      isLoading: props.busy,
      showSkeletons: props.busy && tableRows.length === 0,
      pagination: tablePagination,
      sorting: tableSorting,
      columnFilters: tableColumnFilters,
      globalFilter: tableGlobalFilter,
    },
    onPaginationChange: setTablePagination,
    onSortingChange: setTableSorting,
    onColumnFiltersChange: setTableColumnFilters,
    onGlobalFilterChange: (value) => setTableGlobalFilter(String(value ?? "")),
    autoResetPageIndex: false,

    renderRowActions: ({ row }) => (
      <Box sx={{ display: "flex" }}>
        <Tooltip title={row.original.active ? "Deactivate user" : "Activate user"} arrow>
          <span>
            <IconButton
              size="small"
              disabled={props.busy}
              aria-label={row.original.active ? "Deactivate user" : "Activate user"}
              onClick={() => stageUserPatch(row.original.source.subject, { active: !row.original.active })}
            >
              {row.original.active
                ? <LockOpenIcon fontSize="small" color="success" />
                : <LockIcon fontSize="small" color="error" />}
            </IconButton>
          </span>
        </Tooltip>
        {row.original.source.provider === "local" && (
          <Tooltip title="Reset password" arrow>
            <span>
              <IconButton
                size="small"
                color="warning"
                disabled={props.busy}
                aria-label="Reset password"
                onClick={() => props.onResetPassword(row.original.source)}
              >
                <KeyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="Log out user from all active sessions" arrow>
          <span>
            <IconButton
              size="small"
              color="error"
              disabled={props.busy}
              aria-label="Log out user from all active sessions"
              onClick={() => setLogoutDialogRow(row.original)}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    ),

    renderTopToolbarCustomActions: ({ table: t }) => (
      <ExportToolbar
        table={t}
        busy={props.busy}
        csvConfig={csvConfig}
        getCsvRows={(rows) =>
          rows.map((r) => ({
            user: `${r.fullName} (${r.email ?? "—"})`,
            username: r.username,
            roles: r.roles.join(", "),
            active: r.active ? "Active" : "Disabled",
            provider: r.provider,
            lastLogin: r.lastLogin,
          }))
        }
        pdfFilename="manage-users-export.pdf"
        pdfHeaders={["User", "Username", "Roles", "Status", "Provider", "Last Login"]}
        getPdfBody={(rows) =>
          rows.map((r) => [
            `${r.fullName} (${r.email ?? "—"})`,
            r.username,
            r.roles.join(", "),
            r.active ? "Active" : "Disabled",
            r.provider,
            r.lastLogin,
          ])
        }
      >
        <Tooltip title="Save all staged user edits" arrow>
          <span>
            <Button
              type="button"
              size="small"
              variant="contained"
              disabled={props.busy || pendingCount === 0}
              onClick={() => {
                const updates = Object.entries(pendingBySubject)
                  .map(([subject, patch]) => {
                    const row = props.rows.find((item) => item.subject === subject);
                    if (!row) return null;
                    return { row, patch };
                  })
                  .filter((item): item is { row: UserRow; patch: UserPatch } => item !== null);
                void props.onSubmitRows(updates).then(() => {
                  setPendingBySubject({});
                  setSaveSuccess(true);
                });
              }}
            >
              Save the edits ({pendingCount})
            </Button>
          </span>
        </Tooltip>
      </ExportToolbar>
    ),

    muiTablePaperProps: MUI_TABLE_PAPER_PROPS,
    muiTableContainerProps: MUI_TABLE_CONTAINER_PROPS,
    muiTableBodyProps: MUI_TABLE_BODY_PROPS,
    muiTableHeadCellProps: MUI_TABLE_HEAD_CELL_PROPS,
    muiTableBodyCellProps: { sx: { py: 0.5 } },

    initialState: {
      columnOrder: [
        "mrt-row-select",
        "mrt-row-numbers",
        "mrt-row-actions",
        "user",
        "username",
        "roles",
        "provider",
        "lastLogin",
      ],
      showColumnFilters: false,
      showGlobalFilter: false,
      columnVisibility: isDesktop ? {} : { lastLogin: false, provider: false },
    },
    muiPaginationProps: ({ table: t }) => {
      const rowCount = t.getRowCount();
      return {
        rowsPerPageOptions: rowCount > 50
          ? [...MUI_TABLE_PAGINATION_PROPS_BASE, { label: "All", value: rowCount }]
          : [...MUI_TABLE_PAGINATION_PROPS_BASE],
      };
    },

    renderBottomToolbarCustomActions: ({ table: t }) => (
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: "absolute", width: 1, height: 1, p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {`${t.getFilteredRowModel().rows.length} users`}
      </Box>
    ),

    renderEmptyRowsFallback: () => (
      <Box sx={{ py: 5, textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled">
          No users found. Try adjusting or clearing your filters.
        </Typography>
      </Box>
    ),
  });

  return (
    <>
      <MaterialReactTable table={table} />

      {/* Roles editor — Dialog gives built-in focus trap + Escape handling */}
      <Dialog
        open={Boolean(rolesDialog)}
        onClose={handleRolesClose}
        maxWidth="xs"
        fullWidth
        aria-labelledby="roles-dialog-title"
      >
        <DialogTitle id="roles-dialog-title">
          Assign Roles
          {rolesDialog ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {rolesDialog.fullName}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <MenuList dense disablePadding>
            {ROLE_OPTIONS.map((role) => (
              <MenuItem
                key={role}
                onClick={() =>
                  setPendingRoles((prev) =>
                    prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                  )
                }
              >
                <Checkbox size="small" checked={pendingRoles.includes(role)} sx={{ py: 0 }} />
                <ListItemText primary={role} />
              </MenuItem>
            ))}
          </MenuList>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRolesClose} variant="contained" size="small">Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(logoutDialogRow)}
        onClose={() => setLogoutDialogRow(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="logout-user-dialog-title"
      >
        <DialogTitle id="logout-user-dialog-title">Confirm User Logout</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Log out <b>{logoutDialogRow?.fullName ?? "this user"}</b> from all active sessions?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogRow(null)} disabled={props.busy}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={props.busy || !logoutDialogRow}
            onClick={() => {
              if (!logoutDialogRow) return;
              void props.onLogoutSessions(logoutDialogRow.source).finally(() => {
                setLogoutDialogRow(null);
              });
            }}
          >
            Log Out
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={saveSuccess}
        autoHideDuration={3500}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)} sx={{ width: "100%" }}>
          Users updated successfully.
        </Alert>
      </Snackbar>
    </>
  );
}
