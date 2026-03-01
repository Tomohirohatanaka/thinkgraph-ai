/**
 * teachAI Animation Library
 * ─────────────────────────────────────────────────────────────
 * CSS keyframe definitions and animation utilities.
 * Designed for delightful micro-interactions that reinforce
 * the learning experience without being distracting.
 */

export const KEYFRAMES = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeSlideInLeft {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeSlideInRight {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes ripple {
  0% { transform: scale(0); opacity: 0.5; }
  100% { transform: scale(4); opacity: 0; }
}

@keyframes confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-200px) rotate(720deg); opacity: 0; }
}

@keyframes scoreReveal {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes progressFill {
  from { width: 0%; }
}

@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}
`;

export type AnimationName =
  | "fadeIn" | "fadeSlideIn" | "fadeSlideInLeft" | "fadeSlideInRight"
  | "scaleIn" | "bounceIn" | "pulse" | "shimmer"
  | "slideUp" | "float" | "gradientShift" | "blink"
  | "ripple" | "confetti" | "scoreReveal" | "progressFill"
  | "typewriter" | "shake";

export function animate(
  name: AnimationName,
  duration = "0.3s",
  easing = "cubic-bezier(0.4, 0, 0.2, 1)",
  delay = "0s",
  fillMode: "forwards" | "backwards" | "both" | "none" = "both"
): string {
  return `${name} ${duration} ${easing} ${delay} ${fillMode}`;
}

export function staggerDelay(index: number, baseDelay = 50): string {
  return `${index * baseDelay}ms`;
}
