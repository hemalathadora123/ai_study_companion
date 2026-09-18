"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  Plus,
  BookOpen,
  ShieldAlert,
  Brain,
  ChevronDown,
  AlertCircle,
  Sparkles,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Headphones,
} from "lucide-react";
import {
  speakText,
  stopSpeaking,
  unlockAudio,
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
} from "@/lib/voice/speechService";
import VoiceAgentModal from "@/components/voice/VoiceAgentModal";
import PointsToast from "@/components/rewards/PointsToast";

interface Citation {
  materialId: string;
  title: string;
  pageNumber: number;
  snippet?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citationsJson?: string | null;
  isUngrounded: boolean;
  latencyMs?: number | null;
  tokenCount?: number | null;
}

interface Conversation {
  id: string;
  title: string;
}

interface TutorChatProps {
  projectId: string;
  projectName: string;
  learningGoal: string;
}

export default function TutorChat({
  projectId,
  projectName,
  learningGoal,
}: TutorChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [citationDetail, setCitationDetail] = useState<Citation | null>(null);

  // Voice state
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isListeningInput, setIsListeningInput] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoReadResponses, setAutoReadResponses] = useState(false);
  const [rewardToast, setRewardToast] = useState<{ points: number; reason: string } | null>(null);
  const recognizerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    setInitLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/conversations`);
      const data = await res.json();
      const convs: Conversation[] = data.conversations || [];
      setConversations(convs);
      if (convs.length > 0) {
        await selectConversation(convs[0]);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setInitLoading(false);
    }
  }

  async function selectConversation(conv: Conversation) {
    setActiveConversation(conv);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages(data.conversation?.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  async function startNewSession() {
    try {
      const res = await fetch(`/api/projects/${projectId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Session ${conversations.length + 1}` }),
      });
      const data = await res.json();
      if (data.conversation) {
        const newConv = data.conversation;
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversation(newConv);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || !activeConversation) return;

    // Unlock browser audio context on user action
    unlockAudio();

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
      isUngrounded: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input.trim();
    setInput("");
    setLoading(true);

    // Optimistic loader assistant message
    const loadingMsg: Message = {
      id: "loading",
      role: "assistant",
      content: "...",
      isUngrounded: false,
    };
    setMessages((prev) => [...prev, loadingMsg]);

    try {
      const res = await fetch(
        `/api/conversations/${activeConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: data.messageId,
        role: "assistant",
        content: data.content,
        citationsJson: JSON.stringify(data.citations),
        isUngrounded: data.isUngrounded,
        latencyMs: data.latencyMs,
        tokenCount: data.tokensUsed,
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        assistantMessage,
      ]);

      if (data.pointsAwarded && data.pointsAwarded > 0) {
        setRewardToast({
          points: data.pointsAwarded,
          reason: "Tutor Inquiry Answered! 🎓",
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("points-updated"));
        }
      }

      if (autoReadResponses && data.content) {
        setSpeakingMessageId(data.messageId);
        speakText(data.content, {
          onEnd: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "loading"),
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error processing your question. Please try again.",
          isUngrounded: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function parseCitations(citationsJson?: string | null): Citation[] {
    if (!citationsJson) return [];
    try {
      return JSON.parse(citationsJson) as Citation[];
    } catch {
      return [];
    }
  }

  if (initLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">AI Study Tutor</h3>
            <p className="text-[11px] text-slate-400 max-w-xs truncate">
              Grounded in: {projectName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Session Switcher */}
          {conversations.length > 0 && (
            <select
              value={activeConversation?.id || ""}
              onChange={(e) => {
                const conv = conversations.find((c) => c.id === e.target.value);
                if (conv) selectConversation(conv);
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          {/* Auto-read toggle */}
          <button
            type="button"
            onClick={() => {
              if (autoReadResponses) {
                stopSpeaking();
                setSpeakingMessageId(null);
              }
              setAutoReadResponses(!autoReadResponses);
            }}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              autoReadResponses
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600"
            }`}
            title={autoReadResponses ? "Auto-speak answers is ON" : "Auto-speak answers is OFF"}
          >
            {autoReadResponses ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Live Voice Companion Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-2xs transition-all cursor-pointer"
            title="Open Live Interactive Voice Companion"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice Mode</span>
          </button>

          <button
            onClick={startNewSession}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Learning Goal Strip */}
      <div className="px-5 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <p className="text-[11px] text-indigo-800 font-medium truncate">
          Goal: {learningGoal}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!activeConversation ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800">Start Your Learning Session</h4>
            <p className="text-xs text-slate-500 max-w-xs">
              The AI Tutor will answer your questions strictly from the project documents you have uploaded.
            </p>
            <button
              onClick={startNewSession}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Begin Session
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Session Ready</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Ask any question about your course materials. I'll explain concepts step-by-step like a teacher with intuitive analogies.
              </p>
            </div>
            {/* Suggested Starters */}
            <div className="w-full max-w-sm space-y-2">
              {(() => {
                const isCalc =
                  projectName.toLowerCase().includes("calculus") ||
                  projectName.toLowerCase().includes("mitres") ||
                  learningGoal.toLowerCase().includes("calculus") ||
                  learningGoal.toLowerCase().includes("differentiat");
                const isAttention =
                  projectName.toLowerCase().includes("attention") ||
                  projectName.toLowerCase().includes("transformer") ||
                  learningGoal.toLowerCase().includes("attention");

                const starters = isCalc
                  ? [
                      "Find the derivative of the function f(x) = 3x2 + 4x - 2",
                      "Explain differentiation like a teacher",
                      "What is the difference between differential and integral calculus?",
                    ]
                  : isAttention
                  ? [
                      "Explain the self-attention mechanism like a teacher",
                      "Why do we scale by 1/sqrt(dk)?",
                      "What are positional encodings?",
                    ]
                  : [
                      `Explain the core intuition of ${projectName}`,
                      `What are the most important concepts to understand here?`,
                      `Can you walk me through this step-by-step?`,
                    ];

                return starters.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-xs text-slate-700 transition-all"
                  >
                    "{q}"
                  </button>
                ));
              })()}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const citations = parseCitations(msg.citationsJson);
            const isLoading = msg.id === "loading";

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] space-y-2 ${
                    msg.role === "user"
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  {/* Role Label */}
                  <div
                    className={`text-[11px] font-semibold mb-1 ${
                      msg.role === "user"
                        ? "text-right text-indigo-600"
                        : "text-slate-400"
                    }`}
                  >
                    {msg.role === "user" ? "You" : "🤖 AI Study Tutor"}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm"
                        : msg.isUngrounded
                        ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-xs"
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching project materials...
                      </span>
                    ) : (
                      <>
                        {msg.isUngrounded && (
                          <div className="flex items-start gap-2 mb-2 pb-2 border-b border-amber-200">
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                              Insufficient Evidence — Not Grounded
                            </span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </>
                    )}
                  </div>

                  {/* Citations & Voice Speaker */}
                  <div className="flex items-center justify-between pt-1">
                    {citations.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {citations.map((citation, ci) => (
                          <button
                            key={ci}
                            onClick={() => setCitationDetail(citation)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors text-[11px] font-semibold text-indigo-700 cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            {citation.title} — Page {citation.pageNumber}
                          </button>
                        ))}
                      </div>
                    ) : <div />}

                    {/* Read Aloud Audio Button for Assistant */}
                    {msg.role === "assistant" && !isLoading && (
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio();
                          if (speakingMessageId === msg.id) {
                            stopSpeaking();
                            setSpeakingMessageId(null);
                          } else {
                            setSpeakingMessageId(msg.id);
                            speakText(msg.content, {
                              onEnd: () => setSpeakingMessageId(null),
                              onError: () => setSpeakingMessageId(null),
                            });
                          }
                        }}
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
                          speakingMessageId === msg.id
                            ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                        }`}
                        title={speakingMessageId === msg.id ? "Stop reading" : "Read explanation aloud"}
                      >
                        {speakingMessageId === msg.id ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Telemetry hint for assistant */}
                  {msg.role === "assistant" && !isLoading && msg.latencyMs && (
                    <div className="text-[10px] text-slate-300 pl-1">
                      {msg.latencyMs}ms · {msg.tokenCount || 0} tokens
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {activeConversation && (
        <div className="px-4 py-3 bg-white border-t border-slate-200">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListeningInput ? "Listening to your voice... Speak now..." : "Ask a question about your course materials... (Enter to send)"}
              rows={2}
              disabled={loading}
              className={`flex-1 resize-none px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 bg-white disabled:opacity-60 ${
                isListeningInput ? "border-cyan-400 ring-2 ring-cyan-200" : "border-slate-300"
              }`}
            />

            {/* Microphone Dictation Button */}
            <button
              type="button"
              onClick={() => {
                if (isListeningInput) {
                  if (recognizerRef.current) {
                    try { recognizerRef.current.stop(); } catch {}
                    recognizerRef.current = null;
                  }
                  setIsListeningInput(false);
                } else {
                  if (!isSpeechRecognitionSupported()) {
                    alert("Speech recognition is not supported in this browser.");
                    return;
                  }
                  try {
                    const recognizer = createSpeechRecognizer({
                      onStart: () => setIsListeningInput(true),
                      onResult: (text) => setInput(text),
                      onError: (err) => {
                        console.warn("Speech input error:", err);
                        setIsListeningInput(false);
                      },
                      onEnd: () => setIsListeningInput(false),
                    });
                    if (recognizer) {
                      recognizerRef.current = recognizer;
                      recognizer.start();
                    }
                  } catch (err) {
                    console.error("Failed to start speech input:", err);
                    setIsListeningInput(false);
                  }
                }
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                isListeningInput
                  ? "bg-cyan-500 border-cyan-600 text-white animate-pulse shadow-md shadow-cyan-200"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-600 hover:text-indigo-600"
              }`}
              title={isListeningInput ? "Click to stop dictation" : "Dictate with voice"}
            >
              {isListeningInput ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 pl-1">
            Concepts explained like a teacher with analogies and step-by-step clarity · Grounded in course documents
          </p>
        </div>
      )}

      {/* Citation Detail Modal */}
      {citationDetail && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs rounded-2xl">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900 text-sm">Source Citation</span>
              </div>
              <button
                onClick={() => setCitationDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{citationDetail.title}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Page</div>
                <div className="text-sm text-indigo-700 font-bold mt-0.5">Page {citationDetail.pageNumber}</div>
              </div>
              {citationDetail.snippet && (
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Relevant Excerpt</div>
                  <p className="text-xs text-slate-700 mt-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono leading-relaxed">
                    "{citationDetail.snippet}..."
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setCitationDetail(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Voice Companion Modal */}
      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        learningGoal={learningGoal}
      />

      {/* Gamification Points Toast */}
      {rewardToast && (
        <PointsToast
          points={rewardToast.points}
          reason={rewardToast.reason}
          onDismiss={() => setRewardToast(null)}
        />
      )}
    </div>
  );
}
