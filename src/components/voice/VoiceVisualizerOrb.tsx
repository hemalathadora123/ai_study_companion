"use client";

import React from "react";
import { Mic, MicOff, Sparkles, Volume2, Loader2, AlertCircle } from "lucide-react";
import { VoiceAgentStatus } from "@/hooks/useVoiceAgent";

interface VoiceVisualizerOrbProps {
  status: VoiceAgentStatus;
  isMuted?: boolean;
  audioLevel?: number;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

export default function VoiceVisualizerOrb({
  status,
  isMuted = false,
  audioLevel = 0,
  onClick,
  size = "lg",
}: VoiceVisualizerOrbProps) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-28 h-28",
    lg: "w-40 h-40 sm:w-48 sm:h-48",
  }[size];

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  }[size];

  // Dynamic gradient based on status
  const gradientClass = (() => {
    if (isMuted) return "from-slate-600 via-slate-700 to-slate-800 shadow-slate-900/40";
    switch (status) {
      case "listening":
        return "from-cyan-500 via-indigo-600 to-blue-600 shadow-indigo-500/50";
      case "thinking":
        return "from-purple-600 via-fuchsia-600 to-indigo-700 shadow-purple-500/50";
      case "speaking":
        return "from-emerald-500 via-teal-600 to-indigo-600 shadow-emerald-500/50";
      case "error":
        return "from-rose-500 via-amber-600 to-rose-700 shadow-rose-500/50";
      default: // idle
        return "from-indigo-500 via-indigo-600 to-purple-600 shadow-indigo-500/30";
    }
  })();

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer Pulse Rings when Listening */}
      {status === "listening" && !isMuted && (
        <>
          <div
            className="absolute rounded-full bg-cyan-400/20 animate-voice-pulse-ring"
            style={{ width: "130%", height: "130%" }}
          />
          <div
            className="absolute rounded-full bg-indigo-500/15 animate-voice-pulse-ring [animation-delay:0.5s]"
            style={{ width: "160%", height: "160%" }}
          />
        </>
      )}

      {/* Outer Glow Ripples when Speaking */}
      {status === "speaking" && (
        <>
          <div
            className="absolute rounded-full bg-emerald-400/20 animate-voice-pulse-ring"
            style={{ width: "125%", height: "125%" }}
          />
          <div
            className="absolute rounded-full bg-teal-500/15 animate-voice-pulse-ring [animation-delay:0.7s]"
            style={{ width: "155%", height: "155%" }}
          />
        </>
      )}

      {/* Orbiting Ring when Thinking */}
      {status === "thinking" && (
        <div
          className="absolute rounded-full border-2 border-dashed border-purple-400/60 animate-voice-spin-slow pointer-events-none"
          style={{ width: "135%", height: "135%" }}
        />
      )}

      {/* Main Interactive Orb Button */}
      <button
        type="button"
        onClick={onClick}
        className={`relative ${sizeClasses} rounded-full bg-gradient-to-tr ${gradientClass} shadow-2xl flex items-center justify-center text-white transition-all duration-300 transform active:scale-95 cursor-pointer z-10 ${
          status === "idle" ? "animate-voice-orb-breathe hover:scale-105" : ""
        }`}
        title={
          status === "listening"
            ? "Listening... (Click to pause or finish)"
            : status === "speaking"
            ? "Speaking... (Click to interrupt)"
            : status === "thinking"
            ? "Consulting notes..."
            : "Click to speak"
        }
      >
        {/* Glass reflection highlight */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

        {/* Center Icon */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {isMuted ? (
            <MicOff className={`${iconSizes} text-slate-300`} />
          ) : status === "listening" ? (
            <Mic className={`${iconSizes} text-white animate-pulse`} />
          ) : status === "thinking" ? (
            <Loader2 className={`${iconSizes} text-purple-200 animate-spin`} />
          ) : status === "speaking" ? (
            <Volume2 className={`${iconSizes} text-white animate-bounce`} />
          ) : status === "error" ? (
            <AlertCircle className={`${iconSizes} text-white`} />
          ) : (
            <Sparkles className={`${iconSizes} text-indigo-100`} />
          )}
        </div>
      </button>

      {/* Real-time sound wave bars below orb */}
      {(status === "listening" || status === "speaking") && !isMuted && (
        <div className="absolute -bottom-8 flex items-center gap-1.5 h-6">
          {[40, 75, 100, 60, 90, 45, 80].map((heightPct, idx) => (
            <div
              key={idx}
              className={`w-1 rounded-full transition-all duration-150 ${
                status === "speaking" ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{
                height: `${Math.max(6, heightPct * (audioLevel || 0.5))}%`,
                animation: "voice-wave-bar 0.8s ease-in-out infinite",
                animationDelay: `${idx * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
