/**
 * The two-query discovery hook.
 *
 *   1. UNIVERSE  - the dimension alone. What does the model contain?
 *   2. EVIDENCE  - period x member x measure under the live filters.
 *
 * Diff them, apply the rules, hand back the member list for the chart.
 */
import { useMemo } from 'react';
import { useExecuteQuery } from '@sisense/sdk-ui';
import { filterFactory } from '@sisense/sdk-data';
import type { Attribute, Filter, LevelAttribute, Measure } from '@sisense/sdk-data';

import {
  EMPTY_DISCOVERY,
  discoverSeries,
  toEvidenceRows,
  toMemberList,
  type DiscoveryOptions,
  type DiscoveryResult,
} from '../lib/discovery.ts';

export interface UseDynamicSeriesArgs {
  dataSource: string;
  /** Dimension that becomes one line per member. */
  seriesAttribute: Attribute;
  /** Date level on the x-axis. */
  dateLevel: LevelAttribute;
  /** Measure on the y-axis. */
  measure: Measure;
  /** Dashboard filters. MUST be memoized by the caller - see below. */
  baseFilters: Filter[];
  options: DiscoveryOptions;
}

export interface UseDynamicSeriesResult {
  discovery: DiscoveryResult;
  /**
   * Append this to the chart's `filters`. It is `null` when discovery kept
   * nothing - important, because filterFactory.members(attr, []) does NOT mean
   * "show nothing" in Sisense. Render an empty state instead.
   */
  keptFilter: Filter | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useDynamicSeries({
  dataSource,
  seriesAttribute,
  dateLevel,
  measure,
  baseFilters,
  options,
}: UseDynamicSeriesArgs): UseDynamicSeriesResult {
  // Query 1 - UNIVERSE. Dimension only: no measures, no filters. This is the
  // denominator, so filtering it would collapse it into the evidence query.
  const universeQuery = useExecuteQuery({
    dataSource,
    dimensions: [seriesAttribute],
  });

  // Query 2 - EVIDENCE. Sisense post-filters, so members with nothing to show
  // simply do not come back.
  const evidenceQuery = useExecuteQuery({
    dataSource,
    dimensions: [dateLevel, seriesAttribute],
    measures: [measure],
    filters: baseFilters,
  });

  const discovery = useMemo(() => {
    if (universeQuery.isLoading || evidenceQuery.isLoading) return EMPTY_DISCOVERY;
    return discoverSeries(
      toMemberList(universeQuery.data),
      toEvidenceRows(evidenceQuery.data),
      options,
    );
  }, [
    options,
    universeQuery.isLoading,
    universeQuery.data,
    evidenceQuery.isLoading,
    evidenceQuery.data,
  ]);

  const keptFilter = useMemo(
    () =>
      discovery.keptMembers.length > 0
        ? filterFactory.members(seriesAttribute, discovery.keptMembers)
        : null,
    [discovery.keptMembers, seriesAttribute],
  );

  return {
    discovery,
    keptFilter,
    isLoading: universeQuery.isLoading || evidenceQuery.isLoading,
    isError: universeQuery.isError || evidenceQuery.isError,
    error: universeQuery.error ?? evidenceQuery.error ?? null,
  };
}