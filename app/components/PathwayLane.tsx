"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Pathway, PathwayUnit, PathwayStep, DetourPrereq } from "@/lib/pathway";
import MathText from "./MathText";
import { ArrowRight, Check, HelpCircle, Lock, Sparkles, AlertCircle } from "./Icons";

const Markdown = dynamic(() => import("./Markdown"));

type ReadStep = Extract<PathwayStep, { kind: "read" }>;
type QuizStep = Extract<PathwayStep, { kind: "quiz" }>;

export default function PathwayLane({ pathway }: { pathway: Pathway }) {
  const { units, currentIndex, targetTitle, detour } = pathway;

  if (currentIndex === -1) {
    const ghosts = units.filter((u) => u.ghost);
    return (
      <>
        <div className="panel" style={{ marginTop: 20, textAlign: "center" }}>
          <h2 className="icon-label" style={{ justifyContent: "center" }}>
            <Check size={16} /> Path complete
          </h2>
          <p className="muted small">
            Every concept on the way to <MathText>{targetTitle}</MathText> is above the mastery threshold.
            {ghosts.length > 0 && <> {ghosts.length} prerequisite{ghosts.length !== 1 ? "s" : ""} still ha{ghosts.length !== 1 ? "ve" : "s"} no note to practice from.</>}
          </p>
        </div>
        {ghosts.length > 0 && (
          <div className="pathway-lane" style={{ marginTop: 12 }}>
            {ghosts.map((unit) => (
              <PathwayUnitRow key={unit.id} unit={unit} isTarget={false} state="locked" />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <DetourCallout detour={detour} targetTitle={targetTitle} />
      <div className="pathway-lane" style={{ marginTop: detour.length > 0 ? 12 : 20 }}>
        {units.map((unit, i) => (
          <PathwayUnitRow
            key={unit.id}
            unit={unit}
            isTarget={i === units.length - 1}
            state={i < currentIndex ? "done" : i === currentIndex ? "current" : "locked"}
          />
        ))}
      </div>
    </>
  );
}

/** M4 remediation detour — surfaced at the top of the lane: the prerequisites the
 *  target's failures keep tracing to, so the walk down has a diagnosed focus. */
function DetourCallout({ detour, targetTitle }: { detour: DetourPrereq[]; targetTitle: string }) {
  if (detour.length === 0) return null;
  return (
    <div className="pathway-detour" style={{ marginTop: 20 }}>
      <p className="pathway-detour-head icon-label">
        <AlertCircle size={13} /> Your misses on <MathText>{targetTitle}</MathText> keep tracing back to:
      </p>
      {detour.map((d) => (
        <div key={d.id} className="pathway-detour-item">
          {d.type && <span className={`type-badge t-${d.type}`}>{d.type}</span>}
          <Link href={`/node/${encodeURIComponent(d.id)}`} className="text-link">
            <MathText>{d.title}</MathText>
          </Link>
          {d.masteryP >= 0.8 ? (
            <span className="pill pill-red pill-xs" title="The model rates this mastered, but your misses keep tracing to it">
              blind spot
            </span>
          ) : null}
          <span className="muted small">{Math.round(d.masteryP * 100)}% · blamed {d.blameCount}×</span>
          <Link href={`/learn?node=${encodeURIComponent(d.id)}`} className="pill pill-accent icon-label" style={{ marginLeft: "auto" }}>
            Shore up <ArrowRight size={10} />
          </Link>
        </div>
      ))}
      <p className="muted small" style={{ margin: "6px 0 0" }}>
        Shoring these foundations up first should make the rest of the path come easier.
      </p>
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
  // A prerequisite with no note yet — an explicit gap, not a walkable unit.
  // Never current/done/locked; links to the node page where it can be written.
  if (unit.ghost) {
    return (
      <div className="pathway-unit pathway-unit-ghost">
        <span className="pathway-unit-dot"><HelpCircle size={13} /></span>
        <Link href={`/node/${encodeURIComponent(unit.id)}`} className="pathway-unit-title">
          {unit.type && <span className={`type-badge t-${unit.type}`}>{unit.type}</span>}
          <MathText>{unit.title}</MathText>
        </Link>
        <span className="pill pill-muted" style={{ marginLeft: "auto", flexShrink: 0 }}>no note yet</span>
      </div>
    );
  }
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
