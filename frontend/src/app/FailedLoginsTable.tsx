import { useMemo } from "react";
import { Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, mkConfig } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  formatIst: (value: string | null | undefined) => string;
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
        time: props.formatIst(row.attemptedAt),
        username: row.username || "—",
        ipAddress: row.ipAddress || "—",
        status: row.success ? "Success" : "Failed",
        success: row.success,
      })),
    [props.rows, props.formatIst]
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
        size: 110,
        enableColumnFilterModes: false,
        filterVariant: "checkbox",
        Cell: ({ row }) => (
          <Chip
            label={row.original.status}
            size="small"
            color={row.original.success ? "success" : "error"}
            variant={row.original.success ? "filled" : "outlined"}
            sx={{ fontWeight: 500, fontSize: "0.7rem" }}
          />
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
                    time: row.original.time,
                    username: row.original.username,
                    ipAddress: row.original.ipAddress,
                    status: row.original.status,
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
                    row.original.time,
                    row.original.username,
                    row.original.ipAddress,
                    row.original.status,
                  ]);
                  const doc = new jsPDF({ orientation: "landscape" });
                  autoTable(doc, {
                    head: [["Time", "Username", "IP Address", "Status"]],
                    body,
                  });
                  doc.save("login-activity-export.pdf");
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
            No login activity matches current filters.
          </Typography>
        </Box>
      )}
    />
  );
}
