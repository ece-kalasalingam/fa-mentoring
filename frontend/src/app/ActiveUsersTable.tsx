import { useMemo } from "react";
import { Avatar, Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getInitials } from "./utils";

type ActiveUserRow = {
  subject: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  roles: string[];
  sessionCount: number;
  lastSeenAt: string;
  latestExpiry: string;
};

type TableRow = {
  id: string;
  user: string;
  email: string | null;
  username: string;
  roles: string[];
  sessions: number;
  sourceLastSeenAt: string;
  sourceLatestExpiry: string;
  lastSeen: string;
  expiresAt: string;
};

type Props = {
  rows: ActiveUserRow[];
  busy: boolean;
  formatIst: (value: string | null | undefined) => string;
};
const ROLE_COLORS: Record<string, "error" | "warning" | "secondary" | "primary" | "success" | "default"> = {
  admin: "error",
  moderator: "warning",
  head: "secondary",
  faculty: "primary",
  student: "success",
  guest: "default",
};
const ROLE_OPTIONS = ["admin", "moderator", "head", "faculty", "student", "guest"] as const;

export default function ActiveUsersTable(props: Props) {
  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "active-users-export",
      }),
    []
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      props.rows.map((row) => ({
        id: `${row.subject}-${row.lastSeenAt}`,
        user: row.fullName || row.email || row.subject,
        email: row.email,
        username: row.username || "—",
        roles: row.roles,
        sessions: row.sessionCount,
        sourceLastSeenAt: row.lastSeenAt,
        sourceLatestExpiry: row.latestExpiry,
        lastSeen: props.formatIst(row.lastSeenAt),
        expiresAt: props.formatIst(row.latestExpiry),
      })),
    [props.rows, props.formatIst]
  );

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "user",
        header: "User",
        size: 210,
        enableColumnFilterModes: true,
        enableEditing: false,
        Cell: ({ row }) => {
          const name = row.original.user;
          const email = row.original.email;
          const showEmail = email && email !== name;
          return (
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
                {getInitials(name)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{name}</Typography>
                {showEmail ? (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{email}</Typography>
                ) : null}
              </Box>
            </Box>
          );
        },
      },
      {
        accessorKey: "username",
        header: "Username",
        size: 130,
        enableColumnFilterModes: true,
        enableEditing: false,
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.original.username === "—" ? "text.disabled" : "text.primary"}
          >
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
        enableEditing: false,
        Cell: ({ row }) => {
          const roles = row.original.roles;
          return roles.length > 0 ? (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {roles.map((role) => (
                <Chip
                  key={`${row.original.id}-${role}`}
                  label={role}
                  size="small"
                  color={ROLE_COLORS[role] ?? "default"}
                  variant="outlined"
                  sx={{ fontWeight: 500, fontSize: "0.7rem" }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          );
        },
      },
      {
        accessorKey: "sessions",
        header: "Sessions",
        size: 110,
        enableColumnFilterModes: false,
        enableEditing: false,
        Cell: ({ cell }) => {
          const count = Number(cell.getValue() ?? 0);
          const color = count > 1 ? "warning" : count > 0 ? "success" : "default";
          return (
            <Chip
              size="small"
              label={`${count} active`}
              color={color}
              variant={count > 0 ? "filled" : "outlined"}
              sx={{ fontWeight: 500, fontSize: "0.7rem" }}
            />
          );
        },
      },
      {
        accessorFn: (row) => (row.sourceLastSeenAt ? new Date(row.sourceLastSeenAt) : null),
        id: "lastSeen",
        header: "Last Seen",
        size: 170,
        enableColumnFilterModes: false,
        filterFn: "greaterThan",
        filterVariant: "date",
        enableGlobalFilter: false,
        enableEditing: false,
        Cell: ({ cell, row }) => (
          <Typography variant="body2" color={cell.getValue<Date | null>() ? "text.primary" : "text.disabled"}>
            {cell.getValue<Date | null>() ? row.original.lastSeen : "—"}
          </Typography>
        ),
      },
      {
        accessorFn: (row) => (row.sourceLatestExpiry ? new Date(row.sourceLatestExpiry) : null),
        id: "expiresAt",
        header: "Expires",
        size: 170,
        enableColumnFilterModes: false,
        filterFn: "greaterThan",
        filterVariant: "date",
        enableGlobalFilter: false,
        enableEditing: false,
        Cell: ({ cell, row }) => (
          <Typography variant="body2" color={cell.getValue<Date | null>() ? "text.primary" : "text.disabled"}>
            {cell.getValue<Date | null>() ? row.original.expiresAt : "—"}
          </Typography>
        ),
      },
    ],
    []
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={tableRows}
      layoutMode="semantic"
      enableEditing={false}
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
      renderTopToolbarCustomActions={({ table }) => (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Export visible or selected rows to CSV" arrow>
            <span>
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
                    roles: row.original.roles.join(", "),
                    sessions: row.original.sessions,
                    lastSeen: row.original.lastSeen,
                    expiresAt: row.original.expiresAt,
                  }));
                  const csv = generateCsv(csvConfig)(csvRows);
                  download(csvConfig)(csv);
                }}
                disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
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
                onClick={() => {
                  const hasSelectedRows = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
                  const rows = hasSelectedRows ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
                  const body = rows.map((row) => [
                    row.original.user,
                    row.original.username,
                    row.original.roles.join(", "),
                    String(row.original.sessions),
                    row.original.lastSeen,
                    row.original.expiresAt,
                  ]);
                  const doc = new jsPDF({ orientation: "landscape" });
                  autoTable(doc, {
                    head: [["User", "Username", "Roles", "Sessions", "Last Seen", "Expires"]],
                    body,
                  });
                  doc.save("active-users-export.pdf");
                }}
                disabled={props.busy || table.getPrePaginationRowModel().rows.length === 0}
              >
                Export PDF
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}
      muiTablePaperProps={{
        elevation: 0,
        sx: { border: "1px solid", borderColor: "divider", borderRadius: 2 },
      }}
      muiTableContainerProps={{
        sx: { overflowX: "auto" },
      }}
      muiTableBodyProps={{
        sx: {
          "& tr:nth-of-type(odd) > td": { backgroundColor: "action.hover" },
        },
      }}
      muiTableHeadCellProps={{
        sx: { fontWeight: 700, fontSize: "0.75rem", py: 1.25, whiteSpace: "nowrap" },
      }}
      muiTableBodyCellProps={{
        sx: { py: 1 },
      }}
      initialState={{
        pagination: { pageIndex: 0, pageSize: 10 },
        showColumnFilters: false,
      }}
      muiPaginationProps={{
        rowsPerPageOptions: [
          10,
          25,
          50,
        ],
      }}
      renderEmptyRowsFallback={() => (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No active users found.
          </Typography>
        </Box>
      )}
    />
  );
}
