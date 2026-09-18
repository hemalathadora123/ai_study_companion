"use client";

import Header from "@/components/Header";
import ObservabilityDashboard from "@/components/ObservabilityDashboard";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Cpu, Database, BellRing } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Workspaces
          </Link>
        </div>

        {/* Admin Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                System Administration
              </span>
              <span className="text-xs text-slate-400">• PRD Sections 11 & 12</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-600" />
              Platform Observability & AI Benchmark Console
            </h1>
            <p className="text-xs text-slate-500">
              Audit AI prompt latency, token costs, guardrails, and run automated Groundedness & Grading benchmark evaluations.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-700">Event Bus Active</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700">SQLite Dev DB</span>
            </div>
          </div>
        </div>

        {/* Telemetry & Evaluation Suite */}
        <ObservabilityDashboard />
      </main>
    </div>
  );
}
