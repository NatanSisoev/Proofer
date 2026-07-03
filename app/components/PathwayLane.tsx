"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Pathway, PathwayUnit, PathwayStep } from "@/lib/pathway";
import MathText from "./MathText";
import { ArrowRight, Check, Lock, Sparkles } from "./Icons";

const Markdown = dynamic(() => import("./Markdown"));

type ReadStep = Extract<PathwayStep, { kind: "read" }>;
type QuizStep = Extract<PathwayStep, { kind: "quiz" }>;

export default function PathwayLane({ pathway }: { pathway: Pathway }) {
  const { units, currentIndex, targetTitle } = pathway;

  if (currentIndex === -1) {
    return (
      <div className="panel" style={{ marginTop: 20, textAlign: "center" }}>
        <h2 className="icon-label" style={{ justifyContent: "center" }}>
          <Check size={16} /> Path complete
        </h2>
        <p className="muted small">
          Every concept on the way to <MathText>{targetTitle}</MathText> is above the mastery threshold.
        </p>
      </div>
    );
  }

  return (
    <div className="pathway-lane" style={{ marginTop: 20 }}>
      {units.map((unit, i) => (
        <PathwayUnitRow
          key={unit.id}
          unit={unit}
          isTarget={i === units.length - 1}
          state={i < currentIndex ? "done" : i === currentIndex ? "current" : "locked"}
        />
      ))}
    </div>
  );
}

function PathwayUnitRow({
  unit,
  isTarget,
  state,
}: {
  unit: PathwayUnit;
  isTarget: boolean;
  state: "done" | "current" | "locked";
}) {
  if (state !== "current") {
    return (
      <div className={`pathway-unit pathway-unit-${state}`}>
        <span className="pathway-unit-dot">{state === "done" ? <Check size={13} /> : <Lock size={12} />}</span>
        {state === "done" ? (
          <Link href={`/node/${encodeURIComponent(unit.id)}`} className="pathway-unit-title">
            {unit.type && <span className={`type-badge t-${unit.type}`}>{unit.type}</span>}
            <MathText>{unit.title}</MathText>
          </Link>
        ) : (
          <span className="pathway-unit-title muted">
            {unit.type && <span className={`type-badge t-${unit.type}`}>{unit.type}</span>}
            <MathText>{unit.title}</MathText>
          </span>
        )}
        {isTarget && <Sparkles size={13} className="pathway-target-star" />}
      </div>
    );
  }
  return <CurrentUnit unit={unit} isTarget={isTarget} />;
}

function CurrentUnit({ unit, isTarget }: { unit: PathwayUnit; isTarget: boolean }) {
  const readSteps = unit.steps.filter((s): s is ReadStep => s.kind === "read");
  const quizSteps = unit.steps.filter((s): s is QuizStep => s.kind === "quiz");
  const [readIndex, setReadIndex] = useState(0);
  const allRead = readIndex >= readSteps.length;
  const currentRead = readSteps[readIndex];

  return (
    <div className="panel pathway-unit-current">
      <div className="panel-header">
        <div className="icon-label">
          {unit.type && <span className={`type-badge t-${unit.type}`}>{unit.type}</span>}
          <Link href={`/node/${encodeURIComponent(unit.id)}`} className="text-link" style={{ fontWeight: 700, fontSize: 15 }}>
            <MathText>{unit.title}</MathText>
          </Link>
          {isTarget && (
            <span className="pill pill-accent icon-label">
              <Sparkles size={11} /> target
            </span>
          )}
        </div>
        <span className="muted small">{Math.round(unit.masteryP * 100)}% mastery</span>
      </div>

      {!allRead && currentRead && (
        <div className="pathway-read-dot">
          <p className="muted small label-xs" style={{ marginBottom: 6 }}>
            {currentRead.section} · {readIndex + 1} of {readSteps.length}
          </p>
          <div className="markdown" style={{ fontSize: 14 }}>
            <Markdown>{currentRead.content}</Markdown>
          </div>
          <div className="pathway-read-actions">
            <button className="btn-ghost btn-sm" onClick={() => setReadIndex((i) => i + 1)}>
              Not sure yet
            </button>
            <button className="btn-primary btn-sm icon-label" onClick={() => setReadIndex((i) => i + 1)}>
              Got it <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {allRead && (
        <div className="pathway-quiz-section">
          <p className="muted small" style={{ marginBottom: 10 }}>
            {quizSteps.length > 0
              ? `Next: prove you've got it — ${quizSteps.map((q) => q.problemKind).join(", ")}.`
              : "Ready to practice."}
          </p>
          <Link href={`/learn?node=${encodeURIComponent(unit.id)}`} className="cta icon-label">
            Practice {isTarget ? "the target" : "this"} <ArrowRight size={13} />
          </Link>
          {readSteps.length > 0 && (
            <button className="btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setReadIndex(0)}>
              Re-read
            </button>
          )}
        </div>
      )}
    </div>
  );
}
