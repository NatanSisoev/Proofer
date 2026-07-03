// Cycle 2 #2c — surfaces the outcome of the adversarial verification pass
// (Cycle 2 #2b) wherever a verdict is shown. Silent for "model-judged" (the
// default, unmarked baseline) so the badge only appears when it adds signal.
export default function TrustBadge({ trust }: { trust?: string | null }) {
  if (trust === "refuted") {
    return (
      <span className="pill pill-red pill-xs" title="A second adversarial pass found a hole in this proof — the verdict was downgraded.">
        refuted
      </span>
    );
  }
  if (trust === "cross-checked") {
    return (
      <span className="pill pill-green pill-xs" title="A second adversarial pass tried to break this proof and found no hole.">
        cross-checked
      </span>
    );
  }
  return null;
}
