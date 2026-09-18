"use client";

import { useEffect, useState } from "react";
import { Star, Sparkles, Award } from "lucide-react";

interface PointsToastProps {
  points: number;
  reason?: string;
  onDismiss?: () => void;
  durationMs?: number;
}

export default function PointsToast({
  points,
  reason = "Study Achievement",
  onDismiss,
  durationMs = 4000,
}: PointsToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  if (!visible || points <= 0) return null;

  return (
    <div className="fixed top-20 right-6 z-[130] animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white p-0.5 rounded-2xl shadow-xl shadow-indigo-500/20">
        <div className="bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-[14px] flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Star className="w-4 h-4 fill-amber-300 animate-bounce" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-300 flex items-center gap-1">
              +{points} Points Earned! <Sparkles className="w-3 h-3 text-cyan-300" />
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              {reason}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
