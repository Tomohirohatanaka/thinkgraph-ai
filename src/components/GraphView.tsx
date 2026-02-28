"use client";

import { useEffect, useRef } from "react";

interface LogicNode { id: string; label: string; node_type: string; depth: number; }
interface LogicEdge { source: string; target: string; relation: string; }
interface LogicGraph { nodes: LogicNode[]; edges: LogicEdge[]; }

const NODE_COLORS: Record<string, string> = {
  problem: "#ef4444",
  cause: "#f97316",
  factor: "#eab308",
  solution: "#22c55e",
  concept: "#5b5bf8",
};

interface Props { graph: LogicGraph; highlight: string[]; }

export default function GraphView({ graph, highlight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!graph.nodes.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Build adjacency & assign positions
    const nodes = graph.nodes;
    const edges = graph.edges;

    // Group by depth
    const depths: Record<number, string[]> = {};
    for (const n of nodes) {
      const d = n.depth ?? 0;
      if (!depths[d]) depths[d] = [];
      depths[d].push(n.id);
    }
    const maxDepth = Math.max(...Object.keys(depths).map(Number));
    const pos: Record<string, { x: number; y: number }> = {};
    for (const [dStr, ids] of Object.entries(depths)) {
      const d = Number(dStr);
      const x = 50 + (w - 100) * (d / (maxDepth || 1));
      ids.forEach((id, i) => {
        const y = 40 + (h - 80) * ((i + 1) / (ids.length + 1));
        pos[id] = { x, y };
      });
    }

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw edges
    for (const e of edges) {
      const s = pos[e.source];
      const t = pos[e.target];
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = "rgba(100,116,139,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const aLen = 8;
      ctx.beginPath();
      ctx.moveTo(t.x - 14 * Math.cos(angle), t.y - 14 * Math.sin(angle));
      ctx.lineTo(t.x - 14 * Math.cos(angle) + aLen * Math.cos(angle - 2.4), t.y - 14 * Math.sin(angle) + aLen * Math.sin(angle - 2.4));
      ctx.moveTo(t.x - 14 * Math.cos(angle), t.y - 14 * Math.sin(angle));
      ctx.lineTo(t.x - 14 * Math.cos(angle) + aLen * Math.cos(angle + 2.4), t.y - 14 * Math.sin(angle) + aLen * Math.sin(angle + 2.4));
      ctx.strokeStyle = "rgba(100,116,139,0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      const p = pos[n.id];
      if (!p) continue;
      const isHighlight = highlight.includes(n.id);
      const color = isHighlight ? "#34d399" : (NODE_COLORS[n.node_type] || "#5b5bf8");
      const r = isHighlight ? 14 : 11;

      // Node circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color + "33";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (isHighlight) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = color + "44";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.font = `${isHighlight ? 600 : 400} 10px 'DM Sans', sans-serif`;
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = n.label.length > 8 ? n.label.slice(0, 8) + "…" : n.label;
      ctx.fillText(label, p.x, p.y + r + 3);
    }
  }, [graph, highlight]);

  return (
    <div style={{ position: "relative", width: "100%", height: 280, background: "rgba(17,17,24,0.6)", borderRadius: 8, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {/* Legend */}
      <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.6rem", color: "#64748b" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
