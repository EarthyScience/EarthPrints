"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyTheme,
  getInitialTheme,
  getSystemTheme,
  storeTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  isLight: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const onSystemChange = () => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      setTheme(getSystemTheme());
    };

    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      storeTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, isLight: theme === "light", toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Pins a theme for one subtree, without touching the document class or storage
 * the way {@link ThemeProvider} does. The PDF export stage renders under this so
 * its plots come out light-on-white whatever theme the app is showing.
 */
export function FixedThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ theme, isLight: theme === "light", toggleTheme: () => {} }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
