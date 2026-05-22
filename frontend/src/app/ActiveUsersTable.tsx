import { useEffect, useMemo, useState } from "react";
import { Avatar, Box, Chip, Typography, useMediaQuery, useTheme } from "@mui/material";
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from "material-react-table";
import { mkConfig } from "export-to-csv";
import {
  getInitials,
  ROLE_COLORS,
  MUI_TABLE_PAPER_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_BODY_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import ExportToolbar from "./ExportToolbar";
import { useDateTimeContext } from "./dateTimeContext";

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
};
const ROLE_OPTIONS = ["admin", "moderator", "head", "faculty", "student", "guest"] as const;

export default function ActiveUsersTable(props: Props) {
  const { formatIst } = useDateTimeContext();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [tablePagination, setTablePagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [tableSorting, setTableSorting] = useState<MRT_SortingState>([]);
  const [tableColumnFilters, setTableColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [tableGlobalFilter, setTableGlobalFilter] = useState("");

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
        lastSeen: formatIst(row.lastSeenAt),
        expiresAt: formatIst(row.latestExpiry),
      })),
    [props.rows, formatIst]
  );

  useEffect(() => {
    const maxPageIndex = Math.max(0, Math.ceil(tableRows.length / tablePagination.pageSize) - 1);
    if (tablePagination.pageIndex > maxPageIndex) {
      setTablePagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [tableRows.length, tablePagination.pageIndex, tablePagination.pageSize]);

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
                aria-label={`Avatar for ${name}`}
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
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{email}</Typography>
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
      layoutMode="grid"
      enableEditing={false}
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
        showSkeletons: props.busy && tableRows.length === 0,
        pagination: tablePagination,
        sorting: tableSorting,
        columnFilters: tableColumnFilters,
        globalFilter: tableGlobalFilter,
      }}
      onPaginationChange={setTablePagination}
      onSortingChange={setTableSorting}
      onColumnFiltersChange={setTableColumnFilters}
      onGlobalFilterChange={(value) => setTableGlobalFilter(String(value ?? ""))}
      autoResetPageIndex={false}
      renderTopToolbarCustomActions={({ table }) => (
        <ExportToolbar
          table={table}
          busy={props.busy}
          csvConfig={csvConfig}
          getCsvRows={(rows) =>
            rows.map((r) => ({
              user: r.user,
              username: r.username,
              roles: r.roles.join(", "),
              sessions: r.sessions,
              lastSeen: r.lastSeen,
              expiresAt: r.expiresAt,
            }))
          }
          pdfFilename="active-users-export.pdf"
          pdfHeaders={["User", "Username", "Roles", "Sessions", "Last Seen", "Expires"]}
          getPdfBody={(rows) =>
            rows.map((r) => [
              r.user,
              r.username,
              r.roles.join(", "),
              String(r.sessions),
              r.lastSeen,
              r.expiresAt,
            ])
          }
        />
      )}
      muiTablePaperProps={MUI_TABLE_PAPER_PROPS}
      muiTableContainerProps={MUI_TABLE_CONTAINER_PROPS}
      muiTableBodyProps={MUI_TABLE_BODY_PROPS}
      muiTableHeadCellProps={MUI_TABLE_HEAD_CELL_PROPS}
      muiTableBodyCellProps={MUI_TABLE_BODY_CELL_PROPS}
      initialState={{
        showColumnFilters: false,
        showGlobalFilter: false,
        columnVisibility: isDesktop ? {} : { lastSeen: false, expiresAt: false, username: false },
      }}
      muiPaginationProps={{ rowsPerPageOptions: [...MUI_TABLE_PAGINATION_PROPS_BASE] }}
      renderBottomToolbarCustomActions={({ table }) => (
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{ position: "absolute", width: 1, height: 1, p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
        >
          {`${table.getFilteredRowModel().rows.length} active users`}
        </Box>
      )}
      renderEmptyRowsFallback={() => (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No active users found. Try adjusting or clearing your filters.
          </Typography>
        </Box>
      )}
    />
  );
}
