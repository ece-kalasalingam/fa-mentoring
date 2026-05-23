import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep diagnostics in console while presenting a user-safe fallback UI.
    console.error("Unhandled application error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          component="main"
          sx={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            p: 3,
            bgcolor: "background.default",
            color: "text.primary",
          }}
        >
          <Paper
            elevation={4}
            sx={{
              maxWidth: "520px",
              width: "100%",
              textAlign: "center",
              borderRadius: 2.5,
              p: 3,
              border: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="h5" sx={{ mb: 1.5 }}>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
              An unexpected error occurred. Please refresh the page and try
              again.
            </Typography>
            <Button variant="contained" color="primary" onClick={this.handleReload}>
              Reload Page
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
