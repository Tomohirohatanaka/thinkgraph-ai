"use client";

import { useEffect, useRef, useState } from "react";

interface LogicNode { id: string; label: string; node_type: string; depth: number; }
interface LogicEdge { source: string; target: string; relation: string; }
interface LogicGraph { nodes: LogicNode[]; edges: LogicEdge[]; }

const NODE_COLORS: Record<string, string> = {
  problem: "#EF4444",
  cause: "#F97316",
  factor: "#EAB308",
  solution: "#22C55E",
  concept: "#6366F1",
};

function MiniGraph({ graph, title, matchedIds, color }: {
  graph: LogicGraph;
  title: string;
  matchedIds: string[];
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!graph.nodes.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const nodes = graph.nodes;
    const edges = graph.edges;

    const depths: Record<number, string[]> = {};
    for (const n of nodes) {
      const d = n.depth ?? 0;
      if (!depths[d]) depths[d] = [];
      depths[d].push(n.id);
    }
    const maxDepth = Math.max(...Object.keys(depths).map(Number), 1);
    const pos: Record<string, { x: number; y: number }> = {};
    for (const [dStr, ids] of Object.entries(depths)) {
      const d = Number(dStr);
      const x = 24 + (w - 48) * (d / maxDepth);
      ids.forEach((id, i) => {
        const y = 24 + (h - 48) * ((i + 1) / (ids.length + 1));
        pos[id] = { x, y };
      });
    }

    ctx.clearRect(0, 0, w, h);

    // Edges
    for (const e of edges) {
      const s = pos[e.source];
      const t = pos[e.target];
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);

      // Bezier curve for smoother look
      const midX = (s.x + t.x) / 2;
      ctx.quadraticCurveTo(midX, s.y, t.x, t.y);
      ctx.strokeStyle = "rgba(148,163,184,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const p = pos[n.id];
      if (!p) continue;
      const isMatched = matchedIds.includes(n.id);
      const nodeColor = isMatched ? "#22C55E" : (NODE_COLORS[n.node_type] || "#6366F1");
      const r = isMatched ? 10 : 7;

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor + "40";
      ctx.fill();
      ctx.strokeStyle = nodeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (isMatched) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#22C55E33";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.font = `${isMatched ? "600" : "400"} 9px system-ui, sans-serif`;
      ctx.fillStyle = "#94A3B8";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = n.label.length > 6 ? n.label.slice(0, 6) + "…" : n.label;
      ctx.fillText(label, p.x, p.y + r + 2);
    }
  }, [graph, matchedIds]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color,
        marginBottom: "0.3rem", textAlign: "center",
      }}>
        {title}
      </div>
      <div style={{
        background: "rgba(15,23,42,0.6)",
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${color}30`,
      }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 160, display: "block" }}
        />
      </div>
      <div style={{
        display: "flex", justifyContent: "center", gap: "0.4rem",
        marginTop: "0.3rem", flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>
          {graph.nodes.length} 概念 · {graph.edges.length} 関係
        </span>
      </div>
    </div>
  );
}

export default function GraphComparison({
  apiKey,
  topic,
  coreText,
  turns,
  mastered,
  accentColor,
}: {
  apiKey: string;
  topic: string;
  coreText: string;
  turns: { role: "user" | "ai"; text: string }[];
  mastered: string[];
  accentColor: string;
}) {
  const [userGraph, setUserGraph] = useState<LogicGraph | null>(null);
  const [idealGraph, setIdealGraph] = useState<LogicGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [matchedConcepts, setMatchedConcepts] = useState<string[]>([]);
  const [missingConcepts, setMissingConcepts] = useState<string[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !apiKey || !turns.length) return;
    fetchedRef.current = true;
    setLoading(true);

    const fetchGraphs = async () => {
      try {
        const [userRes, idealRes] = await Promise.all([
          fetch("/api/extract-graph", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, topic, conversation: turns }),
          }),
          fetch("/api/ideal-graph", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, topic, coreText }),
          }),
        ]);

        const [userData, idealData] = await Promise.all([
          userRes.json(),
          idealRes.json(),
        ]);

        if (userData.graph) setUserGraph(userData.graph);
        if (idealData.graph) setIdealGraph(idealData.graph);

        // Calculate matched/missing concepts
        if (userData.graph && idealData.graph) {
          const userLabels = new Set(
            (userData.graph.nodes as LogicNode[]).map(n => n.label.toLowerCase())
          );
          const idealNodes = idealData.graph.nodes as LogicNode[];
          const matched: string[] = [];
          const missing: string[] = [];
          for (const n of idealNodes) {
            if (userLabels.has(n.label.toLowerCase())) {
              matched.push(n.id);
            } else {
              missing.push(n.label);
            }
          }
          setMatchedConcepts(matched);
          setMissingConcepts(missing);
        }
      } catch {
        // Silently fail - graph comparison is supplementary
      } finally {
        setLoading(false);
      }
    };

    fetchGraphs();
  }, [apiKey, topic, coreText, turns]);

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: "1rem", textAlign: "center", padding: "1.5rem" }}>
        <div style={{ fontSize: 28, marginBottom: "0.5rem" }}>🔄</div>
        <div style={{ fontSize: 13, color: "#999" }}>思考構造を分析中...</div>
        <div style={{
          width: 120, height: 3, background: "#f0f0f0", borderRadius: 2,
          margin: "0.75rem auto 0", overflow: "hidden",
        }}>
          <div style={{
            width: "40%", height: "100%", background: accentColor,
            borderRadius: 2,
            animation: "graphSlide 1.5s ease-in-out infinite",
          }} />
        </div>
        <style>{`@keyframes graphSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
      </div>
    );
  }

  if (!userGraph && !idealGraph) return null;

  const coveragePercent = idealGraph && userGraph
    ? Math.round((matchedConcepts.length / Math.max(idealGraph.nodes.length, 1)) * 100)
    : 0;

  return (
    <div className="card" style={{
      marginBottom: "1rem",
      background: "linear-gradient(135deg, #0F172A08, #1E293B06)",
      borderColor: `${accentColor}25`,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", padding: 0, marginBottom: expanded ? "0.75rem" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: 18 }}>🧩</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>思考構造の比較</div>
            <div style={{ fontSize: 11, color: "#999" }}>あなたの理解 vs 理想の構造</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            padding: "2px 10px", borderRadius: 100,
            background: coveragePercent >= 70 ? "#22C55E15" : coveragePercent >= 40 ? "#F59E0B15" : "#EF444415",
            color: coveragePercent >= 70 ? "#22C55E" : coveragePercent >= 40 ? "#F59E0B" : "#EF4444",
            fontSize: 12, fontWeight: 800,
          }}>
            {coveragePercent}% カバー
          </div>
          <span style={{
            fontSize: 14, color: "#ccc",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}>›</span>
        </div>
      </button>

      {expanded && (
        <>
          {/* Graph Comparison */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {userGraph && (
              <MiniGraph
                graph={userGraph}
                title="あなたの思考"
                matchedIds={matchedConcepts}
                color={accentColor}
              />
            )}
            {idealGraph && (
              <MiniGraph
                graph={idealGraph}
                title="理想の構造"
                matchedIds={matchedConcepts}
                color="#6366F1"
              />
            )}
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: "0.5rem", marginTop: "0.75rem",
          }}>
            <div style={{
              flex: 1, background: "#22C55E08", borderRadius: 10, padding: "0.5rem",
              textAlign: "center", border: "1px solid #22C55E15",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#22C55E" }}>
                {matchedConcepts.length}
              </div>
              <div style={{ fontSize: 10, color: "#999" }}>一致した概念</div>
            </div>
            <div style={{
              flex: 1, background: "#EF444408", borderRadius: 10, padding: "0.5rem",
              textAlign: "center", border: "1px solid #EF444415",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>
                {missingConcepts.length}
              </div>
              <div style={{ fontSize: 10, color: "#999" }}>不足した概念</div>
            </div>
            <div style={{
              flex: 1, background: `${accentColor}08`, borderRadius: 10, padding: "0.5rem",
              textAlign: "center", border: `1px solid ${accentColor}15`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: accentColor }}>
                {coveragePercent}%
              </div>
              <div style={{ fontSize: 10, color: "#999" }}>構造カバー率</div>
            </div>
          </div>

          {/* Missing Concepts */}
          {missingConcepts.length > 0 && (
            <div style={{
              marginTop: "0.75rem", padding: "0.5rem 0.75rem",
              background: "#FEF2F2", borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: "0.3rem" }}>
                次回教えるとき意識すべき概念
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {missingConcepts.slice(0, 8).map(c => (
                  <span key={c} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 6,
                    background: "#fff", color: "#EF4444", border: "1px solid #EF444420",
                  }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            display: "flex", gap: "0.75rem", marginTop: "0.5rem",
            justifyContent: "center", flexWrap: "wrap",
          }}>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#94A3B8" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                {type === "problem" ? "問題" : type === "cause" ? "原因" : type === "factor" ? "要因" : type === "solution" ? "解決策" : "概念"}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#22C55E" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              一致
            </div>
          </div>
        </>
      )}
    </div>
  );
}
