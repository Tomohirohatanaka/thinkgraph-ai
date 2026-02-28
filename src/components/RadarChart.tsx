"use client";

interface Scores {
  knowledge_fidelity: number;
  structural_integrity: number;
  hypothesis_generation: number;
  thinking_depth: number;
  total_score: number;
}

export default function RadarChart({ scores }: { scores: Scores }) {
  const axes = [
    { key: "knowledge_fidelity", label: "概念理解度" },
    { key: "structural_integrity", label: "構造整合度" },
    { key: "hypothesis_generation", label: "仮説生成力" },
    { key: "thinking_depth", label: "思考深度" },
  ] as const;

  const cx = 140, cy = 140, r = 100;
  const n = axes.length;
  const toXY = (i: number, val: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (val / 100) * r;
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  };
  const toGrid = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = frac * r;
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  };

  const dataPoints = axes.map((a, i) => toXY(i, scores[a.key]));
  const polyPoints = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 280 280" style={{ width: "100%", maxHeight: 280 }}>
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map(frac => (
        <polygon key={frac}
          points={Array.from({ length: n }, (_, i) => { const p = toGrid(i, frac); return `${p.x},${p.y}`; }).join(" ")}
          fill="none" stroke="rgba(42,42,63,0.8)" strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const end = toGrid(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(42,42,63,0.8)" strokeWidth="1" />;
      })}

      {/* Data polygon */}
      <polygon points={polyPoints} fill="rgba(91,91,248,0.15)" stroke="#5b5bf8" strokeWidth="2" strokeLinejoin="round" />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#5b5bf8" />
      ))}

      {/* Labels */}
      {axes.map((a, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = cx + (r + 22) * Math.cos(angle);
        const ly = cy + (r + 22) * Math.sin(angle);
        const anchor = Math.abs(lx - cx) < 5 ? "middle" : lx < cx ? "end" : "start";
        return (
          <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
            style={{ fontSize: "10px", fill: "#94a3b8", fontFamily: "'DM Sans', sans-serif" }}>
            {a.label}
          </text>
        );
      })}

      {/* Score labels on dots */}
      {dataPoints.map((p, i) => (
        <text key={i} x={p.x} y={p.y - 10} textAnchor="middle"
          style={{ fontSize: "9px", fill: "#a78bfa", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
          {scores[axes[i].key]}
        </text>
      ))}
    </svg>
  );
}
