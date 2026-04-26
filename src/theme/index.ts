import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import React from 'react';

// ─── Theme System ───
export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  bg: string; bgSub: string; card: string; cardHover: string; elevated: string; input: string;
  teal: string; tealMuted: string; tealDeep: string; tealGlow: string; tealBorder: string;
  amber: string; red: string; green: string;
  text: string; textSec: string; textDim: string; border: string; white: string;
  sidebarBg: string; headerBg: string; chatBubbleSophia: string; chatBubbleUser: string;
  panelBg: string; inputBg: string; hoverBg: string; activeBg: string; shadowColor: string;
}

export const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: "#241F21",
    bgSub: "#2d2829",
    card: "rgba(42,37,38,0.8)",
    cardHover: "rgba(58,52,53,0.88)",
    elevated: "rgba(48,43,44,0.92)",
    input: "rgba(58,52,53,0.75)",
    teal: "#C0E689",
    tealMuted: "#8DC65E",
    tealDeep: "rgba(40,45,55,0.7)",
    tealGlow: "rgba(192,230,137,0.06)",
    tealBorder: "rgba(192,230,137,0.14)",
    amber: "#D4A34A",
    red: "#D45A5A",
    green: "#C0E689",
    text: "#FFFFFF",
    textSec: "#D4D2CE",
    textDim: "#8A8880",
    border: "rgba(255,255,255,0.06)",
    white: "#FFFFFF",
    sidebarBg: "rgba(32,28,29,0.95)",
    headerBg: "rgba(36,31,33,0.8)",
    chatBubbleSophia: "rgba(42,37,38,0.85)",
    chatBubbleUser: "rgba(192,230,137,0.1)",
    panelBg: "rgba(30,26,27,0.7)",
    inputBg: "rgba(42,37,38,0.8)",
    hoverBg: "rgba(255,255,255,0.04)",
    activeBg: "rgba(192,230,137,0.06)",
    shadowColor: "rgba(0,0,0,0.3)",
  },
  light: {
    bg: "#E3DED8",
    bgSub: "#D9D3CC",
    card: "rgba(255,255,255,0.72)",
    cardHover: "rgba(255,255,255,0.88)",
    elevated: "rgba(255,255,255,0.82)",
    input: "rgba(255,255,255,0.65)",
    teal: "#6A9B38",
    tealMuted: "#5B8A2A",
    tealDeep: "rgba(106,155,56,0.08)",
    tealGlow: "rgba(106,155,56,0.06)",
    tealBorder: "rgba(106,155,56,0.18)",
    amber: "#B8862A",
    red: "#C44A4A",
    green: "#6A9B38",
    text: "#231f20",
    textSec: "#4A4544",
    textDim: "#8A8580",
    border: "rgba(0,0,0,0.07)",
    white: "#FFFFFF",
    sidebarBg: "rgba(215,210,203,0.96)",
    headerBg: "rgba(227,222,216,0.85)",
    chatBubbleSophia: "rgba(255,255,255,0.75)",
    chatBubbleUser: "rgba(106,155,56,0.1)",
    panelBg: "rgba(255,255,255,0.55)",
    inputBg: "rgba(255,255,255,0.7)",
    hoverBg: "rgba(0,0,0,0.03)",
    activeBg: "rgba(106,155,56,0.08)",
    shadowColor: "rgba(0,0,0,0.06)",
  },
};

/**
 * Read stored theme preference from localStorage, falling back to system preference.
 */
export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('sophia-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage unavailable (SSR, privacy mode)
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // matchMedia unavailable
  }
  return 'light';
}

// Mutable color object — updated by ThemeProvider before each render
export let C: ThemeColors = { ...THEMES[getStoredTheme()] };

// ─── Context ───
const ThemeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
  mode: 'light',
  toggle: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

// ─── Provider ───
function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const colors = THEMES[mode];

  // Set CSS custom properties
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--sophia-${key}`, value);
  }

  // Toggle dark class
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-theme', mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  // Synchronous update before render (same pattern as SophiaV2 line 4478)
  Object.assign(C, THEMES[mode]);

  useEffect(() => {
    Object.assign(C, THEMES[mode]);
    applyThemeToDOM(mode);
    try {
      localStorage.setItem('sophia-theme', mode);
    } catch {
      // localStorage unavailable
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode(m => m === 'light' ? 'dark' : 'light');
  }, []);

  return React.createElement(ThemeContext.Provider, { value: { mode, toggle } }, children);
}
