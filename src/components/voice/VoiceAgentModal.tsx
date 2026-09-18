"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  BookOpen,
  ChevronDown,
  Settings2,
  RefreshCw,
  MessageSquare,
  History,
  Target,
  ArrowRight,
  ShieldCheck,
  Zap,
  GraduationCap,
  Headphones,
  Award,
  CheckCircle2,
  Brain,
  Lightbulb,
} from "lucide-react";
import VoiceVisualizerOrb from "./VoiceVisualizerOrb";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  learningGoal?: string;
}

interface Citation {
  materialId: string;
  title: string;
  pageNumber: number;
  snippet?: string;
}

interface VoiceTurn {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  timestamp: Date;
}

export default function VoiceAgentModal({
  isOpen,
  onClose,
  projectId: initialProjectId,
  projectName: initialProjectName,
  learningGoal: initialLearningGoal,
}: VoiceAgentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(initialProjectId);
  const [activeProjectName, setActiveProjectName] = useState<string | undefined>(initialProjectName);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [history, setHistory] = useState<VoiceTurn[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [currentCitations, setCurrentCitations] = useState<Citation[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // New Additive Mode: Feynman Oral Viva
  const [voiceMode, setVoiceMode] = useState<"TUTOR" | "VIVA">("TUTOR");
  const [vivaQuestion, setVivaQuestion] = useState<{
    conceptId: string;
    conceptName: string;
    questionPrompt: string;
    contextHint: string;
  } | null>(null);
  const [vivaEvaluation, setVivaEvaluation] = useState<any | null>(null);
  const [loadingViva, setLoadingViva] = useState(false);

  // Keep ref for the question to send
  const pendingQuestionRef = useRef<string>("");

  const {
    status,
    setStatus,
    transcript,
    interimTranscript,
    isListening,
    isSpeaking,
    isThinking,
    isMuted,
    audioLevel,
    speechRate,
    setSpeechRate,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    continuousMode,
    setContinuousMode,
    errorMessage,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    toggleMute,
    testVoice,
    unlockAudio,
    isRecognitionSupported,
    isSynthesisSupported,
  } = useVoiceAgent({
    onQuestionReady: (question) => {
      handleProcessQuestion(question);
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update active project if prop changes
  useEffect(() => {
    if (initialProjectId) {
      setActiveProjectId(initialProjectId);
      setActiveProjectName(initialProjectName);
    }
  }, [initialProjectId, initialProjectName]);

  // If no projectId provided, fetch user's projects to allow selection
  useEffect(() => {
    if (isOpen && !activeProjectId) {
      fetch("/api/projects")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.projects && data.projects.length > 0) {
            setAvailableProjects(data.projects);
            setActiveProjectId(data.projects[0].id);
            setActiveProjectName(data.projects[0].name);
          }
        })
        .catch((err) => console.error("Failed to load projects for voice agent:", err));
    }
  }, [isOpen, activeProjectId]);

  // Load or create a voice conversation session for this project
  useEffect(() => {
    if (!isOpen || !activeProjectId) return;

    let active = true;
    async function initSession() {
      try {
        const res = await fetch(`/api/projects/${activeProjectId}/conversations`);
        const data = await res.json();
        const convs = data.conversations || [];
        if (convs.length > 0) {
          if (active) setConversationId(convs[0].id);
        } else {
          // Create new voice session
          const createRes = await fetch(`/api/projects/${activeProjectId}/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Voice Study Session" }),
          });
          const createData = await createRes.json();
          if (active && createData.conversation) {
            setConversationId(createData.conversation.id);
          }
        }
      } catch (err) {
        console.error("Failed to initialize voice session:", err);
      }
    }
    initSession();
    return () => {
      active = false;
    };
  }, [isOpen, activeProjectId]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Auto-start listening shortly after modal opens
      const timer = setTimeout(() => {
        if (!isMuted) startListening();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "";
      stopListening();
      cancelSpeech();
    }
    return () => {
      document.body.style.overflow = "";
      stopListening();
      cancelSpeech();
    };
  }, [isOpen]);

  // Fetch a Feynman Oral Viva challenge question from the project
  async function fetchVivaQuestion(projId = activeProjectId) {
    if (!projId) return;
    setLoadingViva(true);
    setVivaEvaluation(null);
    setCurrentResponse(null);
    try {
      const res = await fetch(`/api/projects/${projId}/viva`);
      const data = await res.json();
      if (data.question) {
        setVivaQuestion(data.question);
        const intro = `Feynman Viva challenge on ${data.question.conceptName}: ${data.question.questionPrompt}`;
        setCurrentResponse(intro);
        speak(intro);
      }
    } catch (err) {
      console.error("Failed to load viva question:", err);
    } finally {
      setLoadingViva(false);
    }
  }

  // Process question via RAG backend
  async function handleProcessQuestion(question: string) {
    if (!question || !question.trim()) return;
    pendingQuestionRef.current = question.trim();

    // Unlock audio context during this user-initiated turn
    unlockAudio();
    stopListening();
    setStatus("thinking");
    setCurrentResponse(null);
    setCurrentCitations([]);

    try {
      // 1. Handle Feynman Reverse Viva Mode
      if (voiceMode === "VIVA" && vivaQuestion && activeProjectId) {
        const res = await fetch(`/api/projects/${activeProjectId}/viva`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conceptId: vivaQuestion.conceptId,
            questionPrompt: vivaQuestion.questionPrompt,
            speechText: question.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to evaluate viva explanation");
        }

        const evalResult = data.result;
        setVivaEvaluation(evalResult);
        setCurrentResponse(evalResult.verbalFeedback);

        // Record in local session history
        setHistory((prev) => [
          {
            id: `viva-${Date.now()}`,
            question: `[Feynman Viva: ${vivaQuestion.conceptName}] ${question.trim()}`,
            answer: `Oral Score: ${evalResult.overallScore}/100 — ${evalResult.verbalFeedback}`,
            citations: [],
            timestamp: new Date(),
          },
          ...prev,
        ]);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("points-updated"));
        }

        speak(evalResult.verbalFeedback);
        return;
      }

      // 2. Standard Grounded AI Tutor Mode
      let targetConvId = conversationId;

      // Ensure we have a conversationId
      if (!targetConvId && activeProjectId) {
        const createRes = await fetch(`/api/projects/${activeProjectId}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Voice Study Session" }),
        });
        const createData = await createRes.json();
        targetConvId = createData.conversation?.id;
        setConversationId(targetConvId);
      }

      if (!targetConvId) {
        throw new Error("Unable to establish project study session.");
      }

      const res = await fetch(`/api/conversations/${targetConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process question");
      }

      const answerText = data.content || "I couldn't find an answer in your project materials.";
      const citations = data.citations || [];

      setCurrentResponse(answerText);
      setCurrentCitations(citations);

      // Save to local session history
      setHistory((prev) => [
        {
          id: `voice-${Date.now()}`,
          question: question.trim(),
          answer: answerText,
          citations,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      if (data.pointsAwarded && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("points-updated"));
      }

      // Speak response aloud
      speak(answerText);
    } catch (err: any) {
      console.error("Voice processing error:", err);
      const fallback = "I encountered an error retrieving answers from your documents. Please try again or tap the microphone.";
      setCurrentResponse(fallback);
      speak(fallback);
    }
  }

  function handleOrbClick() {
    unlockAudio();
    if (status === "speaking") {
      // Interrupt speaking and listen immediately
      cancelSpeech();
      startListening();
    } else if (status === "listening") {
      // If user stops manual listening with text
      const current = interimTranscript || transcript;
      if (current.trim().length > 1) {
        handleProcessQuestion(current.trim());
      } else {
        stopListening();
      }
    } else {
      startListening();
    }
  }

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Background Glow Ambient Spotlights */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="relative z-10 px-6 py-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  AI Voice Companion
                </span>
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-200 truncate">
                {activeProjectName || "Study Workspace"}
              </div>
            </div>
          </div>

          {/* Mode Switcher Pills: Tutor vs Reverse Viva */}
          <div className="hidden sm:flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setVoiceMode("TUTOR");
                setVivaEvaluation(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                voiceMode === "TUTOR"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>AI Tutor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceMode("VIVA");
                if (!vivaQuestion && activeProjectId) {
                  fetchVivaQuestion(activeProjectId);
                }
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                voiceMode === "VIVA"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Reverse Viva (Feynman)</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Settings Toggle */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isSettingsOpen
                  ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                  : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
              }`}
              title="Voice Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* History Toggle */}
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showHistoryDrawer
                  ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                  : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
              }`}
              title="Session History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {isSettingsOpen && (
          <div className="relative z-20 px-6 py-3.5 bg-slate-900/95 border-b border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-150">
            {/* Speed selection */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Speed:</span>
              {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSpeechRate(rate)}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    speechRate === rate
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Continuous conversation mode toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Hands-Free Dialogue:</span>
              <button
                type="button"
                onClick={() => setContinuousMode(!continuousMode)}
                className={`px-2.5 py-1 rounded-lg font-medium border transition-colors cursor-pointer ${
                  continuousMode
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {continuousMode ? "ON" : "OFF"}
              </button>
            </div>

            {/* Voice picker */}
            {availableVoices.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Voice:</span>
                <select
                  value={selectedVoice?.name || ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setSelectedVoice(null);
                    } else {
                      const voice = availableVoices.find((v) => v.name === e.target.value);
                      if (voice) setSelectedVoice(voice);
                    }
                  }}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs max-w-[160px] truncate outline-hidden cursor-pointer"
                >
                  <option value="">Default System Voice</option>
                  {availableVoices.slice(0, 10).map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.localService ? "✓ " : ""}{v.name.replace(/Microsoft|Google/g, "").slice(0, 20)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test Voice Button */}
            <button
              type="button"
              onClick={testVoice}
              className="px-2.5 py-1 rounded-lg font-medium border border-indigo-500/50 bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition-colors cursor-pointer flex items-center gap-1"
              title="Play a test sound to verify audio is audible"
            >
              <Volume2 className="w-3 h-3" />
              <span>Test Voice</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center min-h-[340px]">
          {/* History Drawer View */}
          {showHistoryDrawer ? (
            <div className="w-full h-full space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Voice Session Turns ({history.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  Back to Orb
                </button>
              </div>
              {history.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No voice queries yet. Tap the orb and start speaking!
                </div>
              ) : (
                history.map((turn) => (
                  <div
                    key={turn.id}
                    className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2 text-left"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <Mic className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{turn.question}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-5">
                      {turn.answer}
                    </p>
                    {turn.citations.length > 0 && (
                      <div className="pl-5 pt-1 flex flex-wrap gap-1.5">
                        {turn.citations.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60"
                          >
                            <BookOpen className="w-2.5 h-2.5" />
                            {c.title} • P.{c.pageNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center max-w-lg w-full">
              {/* Interactive Visualizer Orb */}
              <div className="my-6">
                <VoiceVisualizerOrb
                  status={status}
                  isMuted={isMuted}
                  audioLevel={audioLevel}
                  onClick={handleOrbClick}
                  size="lg"
                />
              </div>

              {/* Viva Challenge Header if in VIVA mode */}
              {voiceMode === "VIVA" && vivaQuestion && (
                <div className="w-full mb-3 p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-left animate-in fade-in">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Feynman Oral Defense: {vivaQuestion.conceptName}
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchVivaQuestion(activeProjectId)}
                      disabled={loadingViva}
                      className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingViva ? "animate-spin" : ""}`} />
                      <span>Next Topic</span>
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-purple-100">
                    &ldquo;{vivaQuestion.questionPrompt}&rdquo;
                  </p>
                  <p className="text-[11px] text-purple-300/80 mt-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                    {vivaQuestion.contextHint}
                  </p>
                </div>
              )}

              {/* Status Message */}
              <div className="mt-4 mb-4">
                <div className="text-base sm:text-lg font-bold tracking-tight">
                  {status === "listening" ? (
                    <span className="text-cyan-300 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      {voiceMode === "VIVA"
                        ? "Listening to your explanation (teach the AI)..."
                        : "Listening to your question..."}
                    </span>
                  ) : status === "thinking" ? (
                    <span className="text-purple-300 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      {voiceMode === "VIVA"
                        ? "Evaluating your conceptual explanation..."
                        : "Consulting your project materials..."}
                    </span>
                  ) : status === "speaking" ? (
                    <span className="text-emerald-300 flex items-center justify-center gap-2">
                      <Volume2 className="w-4 h-4 animate-bounce text-emerald-400" />
                      {voiceMode === "VIVA"
                        ? "AI Examiner feedback (tap orb to interrupt)..."
                        : "Speaking explanation (tap orb to interrupt)..."}
                    </span>
                  ) : isMuted ? (
                    <span className="text-slate-400">Microphone is muted</span>
                  ) : (
                    <span className="text-slate-300">
                      {voiceMode === "VIVA"
                        ? "Tap the orb and explain this concept to the AI"
                        : "Tap the orb or speak to ask anything"}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  {voiceMode === "VIVA"
                    ? "Prove mastery by explaining the underlying intuition without jargon"
                    : "Answers are strictly verified against your uploaded documents & notes"}
                </p>
              </div>

              {/* Live Speech Recognition Transcript / AI Answer / Viva Scorecard */}
              <div className="w-full min-h-[90px] flex items-center justify-center">
                {isListening && (interimTranscript || transcript) ? (
                  <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-4 w-full text-left shadow-lg animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Mic className="w-3 h-3" /> {voiceMode === "VIVA" ? "Your Explanation:" : "You are asking:"}
                    </div>
                    <div className="text-sm text-slate-100 font-medium">
                      {interimTranscript || transcript}
                    </div>
                  </div>
                ) : vivaEvaluation ? (
                  /* Viva Scorecard */
                  <div className="bg-slate-900/90 border border-purple-700/60 rounded-2xl p-4 w-full text-left shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500 flex items-center justify-center text-purple-300 font-bold text-sm">
                          {vivaEvaluation.overallScore}%
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            Feynman Oral Score
                          </div>
                          <div className="text-[11px] text-purple-300 font-medium">
                            +{vivaEvaluation.pointsAwarded} XP Earned • Concept Mastery: {vivaEvaluation.newMasteryScore}%
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchVivaQuestion(activeProjectId)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Sub-scores */}
                    <div className="grid grid-cols-3 gap-2 my-3">
                      <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/60">
                        <div className="text-[10px] text-slate-400">Intuition</div>
                        <div className="text-xs font-bold text-emerald-400">{vivaEvaluation.intuitionScore}%</div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/60">
                        <div className="text-[10px] text-slate-400">Accuracy</div>
                        <div className="text-xs font-bold text-cyan-400">{vivaEvaluation.accuracyScore}%</div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/60">
                        <div className="text-[10px] text-slate-400">Clarity</div>
                        <div className="text-xs font-bold text-purple-400">{vivaEvaluation.clarityScore}%</div>
                      </div>
                    </div>

                    {/* Verbal feedback */}
                    <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                      {vivaEvaluation.verbalFeedback}
                    </p>
                  </div>
                ) : currentResponse ? (
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 w-full text-left shadow-lg animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5" /> Spoken Explanation
                      </span>
                      {currentCitations.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {currentCitations.length} Citations
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed line-clamp-4">
                      {currentResponse}
                    </p>

                    {/* Citations Footer */}
                    {currentCitations.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                        {currentCitations.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/70 text-indigo-300 border border-indigo-800/50"
                          >
                            <BookOpen className="w-2.5 h-2.5" />
                            {c.title} • P.{c.pageNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : errorMessage ? (
                  <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300 w-full">
                    {errorMessage}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                      "Explain the key concepts",
                      "Summarize my uploaded notes",
                      "What are the main formulas?",
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleProcessQuestion(prompt)}
                        className="text-xs px-3 py-1.5 rounded-full bg-slate-800/70 hover:bg-slate-700 border border-slate-700/80 text-slate-300 transition-colors cursor-pointer"
                      >
                        &ldquo;{prompt}&rdquo;
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls Bar */}
        <div className="relative z-10 px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          {/* Mute toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isMuted
                ? "bg-rose-950/60 border-rose-800 text-rose-300"
                : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
          </button>

          {/* Center: Interrupt or Talk Now */}
          {status === "speaking" ? (
            <button
              type="button"
              onClick={() => {
                cancelSpeech();
                startListening();
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Tap to Interrupt</span>
            </button>
          ) : status === "listening" ? (
            <button
              type="button"
              onClick={() => {
                const current = interimTranscript || transcript;
                if (current.trim().length > 1) {
                  handleProcessQuestion(current.trim());
                } else {
                  stopListening();
                }
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/40 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{voiceMode === "VIVA" ? "Submit Oral Explanation" : "Ask AI Tutor"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startListening()}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition-colors cursor-pointer ${
                voiceMode === "VIVA"
                  ? "bg-purple-600 hover:bg-purple-500 shadow-purple-900/40"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{voiceMode === "VIVA" ? "Teach the AI (Speak)" : "Start Speaking"}</span>
            </button>
          )}

          {/* Replay last answer */}
          <button
            type="button"
            disabled={!currentResponse}
            onClick={() => {
              if (currentResponse) speak(currentResponse);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Replay last answer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Replay</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
