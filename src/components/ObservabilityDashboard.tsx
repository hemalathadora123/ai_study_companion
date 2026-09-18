"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Zap,
  DollarSign,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Eye,
  Filter,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
  BarChart3
} from "lucide-react";
import ProgressBar from "@/components/ProgressBar";

interface FeatureBreakdownItem {
  feature: string;
  count: number;
  tokens: number;
  cost: number;
  avgLatencyMs: number;
}

interface AiLogItem {
  id: string;
  feature: string;
  model: string;
  totalTokens: number;
  latencyMs: number;
  costEstimate: number;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

interface BenchmarkCaseResult {
  name: string;
  category: "GROUNDEDNESS" | "RETRIEVAL" | "GRADING";
  passed: boolean;
  score: number;
  details: string;
  latencyMs: number;
}

interface EvaluationReport {
  timestamp: string;
  overallScore: number;
  groundednessScore: number;
  retrievalPrecisionScore: number;
  gradingConsistencyScore: number;
  passedCount: number;
  totalCases: number;
  benchmarkCases?: BenchmarkCaseResult[];
}

export default function ObservabilityDashboard({ projectId }: { projectId?: string }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [evalReport, setEvalReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [featureFilter, setFeatureFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AiLogItem | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const featureParam = featureFilter !== "ALL" ? `?feature=${featureFilter}` : "";
      const [metricsRes, evalRes] = await Promise.all([
        fetch(`/api/admin/observability${featureParam}`).then((r) => r.json()),
        fetch(`/api/admin/evaluation`).then((r) => r.json()),
      ]);

      if (metricsRes.metrics) {
        setMetrics(metricsRes.metrics);
      }
      if (evalRes.lastReport) {
        setEvalReport(evalRes.lastReport);
      }
    } catch (err) {
      console.error("Failed to load observability telemetry:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [featureFilter]);

  async function handleRunEvaluation() {
    setEvaluating(true);
    try {
      const res = await fetch("/api/admin/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.report) {
        setEvalReport(data.report);
      }
      // Refresh telemetry metrics after running benchmarks
      await loadData();
    } catch (err) {
      console.error("Failed to run evaluation benchmark suite:", err);
    } finally {
      setEvaluating(false);
    }
  }

  const formatCost = (cost?: number) => {
    if (typeof cost !== "number") return "$0.00000";
    return `$${cost.toFixed(5)}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Telemetry
            </span>
            <span className="text-xs text-slate-400">• PRD Phase 7</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            AI Observability & Evaluation Platform
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full visibility into LLM token consumption, latency distributions, cost estimates, and benchmark evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunEvaluation}
            disabled={evaluating}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {evaluating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Benchmarking AI...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Evaluation Suite</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Invocations */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Invocations</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {metrics?.totalCalls ?? 0}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{metrics?.successRate ?? 100}% Success</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Tokens</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {(metrics?.totalTokens ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {(metrics?.promptTokens ?? 0).toLocaleString()}p / {(metrics?.completionTokens ?? 0).toLocaleString()}c
          </div>
        </div>

        {/* Total Cost Estimate */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {formatCost(metrics?.totalCostEstimate)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Gemini 2.5 Flash blend
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Avg Latency</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {metrics?.averageLatencyMs ?? 0}
            <span className="text-xs font-normal text-slate-500 ml-1">ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Mean response time</div>
        </div>

        {/* P95 Latency */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">p95 Latency</span>
            <BarChart3 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {metrics?.p95LatencyMs ?? 0}
            <span className="text-xs font-normal text-slate-500 ml-1">ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">95th percentile</div>
        </div>

        {/* Benchmark Score */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Eval Rating</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">
            {evalReport ? `${evalReport.overallScore}%` : "Ready"}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {evalReport
              ? `${evalReport.passedCount}/${evalReport.totalCases} Tests Passed`
              : "Click Run Suite"}
          </div>
        </div>
      </div>

      {/* AI Evaluation Benchmark Suite Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Automated AI Evaluation Suite (PRD Section 11)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous validation of Groundedness, Scoped Retrieval Precision, and Rubric Grading Consistency.
            </p>
          </div>
          {evalReport?.timestamp && (
            <div className="text-xs text-slate-400">
              Last Evaluated: {new Date(evalReport.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        {evalReport ? (
          <div className="space-y-6">
            {/* 3 Core Evaluation Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pillar 1: Groundedness */}
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    1. Groundedness & Refusal
                  </span>
                  <span className="text-sm font-extrabold text-indigo-700">
                    {evalReport.groundednessScore}%
                  </span>
                </div>
                <ProgressBar value={evalReport.groundednessScore} showLabel={false} size="sm" />
                <p className="text-[11px] text-indigo-950/80">
                  Strict rejection of out-of-scope queries & zero hallucinations without evidence.
                </p>
              </div>

              {/* Pillar 2: Retrieval Precision */}
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    2. Retrieval Precision
                  </span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    {evalReport.retrievalPrecisionScore}%
                  </span>
                </div>
                <ProgressBar value={evalReport.retrievalPrecisionScore} showLabel={false} size="sm" />
                <p className="text-[11px] text-emerald-950/80">
                  Project boundary isolation, lexical-semantic matching & threshold scoring.
                </p>
              </div>

              {/* Pillar 3: Grading Consistency */}
              <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                    3. Grading Consistency
                  </span>
                  <span className="text-sm font-extrabold text-purple-700">
                    {evalReport.gradingConsistencyScore}%
                  </span>
                </div>
                <ProgressBar value={evalReport.gradingConsistencyScore} showLabel={false} size="sm" />
                <p className="text-[11px] text-purple-950/80">
                  Rubric alignment, partial credit distribution & gap detection calibration.
                </p>
              </div>
            </div>

            {/* Individual Benchmark Test Cases */}
            {evalReport.benchmarkCases && evalReport.benchmarkCases.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Evaluation Test Cases ({evalReport.benchmarkCases.length})
                </div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {evalReport.benchmarkCases.map((testCase, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        {testCase.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900">
                              {testCase.name}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {testCase.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {testCase.details}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-center">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {testCase.latencyMs}ms
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            testCase.passed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {testCase.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  High-level benchmark metrics recorded ({evalReport.passedCount ?? 0}/{evalReport.totalCases ?? 6} tests passed). Click <strong>Run Evaluation Suite</strong> to generate detailed per-case telemetry.
                </span>
                <button
                  onClick={handleRunEvaluation}
                  disabled={evaluating}
                  className="ml-3 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  Run Now
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="font-semibold text-sm text-slate-700">
              No Evaluation Benchmarks Run Yet
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Execute the automated evaluation suite to test Groundedness, Citation integrity, Scoped Retrieval, and Rubric Grading.
            </p>
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Automated Benchmark</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          Feature Cost & Token Usage Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">AI Feature</th>
                <th className="py-2.5 px-3">Invocations</th>
                <th className="py-2.5 px-3">Total Tokens</th>
                <th className="py-2.5 px-3">Est. Cost</th>
                <th className="py-2.5 px-3">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(metrics?.featureBreakdown || []).map((feat: FeatureBreakdownItem) => (
                <tr key={feat.feature} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                      {feat.feature}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{feat.count}</td>
                  <td className="py-2.5 px-3 font-mono">{feat.tokens.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {formatCost(feat.cost)}
                  </td>
                  <td className="py-2.5 px-3 font-mono">{feat.avgLatencyMs} ms</td>
                </tr>
              ))}
              {(!metrics?.featureBreakdown || metrics.featureBreakdown.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No feature logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live AI Telemetry Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Live AI Telemetry Audit Logs (Last 30)
          </h3>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Features</option>
              <option value="TUTOR">TUTOR</option>
              <option value="QUIZ_GENERATION">QUIZ_GENERATION</option>
              <option value="ASSESSMENT_EVALUATION">ASSESSMENT_EVALUATION</option>
              <option value="CONCEPT_EXTRACTION">CONCEPT_EXTRACTION</option>
              <option value="RECOMMENDATIONS">RECOMMENDATIONS</option>
              <option value="EVALUATION_BENCHMARK">EVALUATION_BENCHMARK</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Tokens</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Cost</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(metrics?.recentLogs || []).map((log: AiLogItem) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                      {log.feature}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                    {log.model}
                  </td>
                  <td className="py-2.5 px-3 font-mono">{log.totalTokens}</td>
                  <td className="py-2.5 px-3 font-mono">{log.latencyMs} ms</td>
                  <td className="py-2.5 px-3">{formatCost(log.costEstimate)}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {log.metadata && (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!metrics?.recentLogs || metrics.recentLogs.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No telemetry records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Telemetry Payload: {selectedLog.feature}
                </h4>
                <div className="text-[11px] text-slate-400">
                  ID: {selectedLog.id} • {new Date(selectedLog.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-md"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl">
              <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
