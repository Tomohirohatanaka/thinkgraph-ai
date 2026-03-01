/**
 * teachAI Accessible Button Component
 * ─────────────────────────────────────────────────────────────
 * WCAG 2.1 AA compliant button with proper focus management,
 * keyboard navigation, and screen reader support.
 */
"use client";

import { type CSSProperties, type ReactNode, forwardRef, useState } from "react";
import { COLORS, RADIUS, FONT, SHADOW, ANIMATION } from "@/lib/design/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; color: string; border: string; hoverBg: string }> = {
  primary: { bg: COLORS.primary, color: "#fff", border: "none", hoverBg: COLORS.primaryLight },
  secondary: { bg: "transparent", color: COLORS.primary, border: `1.5px solid ${COLORS.gray200}`, hoverBg: COLORS.gray50 },
  ghost: { bg: "transparent", color: COLORS.gray600, border: "none", hoverBg: COLORS.gray100 },
  danger: { bg: COLORS.error, color: "#fff", border: "none", hoverBg: "#DC2626" },
  accent: { bg: COLORS.accent, color: "#fff", border: "none", hoverBg: COLORS.accentDark },
};

const SIZE_STYLES: Record<ButtonSize, { padding: string; fontSize: number; height: number; radius: number }> = {
  sm: { padding: "6px 14px", fontSize: 13, height: 32, radius: RADIUS.sm },
  md: { padding: "8px 20px", fontSize: 14, height: 40, radius: RADIUS.md },
  lg: { padding: "12px 28px", fontSize: 16, height: 48, radius: RADIUS.lg },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    fullWidth = false,
    icon,
    iconRight,
    onClick,
    type = "button",
    ariaLabel,
    style: customStyle,
  },
  ref
) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: s.padding,
    height: s.height,
    fontSize: s.fontSize,
    fontWeight: 600,
    fontFamily: FONT.family,
    borderRadius: s.radius,
    border: v.border,
    background: isDisabled ? COLORS.gray200 : isHovered ? v.hoverBg : v.bg,
    color: isDisabled ? COLORS.gray400 : v.color,
    cursor: isDisabled ? "not-allowed" : "pointer",
    transition: `all ${ANIMATION.duration.fast} ${ANIMATION.easing.default}`,
    outline: "none",
    boxShadow: isFocusVisible ? `0 0 0 3px ${COLORS.accent}44` : variant === "primary" ? SHADOW.sm : "none",
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    position: "relative",
    overflow: "hidden",
    ...customStyle,
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={isDisabled}
      style={baseStyle}
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setIsFocusVisible(true);
      }}
      onBlur={() => setIsFocusVisible(false)}
    >
      {loading ? (
        <span
          style={{
            width: 16,
            height: 16,
            border: `2px solid ${v.color}44`,
            borderTopColor: v.color,
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      ) : (
        icon
      )}
      {children}
      {iconRight && !loading && iconRight}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
});
