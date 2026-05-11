import { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createTheme } from "@mui/material/styles";
import App from "./app/App";

export default function RootApp() {
  const mediaQuery = "(prefers-color-scheme: dark)";
  const [mode, setMode] = useState<"light" | "dark">(
    window.matchMedia(mediaQuery).matches ? "dark" : "light"
  );

  useEffect(() => {
    const mql = window.matchMedia(mediaQuery);
    const onChange = (event: MediaQueryListEvent) => {
      setMode(event.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#1d4ed8" },
          secondary: { main: "#0891b2" },
        },
        shape: {
          borderRadius: 10,
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          button: {
            textTransform: "none",
            fontWeight: 500,
          },
          h5: { fontWeight: 700 },
          h6: { fontWeight: 600 },
          subtitle1: { fontWeight: 600 },
          subtitle2: { fontWeight: 600 },
        },
      }),
    [mode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
