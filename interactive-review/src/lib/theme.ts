export const THEME_STORAGE_KEY = "interactive-review:theme-mode";

export const themeModeLabels = {
  auto: "自动（UTC+8 20:00-06:00）",
  light: "日间模式",
  dark: "夜间模式",
} as const;

export type ThemeMode = keyof typeof themeModeLabels;
export type ResolvedTheme = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

export function resolveUtc8Theme(now = new Date()): ResolvedTheme {
  const utc8Hour = (now.getUTCHours() + 8) % 24;
  return utc8Hour >= 20 || utc8Hour < 6 ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode, now = new Date()): ResolvedTheme {
  if (mode === "auto") return resolveUtc8Theme(now);
  return mode;
}
