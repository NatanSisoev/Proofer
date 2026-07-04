"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/** A boolean that auto-clears a few seconds after being raised — brief inline
 * "that didn't work" feedback for small mutation buttons (bookmark, snooze,
 * mark-known…), where a persistent error banner would be heavier than the
 * control itself. The control stays clickable the whole time, so the raised
 * state doubles as the retry affordance. */
export function useTransientFlag(ms = 3000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const raise = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, raise];
}
