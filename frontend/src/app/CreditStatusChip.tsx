import type { MouseEventHandler } from "react";
import { Chip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { CreditStatus } from "./types";
import { CREDIT_STATUS_LABELS } from "./constants";

const CHIP_SX = {
  height: 20,
  fontSize: "0.65rem",
  whiteSpace: "nowrap",
  "& .MuiChip-label": { px: 0.75 },
} as const;

type Props = {
  status: CreditStatus;
  /** When provided, appends ": N" to the label (e.g. "Complete: 3") */
  count?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

export function CreditStatusChip({ status, count, onClick }: Props) {
  const label = count !== undefined
    ? `${CREDIT_STATUS_LABELS[status]}: ${count}`
    : CREDIT_STATUS_LABELS[status];
  const sx = onClick ? { ...CHIP_SX, cursor: "pointer" } : CHIP_SX;

  switch (status) {
    case "complete":
      return (
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: "0.7rem !important" }} />}
          label={label}
          size="small"
          color="success"
          sx={sx}
          onClick={onClick}
        />
      );
    case "on-track":
      return <Chip label={label} size="small" color="success" variant="outlined" sx={sx} onClick={onClick} />;
    case "marginal":
      return <Chip label={label} size="small" color="primary" variant="outlined" sx={sx} onClick={onClick} />;
    case "alarming":
      return <Chip label={label} size="small" color="warning" variant="outlined" sx={sx} onClick={onClick} />;
    default:
      return <Chip label={label} size="small" color="error" variant="outlined" sx={sx} onClick={onClick} />;
  }
}
