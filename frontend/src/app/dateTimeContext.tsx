/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type DateTimeContextValue = {
  formatIst: (value: string | null | undefined) => string;
};

const DateTimeContext = createContext<DateTimeContextValue>({
  formatIst: (v) => v ?? "",
});

export function DateTimeProvider({
  children,
  formatIst,
}: {
  children: ReactNode;
  formatIst: (value: string | null | undefined) => string;
}) {
  return (
    <DateTimeContext.Provider value={{ formatIst }}>
      {children}
    </DateTimeContext.Provider>
  );
}

export function useDateTimeContext() {
  return useContext(DateTimeContext);
}
