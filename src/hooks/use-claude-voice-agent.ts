"use client";

import { useEffect, useRef } from "react";

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEvent {
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useClaudeVoiceAgent(meetingId: string, enabled: boolean) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakingRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SR) {
      console.warn("[claude-voice] SpeechRecognition not supported. Use Chrome or Edge.");
      return;
    }

    stoppedRef.current = false;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-IN";

    const safeStart = () => {
      if (stoppedRef.current) return;
      try {
        rec.start();
      } catch (err) {
        console.warn("[claude-voice] start() threw, retrying in 500ms", err);
        setTimeout(safeStart, 500);
      }
    };

    rec.onstart = () => console.log("[claude-voice] listening…");

    rec.onresult = async (e) => {
      const last = e.results[e.results.length - 1];
      if (!last?.isFinal) return;
      const userText = last[0].transcript.trim();
      if (!userText) return;
      if (speakingRef.current) return;

      console.log("[claude-voice] heard:", userText);

      try {
        const res = await fetch("/api/agent-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId, userText }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error("[claude-voice] /api/agent-chat", res.status, body);
          return;
        }
        const { text } = (await res.json()) as { text: string };
        if (!text) {
          console.warn("[claude-voice] empty reply from Claude");
          return;
        }

        console.log("[claude-voice] saying:", text);
        speakingRef.current = true;
        try {
          rec.stop();
        } catch {}
        const spoken = text
          .replace(/```[\s\S]*?```/g, "")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/^#+\s*/gm, "")
          .replace(/^[-*+]\s+/gm, "")
          .replace(/\n+/g, ". ")
          .replace(/\s+/g, " ")
          .trim();
        const utter = new SpeechSynthesisUtterance(spoken);
        utter.onend = () => {
          speakingRef.current = false;
          safeStart();
        };
        utter.onerror = () => {
          speakingRef.current = false;
          safeStart();
        };
        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.error("[claude-voice] fetch failed", err);
      }
    };

    rec.onerror = (err) => {
      console.warn("[claude-voice] recognition error", err);
    };
    rec.onend = () => {
      console.log("[claude-voice] ended");
      if (!speakingRef.current) safeStart();
    };

    recognitionRef.current = rec;
    safeStart();

    return () => {
      stoppedRef.current = true;
      try {
        rec.stop();
      } catch {}
      window.speechSynthesis.cancel();
    };
  }, [meetingId, enabled]);
}
