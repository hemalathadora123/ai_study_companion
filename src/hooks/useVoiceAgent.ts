"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createSpeechRecognizer,
  getRecommendedVoices,
  speakText,
  stopSpeaking,
  unlockAudio,
} from "@/lib/voice/speechService";

export type VoiceAgentStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

interface UseVoiceAgentOptions {
  onQuestionReady?: (question: string) => void;
  autoSpeakResponses?: boolean;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognizerRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load available speech synthesis voices, defaulting to the first LOCAL reliable voice
  useEffect(() => {
    let active = true;
    getRecommendedVoices().then((voices) => {
      if (active) {
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoice) {
          // Select the first local, non-online voice as the default
          const bestLocal = voices.find(
            (v) => v.localService && !v.name.toLowerCase().includes("online")
          ) || voices[0];
          setSelectedVoice(bestLocal);
        }
      }
    });
    return () => {
      active = false;
      stopSpeaking();
    };
  }, []);

  // Simulate subtle audio wave level fluctuations when listening or speaking
  useEffect(() => {
    if (status === "listening" || status === "speaking") {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.7 + 0.3);
      }, 150);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [status]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {}
      recognizerRef.current = null;
    }
    if (status === "listening") {
      setStatus("idle");
    }
  }, [status]);

  const startListening = useCallback(() => {
    if (isMuted) return;
    // Unlock browser audio context on user gesture
    unlockAudio();
    stopSpeaking();
    setErrorMessage(null);

    if (!isSpeechRecognitionSupported()) {
      setErrorMessage("Speech recognition is not supported in this browser. You can type your questions and listen to spoken answers!");
      setStatus("error");
      return;
    }

    try {
      if (recognizerRef.current) {
        try { recognizerRef.current.abort(); } catch {}
      }

      const recognizer = createSpeechRecognizer({
        continuous: false,
        onStart: () => {
          setStatus("listening");
          setTranscript("");
          setInterimTranscript("");
        },
        onResult: (text, isFinal) => {
          setInterimTranscript(text);

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          if (isFinal) {
            setTranscript(text);
            setInterimTranscript("");
            stopListening();
            if (options.onQuestionReady && text.trim().length > 1) {
              options.onQuestionReady(text.trim());
            }
          } else {
            // If user pauses speaking for 1.8 seconds, treat as finished turn in continuous mode
            silenceTimerRef.current = setTimeout(() => {
              if (text.trim().length > 1) {
                setTranscript(text);
                setInterimTranscript("");
                stopListening();
                if (options.onQuestionReady) {
                  options.onQuestionReady(text.trim());
                }
              }
            }, 1800);
          }
        },
        onError: (err) => {
          if (err.includes("no-speech")) {
            setStatus("idle");
            return;
          }
          setErrorMessage(err);
          setStatus("error");
        },
        onEnd: () => {
          if (status === "listening") {
            setStatus("idle");
          }
        },
      });

      if (recognizer) {
        recognizerRef.current = recognizer;
        recognizer.start();
      }
    } catch (err: any) {
      console.warn("Failed to start speech recognizer:", err);
      setErrorMessage(err.message || "Failed to start microphone.");
      setStatus("error");
    }
  }, [isMuted, options, stopListening, status]);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      stopListening();
      setStatus("speaking");
      setErrorMessage(null);

      speakText(text, {
        voice: selectedVoice,
        rate: speechRate,
        onStart: () => {
          setStatus("speaking");
        },
        onEnd: () => {
          setStatus("idle");
          onDone?.();
          // In continuous mode, after AI finishes speaking, resume listening for the next student question
          if (continuousMode && !isMuted) {
            setTimeout(() => {
              startListening();
            }, 600);
          }
        },
        onError: (err) => {
          console.warn("Speech synthesis error occurred in speak callback:", err);
          setStatus("idle");
        },
      });
    },
    [continuousMode, isMuted, selectedVoice, speechRate, startListening, stopListening]
  );

  const cancelSpeech = useCallback(() => {
    stopSpeaking();
    setStatus("idle");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopListening();
        stopSpeaking();
        setStatus("idle");
      }
      return next;
    });
  }, [stopListening]);

  const testVoice = useCallback(() => {
    unlockAudio();
    speak("Hello! I am your AI study companion. Your audio is working properly.");
  }, [speak]);

  return {
    status,
    setStatus,
    transcript,
    interimTranscript,
    isListening: status === "listening",
    isSpeaking: status === "speaking",
    isThinking: status === "thinking",
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
    setErrorMessage,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    toggleMute,
    testVoice,
    unlockAudio,
    isRecognitionSupported: isSpeechRecognitionSupported(),
    isSynthesisSupported: isSpeechSynthesisSupported(),
  };
}
