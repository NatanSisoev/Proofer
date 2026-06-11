"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MathText from "./MathText";

type Card = {
  id: string;
  title: string;
  type: string | null;
  area: string | null;
  overview: string | null;
  content: string | null;
  mastery_p: number;
};

const CONTENT_PREVIEW = 400; // chars to show on back

function stripMarkdown(s: string): string {
  return s
    .replace(/\[\[([^\]]+)\]\]/g, "$1")       // wikilinks
    .replace(/\*\*([^*]+)\*\*/g, "$1")         // bold
    .replace(/\*([^*]+)\*/g, "$1")             // italic
    .replace(/^#+\s+/gm, "")                   // headings
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .trim();
}

function getBack(card: Card): string {
  const src = card.overview || card.content || "";
  const stripped = stripMarkdown(src);
  return stripped.length > CONTENT_PREVIEW
    ? stripped.slice(0, CONTENT_PREVIEW) + "…"
    : stripped;
}

export default function FlashCards({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(() => shuffle([...initialCards]));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [done, setDone] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [missedCards, setMissedCards] = useState<Card[]>([]);

  const current = cards[index];
  const total = cards.length;

  const markKnown = useCallback(async (id: string) => {
    await fetch("/api/known", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, known: true }),
    });
  }, []);

  function advance(wasKnown: boolean) {
    if (wasKnown) {
      setKnown((k) => k + 1);
      markKnown(current.id);
    } else {
      setUnknown((u) => u + 1);
      setMissedCards((prev) => [...prev, current]);
    }
    setSeenIds((prev) => [...prev, current.id]);
    setFlipped(false);
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (done) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        else advance(true);
      }
      if (e.key === "ArrowRight") { if (flipped) advance(true); }
      if (e.key === "ArrowLeft") { if (flipped) advance(false); }
      if (e.key === "f" || e.key === "F") { if (!flipped) setFlipped(true); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (cards.length === 0) {
    return (
      <div className="wrap" style={{ textAlign: "center", paddingTop: 60 }}>
        <p className="muted">No cards available. Practice some concepts first to build your deck.</p>
        <Link href="/" className="cta" style={{ display: "inline-block", marginTop: 16 }}>← Home</Link>
      </div>
    );
  }

  if (done) {
    const total2 = known + unknown;
    const pct = total2 > 0 ? Math.round((known / total2) * 100) : 0;
    return (
      <div className="wrap" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="panel" style={{ textAlign: "center", padding: "36px 28px" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>
            {pct === 100 ? "Perfect round!" : "Round complete"}
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
            {known} known · {unknown} not yet · {pct}% recall
          </p>
          <div className="bar" style={{ height: 8, marginBottom: 24 }}>
            <span style={{ width: `${pct}%`, background: pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)" }} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {missedCards.length > 0 && (
              <button
                className="btn-primary"
                onClick={() => {
                  setCards(shuffle([...missedCards]));
                  setIndex(0);
                  setFlipped(false);
                  setKnown(0);
                  setUnknown(0);
                  setDone(false);
                  setSeenIds([]);
                  setMissedCards([]);
                }}
              >
                Retry {missedCards.length} missed →
              </button>
            )}
            <Link href="/session" className="btn-primary" style={{ textDecoration: "none" }}>
              Full practice session →
            </Link>
            <Link href="/" className="btn-ghost" style={{ textDecoration: "none" }}>
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const back = getBack(current);
  const progress = index / total;

  return (
    <div className="wrap" style={{ maxWidth: 580, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.02em" }}>Flashcards</h1>
          <span className="muted small">{index + 1} / {total}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {known > 0 && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ {known}</span>}
          {unknown > 0 && <span style={{ fontSize: 12, color: "var(--red)" }}>✗ {unknown}</span>}
          <Link href="/" className="btn-ghost" style={{ fontSize: 13, padding: "4px 10px" }}>Quit</Link>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bar" style={{ height: 4, marginBottom: 24 }}>
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {/* Card */}
      <div
        style={{
          perspective: 1000,
          marginBottom: 24,
          cursor: flipped ? "default" : "pointer",
        }}
        onClick={() => { if (!flipped) setFlipped(true); }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 220,
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Front */}
          <div
            className="panel"
            style={{
              position: flipped ? "absolute" : "relative",
              inset: 0,
              backfaceVisibility: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "32px 24px",
              minHeight: 220,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
              {current.type && <span className={`type-badge t-${current.type}`}>{current.type}</span>}
              {current.area && <span className="muted small">{current.area}</span>}
            </div>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              <MathText>{current.title}</MathText>
            </h2>
            <div className="bar" style={{ width: 80, height: 4, marginBottom: 16 }}>
              <span style={{ width: `${Math.round(current.mastery_p * 100)}%` }} />
            </div>
            <span className="muted small" style={{ fontSize: 12 }}>
              Click or press Space to reveal
            </span>
          </div>

          {/* Back */}
          <div
            className="panel"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              minHeight: 220,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {current.type && <span className={`type-badge t-${current.type}`}>{current.type}</span>}
              <span style={{ fontWeight: 600, fontSize: 15 }}><MathText>{current.title}</MathText></span>
            </div>
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>
              {back ? <MathText>{back}</MathText> : <span className="muted">No definition yet.</span>}
            </div>
            <div style={{ marginTop: 12 }}>
              <Link
                href={`/node/${encodeURIComponent(current.id)}`}
                target="_blank"
                className="muted small"
                style={{ fontSize: 11 }}
              >
                Full note ↗
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {flipped ? (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn-ghost"
            onClick={() => advance(false)}
            style={{ flex: 1, padding: "12px", fontSize: 14, color: "var(--red)" }}
          >
            ← Not yet
          </button>
          <button
            className="btn-primary"
            onClick={() => advance(true)}
            style={{ flex: 1, padding: "12px", fontSize: 14 }}
          >
            Know it ✓
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="btn-primary"
            onClick={() => setFlipped(true)}
            style={{ padding: "12px 32px", fontSize: 15 }}
          >
            Flip ↓
          </button>
        </div>
      )}

      {/* Keyboard hint */}
      <p className="muted small" style={{ textAlign: "center", marginTop: 16, fontSize: 11 }}>
        Space = flip · → know · ← not yet
      </p>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
