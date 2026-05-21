import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { mkConfig } from "export-to-csv";
import ExportToolbar from "./ExportToolbar";
import { formatIst } from "./dateTime";
import {
  formatCredits,
  MUI_TABLE_BODY_PROPS,
  MUI_TABLE_CONTAINER_PROPS,
  MUI_TABLE_HEAD_CELL_PROPS,
  MUI_TABLE_PAGINATION_PROPS_BASE,
} from "./utils";
import type { FacultyCreditTableRow } from "./types";

type Props = {
  rows: FacultyCreditTableRow[];
  busy: boolean;
};

export default function FacultyCreditDetailsTable(props: Props) {
  const csvConfig = useMemo(
    () =>
      mkConfig({
        fieldSeparator: ",",
        decimalSeparator: ".",
        useKeysAsHeaders: true,
        filename: "faculty-student-credit-table",
      }),
    [],
  );

  const columns = useMemo<MRT_ColumnDef<FacultyCreditTableRow>[]>(
    () => [
      {
        accessorKey: "registrationNumber",
        header: "Reg. No",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => {
          const value = String(cell.getValue<string | null>() ?? "").trim();
          return value
            ? <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{value}</Typography>
            : <Typography variant="body2" color="text.disabled">—</Typography>;
        },
      },
      {
        accessorKey: "categoryId",
        header: "Category ID",
        enableColumnFilterModes: false,
      },
      {
        accessorFn: (row) => row.graduated === "Yes",
        id: "graduated",
        header: "Graduated",
        filterVariant: "checkbox",
        enableColumnFilterModes: false,
        Cell: ({ row }) => <Typography variant="body2">{row.original.graduated}</Typography>,
      },
      {
        accessorKey: "semester",
        header: "Semester",
        enableColumnFilterModes: false,
      },
      {
        accessorKey: "credits",
        header: "Credits",
        enableColumnFilterModes: false,
        Cell: ({ cell }) => <Typography variant="body2">{formatCredits(Number(cell.getValue<number>() ?? 0))}</Typography>,
      },
      {
        accessorKey: "modifiedByUsername",
        header: "Modified By Username",
        enableColumnFilterModes: true,
        Cell: ({ cell }) => {
          const value = String(cell.getValue<string | null>() ?? "").trim();
          return value
            ? <Typography variant="body2">{value}</Typography>
            : <Typography variant="body2" color="text.disabled">—</Typography>;
        },
      },
      {
        accessorFn: (row) => (row.modifiedAt ? new Date(row.modifiedAt) : null),
        id: "modifiedAt",
        header: "Modified Time (IST)",
        filterVariant: "date",
        filterFn: "greaterThan",
        enableGlobalFilter: false,
        enableColumnFilterModes: false,
        Cell: ({ row }) => <Typography variant="body2">{formatIst(row.original.modifiedAt)}</Typography>,
      },
    ],
    [],
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={props.rows}
      layoutMode="grid"
      enableRowSelection
      enableRowNumbers
      rowNumberDisplayMode="static"
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableColumnResizing={false}
      enableHiding
      enableColumnActions
      enableColumnFilters
      enableGlobalFilter
      enablePagination
      displayColumnDefOptions={{
        "mrt-row-numbers": { size: 48, header: "#" },
        "mrt-row-select": { size: 48 },
      }}
      state={{
        isLoading: props.busy,
        showSkeletons: props.busy && props.rows.length === 0,
      }}
      initialState={{
        pagination: { pageIndex: 0, pageSize: 10 },
        showColumnFilters: false,
        showGlobalFilter: false,
      }}
      renderTopToolbarCustomActions={({ table }) => (
        <ExportToolbar
          table={table}
          busy={props.busy}
          csvConfig={csvConfig}
          getCsvRows={(rows) =>
            rows.map((row) => ({
              registrationNumber: row.registrationNumber ?? "",
              categoryId: row.categoryId,
              graduated: row.graduated,
              semester: row.semester,
              credits: formatCredits(row.credits),
              modifiedByUsername: row.modifiedByUsername ?? "",
              modifiedTimeIst: formatIst(row.modifiedAt),
            }))
          }
          pdfFilename="faculty-student-credit-table.pdf"
          pdfHeaders={["Reg. No", "Category ID", "Graduated", "Semester", "Credits", "Modified By Username", "Modified Time (IST)"]}
          getPdfBody={(rows) =>
            rows.map((row) => [
              row.registrationNumber ?? "",
              row.categoryId,
              row.graduated,
              String(row.semester),
              formatCredits(row.credits),
              row.modifiedByUsername ?? "",
              formatIst(row.modifiedAt),
            ])
          }
        />
      )}
      muiTablePaperProps={{
        elevation: 0,
        sx: { border: "none", borderRadius: 2 },
      }}
      muiTableContainerProps={MUI_TABLE_CONTAINER_PROPS}
      muiTableBodyProps={MUI_TABLE_BODY_PROPS}
      muiTableHeadCellProps={MUI_TABLE_HEAD_CELL_PROPS}
      muiPaginationProps={({ table }) => ({
        rowsPerPageOptions: [...MUI_TABLE_PAGINATION_PROPS_BASE, { label: "All", value: Math.max(1, table.getRowCount()) }],
      })}
      renderEmptyRowsFallback={() => (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No credit rows found for your mentored students.
          </Typography>
        </Box>
      )}
    />
  );
}
