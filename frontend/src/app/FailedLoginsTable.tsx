import { useMemo } from "react";
import { Box, Chip, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useDateTimeContext } from "./dateTimeContext";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { mkConfig } from "export-to-csv";
import {
  MUI_TABLE_PAPER_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_BODY_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import ExportToolbar from "./ExportToolbar";

type FailedLoginRow = {
  attemptRef: number;
  username: string;
  ipAddress: string;
  success: boolean;
  attemptedAt: string;
};

type Props = {
  rows: FailedLoginRow[];
  busy: boolean;
};

type TableRow = {
  id: string;
  attemptedAtRaw: string;
  time: string;
  username: string;
  ipAddress: string;
  status: string;
  success: boolean;
};
export default function FailedLoginsTable(props: Props) {
  const { formatIst } = useDateTimeContext();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "login-activity-export",
      }),
    []
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      props.rows.map((row) => ({
        id: `${row.attemptRef}-${row.attemptedAt}`,
        attemptedAtRaw: row.attemptedAt,
        time: formatIst(row.attemptedAt),
        username: row.username || "—",
        ipAddress: row.ipAddress || "—",
        status: row.success ? "Success" : "Failed",
        success: row.success,
      })),
    [props.rows, formatIst]
  );

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorFn: (row) => (row.attemptedAtRaw ? new Date(row.attemptedAtRaw) : null),
        id: "time",
        header: "Time",
        size: 180,
        enableColumnFilterModes: false,
        filterFn: "greaterThan",
        filterVariant: "date",
        enableGlobalFilter: false,
        Cell: ({ cell, row }) => (
          <Typography
            variant="body2"
            color={cell.getValue<Date | null>() ? "text.primary" : "text.disabled"}
          >
            {cell.getValue<Date | null>() ? row.original.time : "—"}
          </Typography>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        size: 160,
        enableColumnFilterModes: true,
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{ fontWeight: row.original.username !== "—" ? 500 : 400 }}
            color={row.original.username === "—" ? "text.disabled" : "text.primary"}
          >
            {row.original.username}
          </Typography>
        ),
      },
      {
        accessorKey: "ipAddress",
        header: "IP Address",
        size: 145,
        enableColumnFilterModes: false,
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
            color={row.original.ipAddress === "—" ? "text.disabled" : "text.primary"}
          >
            {row.original.ipAddress}
          </Typography>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => (row.success ? "true" : "false"),
        header: "Status",
        size: 120,
        enableColumnFilterModes: false,
        filterVariant: "checkbox",
        Cell: ({ row }) => (
          <Tooltip title={row.original.success ? "Login succeeded" : "Login failed"} arrow>
            <Chip
              label={row.original.status}
              size="small"
              color={row.original.success ? "success" : "error"}
              variant={row.original.success ? "filled" : "outlined"}
              icon={row.original.success
                ? <CheckCircleIcon fontSize="small" aria-hidden="true" />
                : <ErrorIcon fontSize="small" aria-hidden="true" />
              }
              sx={{ fontWeight: 500, fontSize: "0.7rem" }}
            />
          </Tooltip>
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
      }}
      renderTopToolbarCustomActions={({ table }) => (
        <ExportToolbar
          table={table}
          busy={props.busy}
          csvConfig={csvConfig}
          getCsvRows={(rows) =>
            rows.map((r) => ({
              time: r.time,
              username: r.username,
              ipAddress: r.ipAddress,
              status: r.status,
            }))
          }
          pdfFilename="login-activity-export.pdf"
          pdfHeaders={["Time", "Username", "IP Address", "Status"]}
          getPdfBody={(rows) =>
            rows.map((r) => [r.time, r.username, r.ipAddress, r.status])
          }
        />
      )}
      muiTablePaperProps={MUI_TABLE_PAPER_PROPS}
      muiTableContainerProps={MUI_TABLE_CONTAINER_PROPS}
      muiTableBodyProps={MUI_TABLE_BODY_PROPS}
      muiTableHeadCellProps={MUI_TABLE_HEAD_CELL_PROPS}
      muiTableBodyCellProps={MUI_TABLE_BODY_CELL_PROPS}
      initialState={{
        pagination: { pageIndex: 0, pageSize: 10 },
        showColumnFilters: false,
        showGlobalFilter: false,
        columnVisibility: isDesktop ? {} : { ipAddress: false },
      }}
      muiPaginationProps={{ rowsPerPageOptions: [...MUI_TABLE_PAGINATION_PROPS_BASE] }}
      renderBottomToolbarCustomActions={({ table }) => (
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{ position: "absolute", width: 1, height: 1, p: 0, m: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
        >
          {`${table.getFilteredRowModel().rows.length} login records`}
        </Box>
      )}
      renderEmptyRowsFallback={() => (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No login activity found. Try adjusting or clearing your filters.
          </Typography>
        </Box>
      )}
    />
  );
}
