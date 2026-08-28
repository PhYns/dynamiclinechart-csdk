/**
 * ===========================================================================
 *  Series discovery - the whole idea, as pure functions
 * ===========================================================================
 * No React, no SDK imports beyond one type. That is deliberate: it makes this
 * file unit-testable and lets you change the rules without touching the UI.
 */
import type { QueryResultData } from '@sisense/sdk-data';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type DropReason =
  | 'no-data'
  | 'non-positive'
  | 'too-sparse'
  | 'below-share'
  | 'beyond-cap';

export const DROP_REASON_LABEL: Record<DropReason, string> = {
  'no-data': 'No data',
  'non-positive': 'Nothing to plot',
  'too-sparse': 'Too sparse',
  'below-share': 'Below share floor',
  'beyond-cap': 'Beyond series cap',
};

/** One unwrapped row of the evidence query. */
export interface EvidenceRow {
  /** Raw period value, e.g. '2013-04-01T00:00:00'. */
  period: string;
  /** Member of the series dimension. */
  member: string;
  /** Aggregated measure; null when Sisense returned no value. */
  value: number | null;
}

export interface DiscoveryOptions {
  /** Minimum periods carrying a value before a member earns a line. */
  minPointsWithData: number;
  /** Minimum share of the plottable total, in percent. */
  minSharePct: number;
  /** Maximum number of lines to draw. */
  seriesCap: number;
  /** Treat an exact zero as "no data" rather than a real observation. */
  treatZeroAsMissing: boolean;
}

export interface SeriesStat {
  member: string;
  total: number;
  pointsWithData: number;
  /** Largest single-period value. */
  peak: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  /** pointsWithData / periods in the window, 0..1 */
  coverage: number;
  /** total / plottableTotal, 0..1 */
  share: number;
}

export interface DroppedSeries {
  stat: SeriesStat;
  reason: DropReason;
}

export interface DiscoveryResult {
  periods: string[];
  /** Every member of the universe, richest first. */
  all: SeriesStat[];
  kept: SeriesStat[];
  dropped: DroppedSeries[];
  /** Exactly what goes into filterFactory.members(...). */
  keptMembers: string[];
  /** Peak among KEPT series - use for small multiples. */
  globalMax: number;
  grandTotal: number;
  plottableTotal: number;
  universeSize: number;
}

/** Safe empty value, for the first render before queries resolve. */
export const EMPTY_DISCOVERY: DiscoveryResult = {
  periods: [],
  all: [],
  kept: [],
  dropped: [],
  keptMembers: [],
  globalMax: 0,
  grandTotal: 0,
  plottableTotal: 0,
  universeSize: 0,
};

/* -------------------------------------------------------------------------- */
/* The decision                                                                */
/* -------------------------------------------------------------------------- */

function comparePeriods(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db;
  return a.localeCompare(b);
}

interface Accumulator {
  total: number;
  points: number;
  peak: number;
  first: string | null;
  last: string | null;
}

/**
 * @param universe Every member the model contains (universe query).
 * @param evidence period x member x measure rows (evidence query).
 */
export function discoverSeries(
  universe: string[],
  evidence: EvidenceRow[],
  options: DiscoveryOptions,
): DiscoveryResult {
  const periodSet = new Set<string>();
  const acc = new Map<string, Accumulator>();

  const touch = (member: string): Accumulator => {
    let a = acc.get(member);
    if (!a) {
      a = { total: 0, points: 0, peak: 0, first: null, last: null };
      acc.set(member, a);
    }
    return a;
  };

  // Seed with the universe so members with zero rows still surface as
  // "no data" instead of vanishing. That contrast is the point of the demo.
  for (const member of universe) if (member) touch(member);

  for (const row of evidence) {
    if (!row.member) continue;
    periodSet.add(row.period);

    const a = touch(row.member);
    const v = row.value;
    const missing =
      v === null ||
      v === undefined ||
      Number.isNaN(v) ||
      (options.treatZeroAsMissing && v === 0);
    if (missing) continue;

    a.total += v;
    a.points += 1;
    if (v > a.peak) a.peak = v;
    if (a.first === null || comparePeriods(row.period, a.first) < 0) a.first = row.period;
    if (a.last === null || comparePeriods(row.period, a.last) > 0) a.last = row.period;
  }

  const periods = [...periodSet].sort(comparePeriods);
  const periodCount = periods.length || 1;

  // Pass 1 - structural rules. These do not depend on any total.
  const structuralReason = (a: Accumulator): DropReason | null => {
    if (a.points === 0) return 'no-data';
    if (a.total <= 0) return 'non-positive';
    if (a.points < options.minPointsWithData) return 'too-sparse';
    return null;
  };

  let grandTotal = 0;
  let plottableTotal = 0;
  for (const a of acc.values()) {
    grandTotal += a.total;
    if (structuralReason(a) === null) plottableTotal += a.total;
  }

  // Pass 2 - relative rules, measured against the PLOTTABLE total. Measuring
  // against the grand total lets one huge single-point outlier push every
  // legitimate series below the share floor and empty the chart.
  const entries = [...acc.entries()].sort(
    (x, y) => y[1].total - x[1].total || x[0].localeCompare(y[0]),
  );

  const all: SeriesStat[] = [];
  const kept: SeriesStat[] = [];
  const dropped: DroppedSeries[] = [];

  for (const [member, a] of entries) {
    const stat: SeriesStat = {
      member,
      total: a.total,
      pointsWithData: a.points,
      peak: a.peak,
      firstPeriod: a.first,
      lastPeriod: a.last,
      coverage: a.points / periodCount,
      share: plottableTotal > 0 ? a.total / plottableTotal : 0,
    };
    all.push(stat);

    const structural = structuralReason(a);
    if (structural !== null) {
      dropped.push({ stat, reason: structural });
    } else if (stat.share * 100 < options.minSharePct) {
      dropped.push({ stat, reason: 'below-share' });
    } else if (kept.length >= options.seriesCap) {
      dropped.push({ stat, reason: 'beyond-cap' });
    } else {
      kept.push(stat);
    }
  }

  return {
    periods,
    all,
    kept,
    dropped,
    keptMembers: kept.map((s) => s.member),
    globalMax: kept.reduce((m, s) => Math.max(m, s.peak), 0),
    grandTotal,
    plottableTotal,
    universeSize: acc.size,
  };
}

/* -------------------------------------------------------------------------- */
/* Adapters: query cells -> plain values                                       */
/* -------------------------------------------------------------------------- */

const cellText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const cellNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? null : n;
};

/** Universe query -> member list. Expects ONE dimension column. */
export function toMemberList(data: QueryResultData | undefined): string[] {
  if (!data?.rows) return [];
  const seen = new Set<string>();
  for (const row of data.rows) {
    const member = cellText(row[0]?.data);
    if (member) seen.add(member);
  }
  return [...seen];
}

/**
 * Evidence query -> rows.
 * Expects columns in the order [dateLevel, seriesDimension, measure] - i.e.
 * the order you passed `dimensions` then `measures`. Reorder the query and you
 * must reorder these indexes.
 */
export function toEvidenceRows(data: QueryResultData | undefined): EvidenceRow[] {
  if (!data?.rows) return [];
  return data.rows.map((row) => ({
    period: cellText(row[0]?.data),
    member: cellText(row[1]?.data),
    value: cellNumber(row[2]?.data),
  }));
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value);
}

export function formatPeriod(period: string | null): string {
  if (!period) return '-';
  const t = Date.parse(period);
  if (Number.isNaN(t)) return period;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(t));
}

/** Round a maximum up to a readable axis bound. */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / magnitude;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * magnitude;
}