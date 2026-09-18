"use client";

import { useState, useMemo } from "react";
import {
  Brain,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  GraduationCap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Target,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export interface SkillNodeData {
  conceptId: string;
  name: string;
  description?: string | null;
  masteryScore: number;
  status: "STABLE" | "IMPROVING" | "NEEDS_ATTENTION";
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number;
  lastAssessedAt?: string | null;
  history: { timestamp: string; score: number }[];
  retentionRate?: number;
}

interface ConceptSkillTreeProps {
  concepts: SkillNodeData[];
  onStartViva?: (conceptName: string) => void;
  onPracticeQuiz?: (conceptId: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
  tier: number;
  isFogged: boolean;
  color: string;
  glowColor: string;
}

export default function ConceptSkillTree({
  concepts,
  onStartViva,
  onPracticeQuiz,
}: ConceptSkillTreeProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Layout concepts in tiers/layers
  const { nodes, connections, svgWidth, svgHeight } = useMemo(() => {
    if (!concepts || concepts.length === 0) {
      return { nodes: [], connections: [], svgWidth: 800, svgHeight: 400 };
    }

    const count = concepts.length;
    // Group into 3 or 4 tiers: Foundational, Core, Advanced, Mastery
    const tiersCount = Math.min(4, Math.max(2, Math.ceil(count / 3)));
    const perTier = Math.ceil(count / tiersCount);

    const width = 850;
    const height = Math.max(450, tiersCount * 130 + 80);

    const calculatedNodes: Array<{
      concept: SkillNodeData;
      pos: NodePosition;
    }> = [];

    concepts.forEach((c, idx) => {
      const tier = Math.min(tiersCount - 1, Math.floor(idx / perTier));
      const idxInTier = idx % perTier;
      const totalInThisTier = Math.min(perTier, count - tier * perTier);

      // Distribute evenly horizontally with staggered offsets
      const stepX = width / (totalInThisTier + 1);
      const jitter = (tier % 2 === 1 ? 1 : -1) * ((idx % 3) * 15);
      const x = stepX * (idxInTier + 1) + jitter;
      const y = 80 + tier * 120 + ((idx % 2) * 20 - 10);

      const isFogged = c.totalAttempts === 0;

      let color = "#94a3b8"; // slate
      let glowColor = "rgba(148, 163, 184, 0.2)";

      if (!isFogged) {
        if (c.masteryScore >= 80) {
          color = "#10b981"; // emerald
          glowColor = "rgba(16, 185, 129, 0.35)";
        } else if (c.masteryScore >= 50) {
          color = "#f59e0b"; // amber
          glowColor = "rgba(245, 158, 11, 0.35)";
        } else {
          color = "#f43f5e"; // rose
          glowColor = "rgba(244, 63, 94, 0.35)";
        }
      }

      calculatedNodes.push({
        concept: c,
        pos: { x, y, tier, isFogged, color, glowColor },
      });
    });

    // Build connections from tier N to tier N+1
    const conns: Array<{ from: NodePosition; to: NodePosition; isUnlocked: boolean }> = [];
    for (let i = 0; i < calculatedNodes.length; i++) {
      for (let j = i + 1; j < calculatedNodes.length; j++) {
        const nodeA = calculatedNodes[i];
        const nodeB = calculatedNodes[j];
        if (nodeB.pos.tier === nodeA.pos.tier + 1 && Math.abs(nodeA.pos.x - nodeB.pos.x) < 260) {
          conns.push({
            from: nodeA.pos,
            to: nodeB.pos,
            isUnlocked: !nodeA.pos.isFogged && !nodeB.pos.isFogged,
          });
        }
      }
    }

    return { nodes: calculatedNodes, connections: conns, svgWidth: width, svgHeight: height };
  }, [concepts]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.concept.conceptId === selectedConceptId);
  }, [nodes, selectedConceptId]);

  if (!concepts || concepts.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
        No concepts found yet. Upload learning materials to generate the knowledge skill tree!
      </div>
    );
  }

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
      {/* Skill Tree Header Bar */}
      <div className="px-6 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Interactive Concept Skill Tree</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
                Fog-of-War Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Visual roadmap of your learning journey. Nodes unlock and glow as you master topics.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            Mastered (&ge;80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
            Developing (50-79%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
            Needs Focus (&lt;50%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 border border-dashed border-slate-400" />
            Fog of War (Unattempted)
          </span>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800/60 rounded-xl p-0.5 border border-slate-700/60 ml-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 text-[10px] text-slate-300 font-mono cursor-pointer"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas Area */}
      <div className="relative overflow-auto p-4 flex justify-center min-h-[480px]">
        {/* Subtle Constellation Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#6366f1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center top",
            transition: "transform 0.15s ease-out",
          }}
          className="relative"
        >
          <svg
            width={svgWidth}
            height={svgHeight}
            className="overflow-visible select-none"
          >
            <defs>
              {/* Gradient for unlocked pathways */}
              <linearGradient id="unlockedPath" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="foggedPath" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.2" />
              </linearGradient>
              <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Render Connecting Pathway Curves */}
            {connections.map((c, i) => {
              const dx = c.to.x - c.from.x;
              const dy = c.to.y - c.from.y;
              // Smooth cubic bezier
              const pathD = `M ${c.from.x} ${c.from.y} C ${c.from.x + dx * 0.1} ${
                c.from.y + dy * 0.6
              }, ${c.to.x - dx * 0.1} ${c.to.y - dy * 0.6}, ${c.to.x} ${c.to.y}`;

              return (
                <path
                  key={i}
                  d={pathD}
                  fill="none"
                  stroke={c.isUnlocked ? "url(#unlockedPath)" : "url(#foggedPath)"}
                  strokeWidth={c.isUnlocked ? 2.5 : 1.5}
                  strokeDasharray={c.isUnlocked ? undefined : "4 4"}
                  className={c.isUnlocked ? "animate-pulse duration-1000" : ""}
                />
              );
            })}

            {/* Render Concept Nodes */}
            {nodes.map(({ concept, pos }) => {
              const isSelected = selectedConceptId === concept.conceptId;
              const radius = isSelected ? 32 : 28;

              return (
                <g
                  key={concept.conceptId}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer group transition-transform duration-150"
                  onClick={() => setSelectedConceptId(concept.conceptId)}
                >
                  {/* Outer Glow Halo */}
                  {!pos.isFogged && (
                    <circle
                      r={radius + 8}
                      fill={pos.glowColor}
                      className="transition-all duration-300 group-hover:scale-125"
                    />
                  )}

                  {/* Fog of War shroud ring */}
                  {pos.isFogged && (
                    <circle
                      r={radius + 4}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      className="animate-spin-slow opacity-60"
                    />
                  )}

                  {/* Main Node Hexagon / Circle */}
                  <circle
                    r={radius}
                    fill={pos.isFogged ? "#0f172a" : "#1e293b"}
                    stroke={isSelected ? "#ffffff" : pos.color}
                    strokeWidth={isSelected ? 3 : 2}
                    className="shadow-xl"
                  />

                  {/* Icon or Score inside node */}
                  {pos.isFogged ? (
                    <g transform="translate(-8, -8)">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </g>
                  ) : (
                    <text
                      textAnchor="middle"
                      dy="5"
                      fill={pos.color}
                      fontSize="12"
                      fontWeight="bold"
                      className="select-none font-mono"
                    >
                      {Math.round(concept.masteryScore)}%
                    </text>
                  )}

                  {/* Concept Title Label Underneath */}
                  <foreignObject
                    x="-90"
                    y={radius + 8}
                    width="180"
                    height="45"
                    className="overflow-visible pointer-events-none"
                  >
                    <div className="text-center">
                      <div
                        className={`text-[11px] font-semibold truncate px-2 py-0.5 rounded-md inline-block max-w-[170px] ${
                          pos.isFogged
                            ? "text-slate-500 bg-slate-900/60"
                            : isSelected
                            ? "text-white bg-indigo-600/90 shadow-sm"
                            : "text-slate-200 bg-slate-900/80 border border-slate-800"
                        }`}
                      >
                        {pos.isFogged ? "🔒 " + concept.name : concept.name}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Node Inspect Side/Bottom Drawer */}
      {selectedNode && (
        <div className="border-t border-slate-800/80 bg-slate-900/95 p-5 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedNode.pos.color }}
                />
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  {selectedNode.concept.name}
                </h4>
                {selectedNode.pos.isFogged ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Fog of War (Unattempted)
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border"
                    style={{
                      color: selectedNode.pos.color,
                      borderColor: selectedNode.pos.color + "66",
                      backgroundColor: selectedNode.pos.color + "1a",
                    }}
                  >
                    {selectedNode.concept.status.replace("_", " ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedNode.concept.description ||
                  "A foundational building block for this subject. Master this to unlock advanced topics."}
              </p>
            </div>

            {/* Actions & Metrics */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-4 border-r border-slate-800 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Mastery</div>
                  <div
                    className="text-sm font-bold font-mono"
                    style={{ color: selectedNode.pos.color }}
                  >
                    {Math.round(selectedNode.concept.masteryScore)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Accuracy</div>
                  <div className="text-sm font-bold text-slate-200 font-mono">
                    {Math.round(selectedNode.concept.accuracyRate)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Attempts</div>
                  <div className="text-sm font-bold text-slate-200 font-mono">
                    {selectedNode.concept.totalAttempts}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onStartViva && (
                  <button
                    type="button"
                    onClick={() => onStartViva(selectedNode.concept.name)}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-colors cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Oral Viva</span>
                  </button>
                )}

                {onPracticeQuiz && (
                  <button
                    type="button"
                    onClick={() => onPracticeQuiz(selectedNode.concept.conceptId)}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-900/30 transition-colors cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Practice Drill</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedConceptId(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
