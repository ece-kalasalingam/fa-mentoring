import { useMemo } from "react";
import { Box, Button } from "@mui/material";
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
  time: string;
  username: string;
  ipAddress: string;
  status: string;
};

export default function FailedLoginsTable(props: Props) {
  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "failed-logins-export",
      }),
    []
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      props.rows.map((row) => ({
        id: `${row.attemptRef}-${row.attemptedAt}`,
        time: props.formatIst(row.attemptedAt),
        username: row.username || "—",
        ipAddress: row.ipAddress || "—",
        status: row.success ? "Success" : "Failed",
      })),
    [props.rows, props.formatIst]
  );

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      { accessorKey: "time", header: "Time" },
      { accessorKey: "username", header: "Username" },
      { accessorKey: "ipAddress", header: "IP Address" },
      { accessorKey: "status", header: "Status" },
    ],
    []
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={tableRows}
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
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfIcon fontSize="small" />}
            onClick={() => {
              const hasSelectedRows = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
              const rows = hasSelectedRows ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
              const body = rows.map((row) => [row.original.time, row.original.username, row.original.ipAddress, row.original.status]);
              const doc = new jsPDF({ orientation: "landscape" });
              autoTable(doc, {
                head: [["Time", "Username", "IP Address", "Status"]],
                body,
              });
              doc.save("failed-logins-export.pdf");
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
        rowsPerPageOptions: [10, 25, 50, { label: "All", value: tableRows.length || 10 }],
      }}
      renderEmptyRowsFallback={() => "No login activity matches current filters."}
    />
  );
}
