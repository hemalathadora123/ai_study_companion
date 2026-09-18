/**
 * Speech Recognition and Speech Synthesis Utilities for the AI Study Companion.
 * Uses the native Web Speech API for zero-latency, private, client-side voice interaction.
 */

// Declare Web Speech API types for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    _activeVoiceUtterance: any;
    _activeVoiceHeartbeat: any;
  }
}

/**
 * Clean and convert markdown and LaTeX text into natural spoken English.
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Convert Math & LaTeX to spoken English equivalents
  cleaned = cleaned
    // \sqrt{d_k} -> square root of d sub k
    .replace(/\\sqrt\{([^}]+)\}/g, "square root of $1")
    .replace(/\\sqrt\s*([a-zA-Z0-9_]+)/g, "square root of $1")
    // \frac{a}{b} -> a over b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2")
    // d_k or W^O -> d sub k, W to the O
    .replace(/([a-zA-Z])_([a-zA-Z0-9]+)/g, "$1 sub $2")
    .replace(/([a-zA-Z])\^([a-zA-Z0-9]+)/g, "$1 to the power of $2")
    // Calculus & common math symbols
    .replace(/\\Delta\s*([a-zA-Z0-9])/g, "delta $1")
    .replace(/\\int/g, "the integral of ")
    .replace(/\\to/g, " approaches ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\times/g, " times ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\approx/g, " approximately equals ")
    .replace(/\\le/g, " is less than or equal to ")
    .replace(/\\ge/g, " is greater than or equal to ")
    .replace(/\\neq/g, " does not equal ")
    .replace(/\\infty/g, " infinity ")
    .replace(/\\pi/g, " pi ");

  // 2. Remove math dollar signs $...$ and $$...$$
  cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, "$1").replace(/\$([^$]+)\$/g, "$1");

  // 3. Remove markdown headers, bold, italics, code blocks
  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, "code block omitted")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");

  // 4. Remove emojis or special presentation icons like 💡, 🔍, 🎯, 👋
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");

  // 5. Handle source citations: "Source: Book Title — Page 4" -> "According to Book Title, page 4."
  cleaned = cleaned.replace(
    /Source:\s*([^\n—]+)—\s*Page\s*(\d+)/gi,
    "According to $1, page $2."
  );

  // 6. Clean bullets, multiple spaces, extra newlines
  cleaned = cleaned
    .replace(/^[\*\-•]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

/**
 * Checks if browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Checks if browser supports Speech Synthesis
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean("speechSynthesis" in window && window.speechSynthesis);
}

/**
 * Unlocks browser audio context and speech engine on user gesture
 */
export function unlockAudio() {
  if (!isSpeechSynthesisSupported()) return;
  try {
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
    }
    // Micro-utterance during click to prime browser autoplay permissions
    const dummy = new SpeechSynthesisUtterance(" ");
    dummy.volume = 0.01;
    synth.speak(dummy);
  } catch {}
}

export interface RecognitionOptions {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  continuous?: boolean;
  lang?: string;
}

/**
 * Creates and starts a SpeechRecognition instance
 */
export function createSpeechRecognizer(options: RecognitionOptions) {
  if (!isSpeechRecognitionSupported()) {
    options.onError?.("Speech recognition is not supported in this browser.");
    return null;
  }

  const SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = true;
  recognition.lang = options.lang || "en-US";

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const currentText = finalTranscript || interimTranscript;
    const isFinal = Boolean(finalTranscript && !interimTranscript);
    options.onResult?.(currentText, isFinal);
  };

  recognition.onerror = (event: any) => {
    let errorMsg = event.error || "Unknown speech recognition error";
    if (event.error === "not-allowed") {
      errorMsg = "Microphone access was denied. Please allow microphone permission in your browser settings.";
    } else if (event.error === "no-speech") {
      errorMsg = "No speech detected. Please speak clearly into your microphone.";
    }
    options.onError?.(errorMsg);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  return recognition;
}

/**
 * Get available high-quality English voices, prioritizing LOCAL stable voices.
 * Crucial: Windows Edge lists "Online (Natural)" voices that FAIL in Google Chrome with network error.
 * Prioritizing localService voices ensures 100% audio playback across all browsers.
 */
export function getRecommendedVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;

    function populate() {
      const allVoices = synth.getVoices();
      if (!allVoices || allVoices.length === 0) {
        return;
      }

      const englishVoices = allVoices.filter((v) =>
        v.lang && v.lang.toLowerCase().startsWith("en")
      );
      const pool = englishVoices.length > 0 ? englishVoices : allVoices;

      // Sort with LOCAL installed voices first to guarantee audio works in all browsers
      const prioritized = [...pool].sort((a, b) => {
        // Strongly prefer localService voices (Microsoft David, Zira, Google US English, Samantha)
        const aLocal = a.localService ? 20 : 0;
        const bLocal = b.localService ? 20 : 0;

        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Deprioritize remote "online" voices in non-Edge browsers as they throw SpeechSynthesisErrorEvent
        const aOnlinePenalty = aName.includes("online") ? -10 : 0;
        const bOnlinePenalty = bName.includes("online") ? -10 : 0;

        const aScore =
          aLocal +
          aOnlinePenalty +
          (a.default ? 5 : 0) +
          (aName.includes("google") ? 4 : 0) +
          (aName.includes("david") || aName.includes("zira") || aName.includes("samantha") ? 3 : 0);

        const bScore =
          bLocal +
          bOnlinePenalty +
          (b.default ? 5 : 0) +
          (bName.includes("google") ? 4 : 0) +
          (bName.includes("david") || bName.includes("zira") || bName.includes("samantha") ? 3 : 0);

        return bScore - aScore;
      });

      resolve(prioritized);
    }

    if (synth.getVoices().length > 0) {
      populate();
    } else {
      synth.onvoiceschanged = () => {
        populate();
      };
      setTimeout(populate, 600);
    }
  });
}

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number; // 0.8 to 1.5
  pitch?: number; // 0.8 to 1.2
  volume?: number; // 0 to 1
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, word: string) => void;
  onError?: (err: any) => void;
}

