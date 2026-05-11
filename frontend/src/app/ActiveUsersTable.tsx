import { useMemo } from "react";
import { Box, Button, Chip } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  username: string;
  roles: string[];
  sessions: number;
  lastSeen: string;
  expiresAt: string;
};

type Props = {
  rows: ActiveUserRow[];
  busy: boolean;
  formatIst: (value: string | null | undefined) => string;
};

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
        username: row.username || "—",
        roles: row.roles,
        sessions: row.sessionCount,
        lastSeen: props.formatIst(row.lastSeenAt),
        expiresAt: props.formatIst(row.latestExpiry),
      })),
    [props.rows, props.formatIst]
  );

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      { accessorKey: "user", header: "User", enableEditing: false },
      { accessorKey: "username", header: "Username", enableEditing: false },
      {
        accessorKey: "roles",
        header: "Roles",
        enableEditing: false,
        Cell: ({ row }) => (
          <>
            {row.original.roles.length > 0 ? row.original.roles.map((role) => (
              <Chip
                key={`${row.original.id}-${role}`}
                size="small"
                label={role.toUpperCase()}
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, mr: 0.5, mb: 0.5 }}
              />
            )) : "—"}
          </>
        ),
      },
      {
        accessorKey: "sessions",
        header: "Sessions",
        enableEditing: false,
        Cell: ({ cell }) => {
          const count = Number(cell.getValue() ?? 0);
          const color = count > 1 ? "warning" : count > 0 ? "success" : "default";
          return (
            <Chip
              size="small"
              label={`${count} active`}
              color={color}
              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
            />
          );
        },
      },
      { accessorKey: "lastSeen", header: "Last Seen", enableEditing: false },
      { accessorKey: "expiresAt", header: "Expires", enableEditing: false },
    ],
    []
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={tableRows}
      enableEditing={false}
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
      state={{ isLoading: props.busy }}
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
      renderEmptyRowsFallback={() => "No active users found for current filters."}
    />
  );
}
