// Single source of truth for how a grading verdict is presented across the app.
// Previously these maps were duplicated (with slightly different shapes) in
// PracticeSession, StudyQueue, and the progress page — so a palette tweak meant
// editing three files and risking drift. Pure constants (no server imports), so
// both server and client components can import it.

export type Verdict = "correct" | "partial" | "incorrect";

export type VerdictStyle = {
  label: string; // long form shown in feedback panels ("Partially there")
  short: string; // lowercase tag form ("partial")
  color: string; // text/dot color token
  bg: string;    // soft background token for the verdict banner
};

export const VERDICT: Record<Verdict, VerdictStyle> = {
  correct:   { label: "Correct",         short: "correct",   color: "var(--green)", bg: "var(--green-soft)" },
  partial:   { label: "Partially there", short: "partial",   color: "var(--amber)", bg: "var(--amber-soft)" },
  incorrect: { label: "Not yet",         short: "incorrect", color: "var(--red)",   bg: "var(--red-soft)" },
};
