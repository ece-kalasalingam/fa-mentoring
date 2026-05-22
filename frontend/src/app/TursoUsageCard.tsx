import { Alert, Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import type { AdminDashboard } from "./types";
import { formatTursoValue, getTursoProgressColor, getTursoUsageMetrics, isTursoUsageAvailable } from "./tursoUsage";

type TursoUsageCardProps = {
  system: AdminDashboard["system"];
};

export function TursoUsageCard({ system }: TursoUsageCardProps) {
  const usageAvailable = isTursoUsageAvailable(system);
  const usageMetrics = getTursoUsageMetrics(system);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
        <StorageIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.65rem", letterSpacing: 1.2 }}>
          Turso DB · Billing Cycle Usage
        </Typography>
      </Stack>
      {usageAvailable ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2 }}>
          {usageMetrics.map(({ label, value, max, isBytes }, idx) => {
            const pct = Math.min(100, (value / max) * 100);
            const barColor = getTursoProgressColor(pct);
            return (
              <Box key={`${label}-${idx}`} sx={{ textAlign: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: `${barColor}.main`, lineHeight: 1.2 }}>
                  {pct.toFixed(1)}%
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mt: 0.25 }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.75 }}>
                  {formatTursoValue(value, isBytes)} / {formatTursoValue(max, isBytes)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  color={barColor}
                  sx={{ height: 5, borderRadius: 1 }}
                  aria-label={`${label}: ${pct.toFixed(1)}% of quota used`}
                />
              </Box>
            );
          })}
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 0 }}>
          Turso usage metrics are currently unavailable.
          {system?.tursoDebug?.reason ? ` Reason: ${system.tursoDebug.reason}.` : ""}
          {typeof system?.tursoDebug?.httpStatus === "number" ? ` HTTP: ${system.tursoDebug.httpStatus}.` : ""}
          {system?.tursoDebug?.tokenFingerprint ? ` Token: ${system.tursoDebug.tokenFingerprint}.` : ""}
          {system?.tursoDebug?.cloudfrontPop ? ` POP: ${system.tursoDebug.cloudfrontPop}.` : ""}
          {system?.tursoDebug?.cloudfrontRequestId ? ` CF-ID: ${system.tursoDebug.cloudfrontRequestId}.` : ""}
          {system?.tursoDebug?.responseSnippet ? ` Response: ${system.tursoDebug.responseSnippet}` : ""}
        </Alert>
      )}
    </Paper>
  );
}