/**
 * Speaks given text with full resilience:
 * 1. Unfreezes synth.paused state (Chromium bug)
 * 2. Retains utterance reference on window to prevent V8 Garbage Collection
 * 3. Splits long text into chunks so Chromium does not timeout after 15s
 * 4. Automatic fallback to system default voice if a custom voice errors
 */
export function speakText(text: string, options: SpeakOptions = {}): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.("Speech synthesis is not supported in this browser.");
    return null;
  }

  const synth = window.speechSynthesis;

  // Clear any existing heartbeat interval
  if (typeof window !== "undefined" && window._activeVoiceHeartbeat) {
    clearInterval(window._activeVoiceHeartbeat);
    window._activeVoiceHeartbeat = null;
  }

  // Always resume if paused
  try {
    if (synth.paused) {
      synth.resume();
    }
    synth.cancel();
  } catch {}

  const spokenText = sanitizeTextForSpeech(text);
  if (!spokenText.trim()) {
    options.onEnd?.();
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(spokenText);

  // Store on window to PREVENT GARBAGE COLLECTION BUG in Chrome/Edge V8 engine
  if (typeof window !== "undefined") {
    window._activeVoiceUtterance = utterance;
  }

  // Assign voice safely (if selected voice is local, use it; otherwise allow system default)
  if (options.voice && !options.voice.name.toLowerCase().includes("online")) {
    utterance.voice = options.voice;
    utterance.lang = options.voice.lang || "en-US";
  } else {
    utterance.lang = "en-US";
  }

  utterance.rate = Math.max(0.7, Math.min(1.8, options.rate ?? 1.0));
  utterance.pitch = Math.max(0.8, Math.min(1.3, options.pitch ?? 1.0));
  utterance.volume = options.volume ?? 1.0;

  function cleanup() {
    if (typeof window !== "undefined") {
      if (window._activeVoiceHeartbeat) {
        clearInterval(window._activeVoiceHeartbeat);
        window._activeVoiceHeartbeat = null;
      }
      window._activeVoiceUtterance = null;
    }
  }

  utterance.onstart = () => {
    // Chromium 15-second bug fix: keep synth alive during long speech
    if (typeof window !== "undefined") {
      window._activeVoiceHeartbeat = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }
    options.onStart?.();
  };

  utterance.onend = () => {
    cleanup();
    options.onEnd?.();
  };

  let hasRetried = false;

  utterance.onerror = (e: any) => {
    const errorType = e.error || "unknown";

    // If canceled manually by user, ignore
    if (errorType === "canceled" || errorType === "interrupted") {
      cleanup();
      options.onEnd?.();
      return;
    }

    console.warn(`Speech synthesis error (${errorType}). Retrying with default voice...`);

    // Automatic fallback: If custom voice failed, retry with browser default voice
    if (!hasRetried) {
      hasRetried = true;
      try {
        if (synth.paused) synth.resume();
        const fallbackUtterance = new SpeechSynthesisUtterance(spokenText);
        if (typeof window !== "undefined") {
          window._activeVoiceUtterance = fallbackUtterance;
        }
        fallbackUtterance.rate = utterance.rate;
        fallbackUtterance.pitch = utterance.pitch;
        fallbackUtterance.volume = 1.0;
        fallbackUtterance.lang = "en-US";

        fallbackUtterance.onstart = () => {
          options.onStart?.();
        };
        fallbackUtterance.onend = () => {
          cleanup();
          options.onEnd?.();
        };
        fallbackUtterance.onerror = (retryErr: any) => {
          cleanup();
          console.warn("Speech synthesis fallback also failed:", retryErr.error || retryErr);
          options.onError?.(retryErr);
        };

        synth.speak(fallbackUtterance);
        return;
      } catch (retryErr) {
        console.warn("Fallback exception:", retryErr);
      }
    }

    cleanup();
    options.onError?.(e);
  };

  if (options.onBoundary) {
    utterance.onboundary = (event) => {
      const charIndex = event.charIndex;
      const word = spokenText.slice(charIndex, charIndex + (event.charLength || 10));
      options.onBoundary?.(charIndex, word);
    };
  }

  // Small delay to ensure any previous speech cancel settles
  setTimeout(() => {
    try {
      if (synth.paused) {
        synth.resume();
      }
      synth.speak(utterance);
    } catch (err) {
      console.warn("Failed to invoke synth.speak:", err);
      options.onError?.(err);
    }
  }, 60);

  return utterance;
}

/**
 * Stops any active speech synthesis
 */
export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      if (typeof window !== "undefined" && window._activeVoiceHeartbeat) {
        clearInterval(window._activeVoiceHeartbeat);
        window._activeVoiceHeartbeat = null;
      }
      window.speechSynthesis.cancel();
      if (typeof window !== "undefined") {
        window._activeVoiceUtterance = null;
      }
    } catch {}
  }
}
