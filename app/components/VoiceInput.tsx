"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  lang?: string;
};

type SpeechRecognitionEvent = {
  results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean } };
  resultIndex: number;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export default function VoiceInput({ onTranscript, disabled, lang = "en-US" }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recognizerRef = useRef<SpeechRecognitionInstance | null>(null);
  // Keep a stable ref to onTranscript so we don't recreate the recognizer on each render.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onstart = () => { setListening(true); setError(null); };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < Object.keys(e.results).length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText) { onTranscriptRef.current(finalText); setInterim(""); }
      else setInterim(interimText);
    };

    rec.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed") setError("Microphone access denied — check browser permissions");
      else if (e.error !== "aborted") setError(`Speech error: ${e.error}`);
      setListening(false);
      setInterim("");
    };

    rec.onend = () => { setListening(false); setInterim(""); };

    recognizerRef.current = rec;
    return () => { rec.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  function toggle() {
    const rec = recognizerRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); }
    else {
      setError(null);
      try { rec.start(); } catch { /* already started */ }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={listening ? "Stop recording" : "Speak your answer"}
        style={{
          background: listening ? "var(--red-soft)" : "var(--bg-soft)",
          border: `1px solid ${listening ? "var(--red)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "10px 14px",
          cursor: "pointer",
          color: listening ? "var(--red)" : "var(--muted)",
          fontSize: 18,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.15s",
          animation: listening ? "micPulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        🎤
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
          {listening ? "Stop" : "Speak"}
        </span>
      </button>

      {interim && (
        <span style={{
          fontSize: 12, color: "var(--muted)", fontStyle: "italic",
          padding: "4px 8px", background: "var(--bg-soft)", borderRadius: 6,
          maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {interim}…
        </span>
      )}

      {error && (
        <span style={{ fontSize: 12, color: "var(--red)" }}>{error}</span>
      )}
    </div>