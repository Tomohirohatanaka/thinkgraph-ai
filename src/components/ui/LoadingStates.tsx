/**
 * teachAI Loading State Components
 * ─────────────────────────────────────────────────────────────
 * Beautiful, branded loading indicators for every context.
 * Designed to maintain user engagement during wait times.
 */
"use client";

import { COLORS, RADIUS, FONT, SHADOW } from "@/lib/design/tokens";
import { KEYFRAMES } from "@/lib/design/animations";

// ─── Skeleton Loader ────────────────────────────────────────

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = RADIUS.sm,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        aria-hidden="true"
        style={{
          width,
          height,
          borderRadius,
          background: `linear-gradient(90deg, ${COLORS.gray100} 25%, ${COLORS.gray200} 50%, ${COLORS.gray100} 75%)`,
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s ease-in-out infinite",
        }}
      />
    </>
  );
}

// ─── Character Thinking Indicator ───────────────────────────

export function CharacterThinking({
  characterEmoji = "👧",
  characterName = "ミオ",
  message,
}: {
  characterEmoji?: string;
  characterName?: string;
  message?: string;
}) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="status"
        aria-label={`${characterName}が考え中`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: COLORS.gray50,
          borderRadius: RADIUS.lg,
          fontFamily: FONT.family,
          animation: "fadeSlideIn 0.3s ease-out",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `${COLORS.accent}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            animation: "float 2s ease-in-out infinite",
          }}
        >
          {characterEmoji}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.gray700, marginBottom: 4 }}>
            {message || `${characterName}が考え中...`}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.accent,
                  animation: `pulse 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Full Page Loading ──────────────────────────────────────

export function PageLoading({ message = "読み込み中..." }: { message?: string }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="status"
        aria-label={message}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 24,
          fontFamily: FONT.family,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.teal})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "pulse 2s ease-in-out infinite",
            boxShadow: SHADOW.lg,
          }}
        >
          <span style={{ fontSize: 28, color: "#fff", fontWeight: 800 }}>t</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.gray700 }}>{message}</div>
          <div style={{ fontSize: 13, color: COLORS.gray400, marginTop: 4 }}>
            teach<span style={{ color: COLORS.accent, fontWeight: 700 }}>AI</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Score Reveal Animation ─────────────────────────────────

export function ScoreReveal({
  grade,
  score,
  onComplete,
}: {
  grade: string;
  score: number;
  onComplete?: () => void;
}) {
  const gradeColors: Record<string, { bg: string; text: string }> = {
    S: { bg: "#EDE9FE", text: COLORS.gradeS },
    A: { bg: "#D1FAE5", text: COLORS.gradeA },
    B: { bg: "#CCFBF1", text: COLORS.gradeB },
    C: { bg: "#FEF3C7", text: COLORS.gradeC },
    D: { bg: "#FEE2E2", text: COLORS.gradeD },
    F: { bg: "#F3F4F6", text: COLORS.gradeF },
  };

  const colors = gradeColors[grade] || gradeColors.C;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="status"
        aria-label={`評価: ${grade}, スコア: ${score}点`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: 32,
          animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onAnimationEnd={onComplete}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: colors.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "scoreReveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: `0 8px 32px ${colors.text}33`,
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 900, color: colors.text }}>{grade}</span>
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: COLORS.primary,
            animation: "fadeSlideIn 0.5s ease-out 0.3s both",
          }}
        >
          {score}<span style={{ fontSize: 16, color: COLORS.gray400, marginLeft: 4 }}>pt</span>
        </div>
      </div>
    </>
  );
}

// ─── Progress Bar ───────────────────────────────────────────

export function ProgressBar({
  current,
  total,
  label,
  color = COLORS.teal,
  showLabel = true,
}: {
  current: number;
  total: number;
  label?: string;
  color?: string;
  showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label || `進捗 ${current}/${total}`}
      >
        {showLabel && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.gray500, fontFamily: FONT.family }}>
              {label || "進捗"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray700, fontFamily: FONT.family }}>
              {current}/{total}
            </span>
          </div>
        )}
        <div
          style={{
            width: "100%",
            height: 8,
            borderRadius: 4,
            background: COLORS.gray100,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 4,
              background: `linear-gradient(90deg, ${color}, ${color}CC)`,
              transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              animation: "progressFill 0.8s ease-out",
            }}
          />
        </div>
      </div>
    </>
  );
}
