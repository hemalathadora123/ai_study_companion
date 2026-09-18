"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import VoiceAgentModal from "./VoiceAgentModal";

interface FloatingVoiceOrbProps {
  projectId?: string;
  projectName?: string;
  learningGoal?: string;
}

export default function FloatingVoiceOrb({
  projectId,
  projectName,
  learningGoal,
}: FloatingVoiceOrbProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="group relative flex items-center bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-indigo-400/30"
          title="Open Voice Companion"
        >
          {/* Pulsing ambient aura */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 opacity-40 group-hover:opacity-75 blur-sm transition-opacity" />

          <div className="relative flex items-center space-x-2">
            <div className="relative flex items-center justify-center">
              <Mic className="w-5 h-5 text-white animate-pulse" />
              <Sparkles className="w-2.5 h-2.5 text-cyan-300 absolute -top-1 -right-1" />
            </div>
            <span className="hidden sm:inline font-semibold text-xs tracking-wide">
              Voice Tutor
            </span>
          </div>
        </button>
      </div>

      <VoiceAgentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        learningGoal={learningGoal}
      />
    </>
  );
}
