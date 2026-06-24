import type { ReactNode } from "react";

/** Small centered icon + message for "nothing here" states, in place of a bare line of muted text. */
export default function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="empty-state-block">
      <span className="empty-state-icon">{icon}</span>
      <p className="muted">{children}</p>
    </div>
  );
}
