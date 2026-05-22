import { Box, Button, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { download, generateCsv, type ConfigOptions } from "export-to-csv";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type TableLike<T> = {
  getIsSomeRowsSelected: () => boolean;
  getIsAllRowsSelected: () => boolean;
  getSelectedRowModel: () => { rows: Array<{ original: T }> };
  getPrePaginationRowModel: () => { rows: Array<{ original: T }> };
};

type Props<T> = {
  table: TableLike<T>;
  busy: boolean;
  csvConfig: ConfigOptions;
  getCsvRows: (originals: T[]) => Array<Record<string, string | number | boolean | null | undefined>>;
  pdfFilename: string;
  pdfHeaders: string[];
  getPdfBody: (originals: T[]) => string[][];
  /** Extra action buttons rendered before export actions */
  children?: React.ReactNode;
};

export default function ExportToolbar<T>({
  table,
  busy,
  csvConfig,
  getCsvRows,
  pdfFilename,
  pdfHeaders,
  getPdfBody,
  children,
}: Props<T>) {
  const getOriginals = (): T[] => {
    const hasSel = table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();
    const rows = hasSel ? table.getSelectedRowModel().rows : table.getPrePaginationRowModel().rows;
    return rows.map((r) => r.original);
  };

  const isEmpty = table.getPrePaginationRowModel().rows.length === 0;

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {children}

      <Tooltip title="Export visible or selected rows to CSV" arrow>
        <span>
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon fontSize="small" />}
            disabled={busy || isEmpty}
            onClick={() => {
              const csv = generateCsv(csvConfig)(getCsvRows(getOriginals()));
              download(csvConfig)(csv);
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
            disabled={busy || isEmpty}
            onClick={() => {
              const doc = new jsPDF({ orientation: "landscape" });
              autoTable(doc, { head: [pdfHeaders], body: getPdfBody(getOriginals()) });
              doc.save(pdfFilename);
            }}
          >
            Export PDF
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
