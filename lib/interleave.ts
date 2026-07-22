/**
 * Spreads `due` review items evenly across a queue of `length` slots instead
 * of clustering them all at the front (Cycle 2 #7 "interleaved smart
 * queue") — spacing-science research finds blocked practice (all reviews,
 * then all new material) is worse for retention than interleaving retrieval
 * practice throughout a session. Priority ordering *within* each group
 * (due sorted by urgency, rest by info-gain/greedy relevance) is preserved.
 *
 * Guarantees, covered by tests/interleave.test.ts:
 *   - returns exactly min(length, due.length + rest.length) items,
 *   - never drops or duplicates an input item,
 *   - keeps each group's relative order,
 *   - degrades gracefully when either group is empty.
 */
export function interleave<T>(due: T[], rest: T[], length: number): T[] {
  if (due.length === 0) return rest.slice(0, length);
  if (rest.length === 0) return due.slice(0, length);

  const totalDue = Math.min(due.length, length);
  const step = length / totalDue;
  const duePositions = new Set<number>();
  for (let i = 0; i < totalDue; i++) duePositions.add(Math.round(i * step));

  const result: T[] = [];
  let dueIdx = 0;
  let restIdx = 0;
  for (let pos = 0; pos < length; pos++) {
    if (duePositions.has(pos) && dueIdx < due.length) result.push(due[dueIdx++]);
    else if (restIdx < rest.length) result.push(rest[restIdx++]);
    else if (dueIdx < due.length) result.push(due[dueIdx++]);
  }
  return result;
}
