"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCcw,
  BookOpen,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  Loader2,
  Target,
  Network,
  LayoutGrid,
  Activity,
  ShieldAlert,
  Zap,
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import ConceptSkillTree from "./ConceptSkillTree";

interface ConceptGrowthItem {
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

interface ProjectGrowthSummary {
  projectId: string;
  projectName: string;
  overallProgress: number;
  totalConcepts: number;
  stableCount: number;
  improvingCount: number;
  needsAttentionCount: number;
  totalAttempts: number;
  overallAccuracyRate: number;
  concepts: ConceptGrowthItem[];
  recentQuizScores: { id: string; title: string; score: number; completedAt: string }[];
}

interface Recommendation {
  id: string;
  type: string;
  title: string;
  reason: string;
  priority: string;
  targetUrl?: string | null;
  isCompleted: boolean;
}

interface MisconceptionPattern {
  conceptId: string;
  conceptName: string;
  failureCount: number;
  severity: string;
  remediationMaterialTitle?: string;
  remediationPageNumber?: number;
}

interface GrowthDashboardProps {
  projectId: string;
  onNavigateTab?: (tab: string) => void;
}

export default function GrowthDashboard({
  projectId,
  onNavigateTab,
}: GrowthDashboardProps) {
  const [analytics, setAnalytics] = useState<ProjectGrowthSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mistakes, setMistakes] = useState<MisconceptionPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingRecs, setRefreshingRecs] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "SKILL_TREE">("GRID");

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [growthRes, recsRes, mistakesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/growth`),
        fetch(`/api/projects/${projectId}/recommendations`),
        fetch(`/api/projects/${projectId}/mistakes`),
      ]);

      const growthData = await growthRes.json();
      const recsData = await recsRes.json();
      const mistakesData = await mistakesRes.json();

      if (growthData.analytics) setAnalytics(growthData.analytics);
      if (recsData.recommendations) setRecommendations(recsData.recommendations);
      if (mistakesData.result?.patterns) setMistakes(mistakesData.result.patterns);
    } catch (err) {
      console.error("Failed to load growth dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshRecommendations() {
    setRefreshingRecs(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/recommendations`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.recommendations) {
        // Reload persisted recommendations
        const recsRes = await fetch(`/api/projects/${projectId}/recommendations`);
        const recsData = await recsRes.json();
        setRecommendations(recsData.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to refresh recommendations:", err);
    } finally {
      setRefreshingRecs(false);
    }
  }

  async function toggleCompleteRecommendation(recId: string, currentStatus: boolean) {
    try {
      await fetch(`/api/recommendations/${recId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !currentStatus }),
      });

      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === recId ? { ...r, isCompleted: !currentStatus } : r
        )
      );
    } catch (err) {
      console.error("Failed to toggle recommendation:", err);
    }
  }

  function handleActionClick(targetUrl?: string | null) {
    if (!targetUrl) return;
    if (targetUrl.includes("tab=materials") && onNavigateTab) {
      onNavigateTab("materials");
    } else if (targetUrl.includes("tab=quiz") && onNavigateTab) {
      onNavigateTab("quiz");
    } else if (targetUrl.includes("tab=tutor") && onNavigateTab) {
      onNavigateTab("tutor");
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
        Unable to load growth analytics. Please try again.
      </div>
    );
  }

  const filteredConcepts = analytics.concepts.filter((c) => {
    if (filterStatus === "ALL") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Overall Progress Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Mastery Trajectory & Growth Analysis
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time concept-level mastery calculated from grounded tutor interactions and adaptive assessments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                Overall Mastery
              </div>
              <div className="text-xl font-black text-indigo-600">
                {analytics.overallProgress}%
              </div>
            </div>
          </div>
        </div>

        <ProgressBar value={analytics.overallProgress} />

        {/* Breakdown Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
            <div className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Stable ({analytics.stableCount})
            </div>
            <div className="text-xs text-emerald-700 mt-1 font-semibold">
              ≥ 75% Mastery
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
            <div className="text-[11px] font-bold text-indigo-800 uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Improving ({analytics.improvingCount})
            </div>
            <div className="text-xs text-indigo-700 mt-1 font-semibold">
              60% - 74% Mastery
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl">
            <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Needs Attention ({analytics.needsAttentionCount})
            </div>
            <div className="text-xs text-amber-700 mt-1 font-semibold">
              &lt; 60% Mastery
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Accuracy
            </div>
            <div className="text-xs text-slate-600 mt-1 font-semibold">
              {analytics.overallAccuracyRate}% ({analytics.totalAttempts} attempts)
            </div>
          </div>
        </div>
      </div>

      {/* Repeated Misconceptions Alert Banner */}
      {mistakes.length > 0 && (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/70 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Persistent Misconceptions Detected ({mistakes.length})</span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase">
              Action Required
            </span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            Our background analysis detected repeated errors on the following concepts across multiple assessments. Targeted review is recommended:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {mistakes.map((m) => (
              <div
                key={m.conceptId}
                className="p-3.5 bg-white rounded-xl border border-rose-200 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    {m.conceptName}
                  </span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                    Missed {m.failureCount}x
                  </span>
                </div>
                {m.remediationPageNumber && (
                  <p className="text-[11px] text-slate-600">
                    📖 Review: <b>{m.remediationMaterialTitle}</b> (Page{" "}
                    {m.remediationPageNumber})
                  </p>
                )}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => onNavigateTab && onNavigateTab("materials")}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1"
                  >
                    Open Source Material
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ebbinghaus Memory Decay & Retention Shield Alert */}
      {analytics.concepts.some((c) => c.retentionRate !== undefined && c.retentionRate < 60) && (
        <div className="p-5 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>
                Memory Decay Alert:{" "}
                {
                  analytics.concepts.filter(
                    (c) => c.retentionRate !== undefined && c.retentionRate < 60
                  ).length
                }{" "}
                Concept(s) Slipping from Active Recall
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab("quiz")}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Activate 2-Min Retention Shield</span>
            </button>
          </div>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            According to the Ebbinghaus forgetting curve, memory stability decays if concepts are not reinforced. Reviewing these topics today will reset the decay curve and maintain high mastery:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {analytics.concepts
              .filter((c) => c.retentionRate !== undefined && c.retentionRate < 60)
              .map((c) => (
                <span
                  key={c.conceptId}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300"
                >
                  <Activity className="w-3 h-3 text-amber-600" />
                  {c.name}: <b>{c.retentionRate}% Retention</b>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 2. Actionable Recommendations ("What Should I Do Next?") */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">
              What Should I Do Next? (Actionable Recommendations)
            </h4>
          </div>

          <button
            onClick={refreshRecommendations}
            disabled={refreshingRecs}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-50"
          >
            {refreshingRecs ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Refresh Guidance
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            No pending recommendations. You are on track!
          </div>
        ) : (
          <div className="space-y-2.5">
            {recommendations.map((rec) => {
              const isHigh = rec.priority === "HIGH";

              return (
                <div
                  key={rec.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    rec.isCompleted
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : isHigh
                      ? "bg-amber-50/50 border-amber-200"
                      : "bg-indigo-50/40 border-indigo-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        toggleCompleteRecommendation(rec.id, rec.isCompleted)
                      }
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        rec.isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-300 hover:border-indigo-400 bg-white"
                      }`}
                    >
                      {rec.isCompleted && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold ${
                            rec.isCompleted
                              ? "line-through text-slate-400"
                              : "text-slate-900"
                          }`}
                        >
                          {rec.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${
                            isHigh
                              ? "bg-amber-100 text-amber-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  {rec.targetUrl && !rec.isCompleted && (
                    <button
                      onClick={() => handleActionClick(rec.targetUrl)}
                      className="shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg transition-all shadow-xs inline-flex items-center gap-1"
                    >
                      Take Action
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Concept Mastery Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">
              Concept Mastery Matrix ({analytics.concepts.length})
            </h4>
          </div>

          {/* Filter Pills and View Mode Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Grid vs Skill Tree */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === "GRID"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("SKILL_TREE")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === "SKILL_TREE"
                    ? "bg-indigo-600 text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Skill Tree Map</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {["ALL", "NEEDS_ATTENTION", "IMPROVING", "STABLE"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    filterStatus === st
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {st === "ALL"
                    ? "All"
                    : st === "NEEDS_ATTENTION"
                    ? "Needs Attention"
                    : st === "IMPROVING"
                    ? "Improving"
                    : "Stable"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Skill Tree or Grid View Display */}
        {viewMode === "SKILL_TREE" ? (
          <ConceptSkillTree
            concepts={filteredConcepts}
            onStartViva={() => onNavigateTab && onNavigateTab("tutor")}
            onPracticeQuiz={() => onNavigateTab && onNavigateTab("quiz")}
          />
        ) : filteredConcepts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            No concepts match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredConcepts.map((c) => {
              const statusBadge =
                c.status === "STABLE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : c.status === "IMPROVING"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";

              return (
                <div
                  key={c.conceptId}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all bg-white shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">
                        {c.name}
                      </h5>
                      {c.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusBadge}`}
                    >
                      {c.status === "STABLE"
                        ? "Stable"
                        : c.status === "IMPROVING"
                        ? "Improving"
                        : "Needs Attention"}
                    </span>
                  </div>

                  <ProgressBar value={c.masteryScore} size="sm" />

                  {/* History & Attempts stats */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-2">
                      <span>
                        {c.correctAttempts}/{c.totalAttempts} correct ({c.accuracyRate}%)
                      </span>
                      {c.retentionRate !== undefined && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            c.retentionRate < 60
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <Activity className="w-2.5 h-2.5" />
                          {c.retentionRate}% Retention
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab("quiz")}
                      className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      Practice
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
