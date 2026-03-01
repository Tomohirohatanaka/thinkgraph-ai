/**
 * teachAI Design Tokens
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for all visual design decisions.
 * Supports light/dark themes and responsive breakpoints.
 *
 * Design Philosophy (Senior Designer perspective):
 *   - "Learning should feel like discovery, not homework"
 *   - Warm, approachable palette with confident accents
 *   - Generous whitespace, fluid animations
 *   - Character-driven emotional design
 */

export const COLORS = {
  // Brand
  primary: "#0A2342",
  primaryLight: "#1A3A5C",
  primaryDark: "#061A30",
  accent: "#FF6B9D",
  accentLight: "#FF8DB5",
  accentDark: "#E84D7F",
  teal: "#1A6B72",
  tealLight: "#2A8B94",
  green: "#00C9A7",
  greenLight: "#33D4B9",

  // Semantic
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Grades
  gradeS: "#7C3AED",
  gradeA: "#10B981",
  gradeB: "#1A6B72",
  gradeC: "#F59E0B",
  gradeD: "#EF4444",
  gradeF: "#6B7280",

  // Neutrals
  white: "#FFFFFF",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  gray900: "#0F172A",
  black: "#000000",
} as const;

export const DARK_COLORS = {
  ...COLORS,
  primary: "#1E3A5F",
  primaryLight: "#2A4A72",
  gray50: "#0F172A",
  gray100: "#1E293B",
  gray200: "#334155",
  gray300: "#475569",
  gray400: "#64748B",
  gray500: "#94A3B8",
  gray600: "#CBD5E1",
  gray700: "#E2E8F0",
  gray800: "#F1F5F9",
  gray900: "#F8FAFC",
  white: "#0F172A",
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  "2xl": 28,
  full: 9999,
} as const;

export const FONT = {
  family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  familyMono: "'JetBrains Mono', 'Fira Code', monospace",
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    "2xl": 28,
    "3xl": 36,
    "4xl": 48,
  },
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const SHADOW = {
  sm: "0 1px 4px rgba(0,0,0,0.06)",
  md: "0 2px 12px rgba(0,0,0,0.08)",
  lg: "0 8px 24px rgba(0,0,0,0.12)",
  xl: "0 12px 40px rgba(0,0,0,0.16)",
  inner: "inset 0 2px 4px rgba(0,0,0,0.06)",
  glow: (color: string) => `0 0 20px ${color}33`,
} as const;

export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const ANIMATION = {
  duration: {
    fast: "150ms",
    normal: "250ms",
    slow: "400ms",
    xslow: "600ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
} as const;

export const GRADE_THEME: Record<string, { color: string; bg: string; label: string }> = {
  S: { color: COLORS.gradeS, bg: "#EDE9FE", label: "Master" },
  A: { color: COLORS.gradeA, bg: "#D1FAE5", label: "Excellent" },
  B: { color: COLORS.gradeB, bg: "#CCFBF1", label: "Good" },
  C: { color: COLORS.gradeC, bg: "#FEF3C7", label: "Fair" },
  D: { color: COLORS.gradeD, bg: "#FEE2E2", label: "Needs Work" },
  F: { color: COLORS.gradeF, bg: "#F3F4F6", label: "Try Again" },
};

export const MODE_THEME: Record<string, { emoji: string; label: string; color: string; description: string }> = {
  whynot: { emoji: "🔍", label: "なぜ分析", color: COLORS.accent, description: "原因と理由を深掘り" },
  vocabulary: { emoji: "📖", label: "語彙", color: COLORS.info, description: "専門用語の定義と例" },
  concept: { emoji: "🧠", label: "概念", color: COLORS.teal, description: "概念の構造と関係" },
  procedure: { emoji: "📋", label: "手順", color: COLORS.green, description: "プロセスと順序" },
};

// CSS-in-JS helper: generates CSS custom properties for theme switching
export function generateCSSVariables(isDark = false): string {
  const colors = isDark ? DARK_COLORS : COLORS;
  const vars = Object.entries(colors)
    .map(([key, value]) => `  --color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
    .join("\n");

  return `:root {\n${vars}\n  --font-family: ${FONT.family};\n  --shadow-sm: ${SHADOW.sm};\n  --shadow-md: ${SHADOW.md};\n  --shadow-lg: ${SHADOW.lg};\n  --radius-sm: ${RADIUS.sm}px;\n  --radius-md: ${RADIUS.md}px;\n  --radius-lg: ${RADIUS.lg}px;\n}`;
}
