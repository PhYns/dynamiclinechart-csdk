/**
 * Sticky member -> colour assignment.
 *
 * Any charting library colours series by their position in the result set. That
 * is wrong for a chart whose series count changes: widen a filter, a new series
 * appears mid-sort-order, and every line below it changes colour. The audience
 * reads that as "the data changed".
 *
 * So a member takes a slot the first time it is seen and keeps it for the
 * session. A newcomer gets the lowest slot not currently in use.
 */
import { useRef } from 'react';
import { CATEGORICAL } from '../lib/palette.ts';

export type SeriesColorMap = Record<string, string>;

export function useStableSeriesColors(members: string[]): SeriesColorMap {
  const assigned = useRef(new Map<string, number>());

  const slotsInUse = new Set<number>();
  for (const member of members) {
    const slot = assigned.current.get(member);
    if (slot !== undefined) slotsInUse.add(slot);
  }

  for (const member of members) {
    if (assigned.current.has(member)) continue;

    let slot = 0;
    while (slot < CATEGORICAL.length && slotsInUse.has(slot)) slot++;
    // Should be unreachable - discovery caps the series count at
    // CATEGORICAL.length. Fall back rather than invent a colour.
    if (slot >= CATEGORICAL.length) slot = CATEGORICAL.length - 1;

    assigned.current.set(member, slot);
    slotsInUse.add(slot);
  }

  const map: SeriesColorMap = {};
  for (const member of members) {
    map[member] = CATEGORICAL[assigned.current.get(member) ?? 0];
  }
  return map;
}