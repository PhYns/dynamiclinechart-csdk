import { useMemo, useState } from 'react';
import { LineChart } from '@sisense/sdk-ui';
import { filterFactory, measureFactory } from '@sisense/sdk-data';
import type { Attribute, Filter } from '@sisense/sdk-data';

import * as DM from './data/sample-ecommerce.ts';
import { niceCeiling, type DiscoveryOptions } from './lib/discovery.ts';
import { SERIES_CAP_MAX } from './lib/palette.ts';
import { useDynamicSeries } from './hooks/useDynamicSeries.ts';
import { useStableSeriesColors } from './hooks/useStableSeriesColors.ts';
import { DiscoveryTable } from './components/DiscoveryTable.tsx';

/* -------------------------------------------------------------------------- */
/* Module-scope constants. Defined OUTSIDE the component on purpose: a new     */
/* object every render is a new prop identity, and the SDK then has to deep-   */
/* compare it on every unrelated render.                                       */
/* -------------------------------------------------------------------------- */

const DATA_SOURCE = DM.DataSource;

/** Swap these for DM.Location.Room / DM.Location.Site on your own model. */
const SERIES_OPTIONS: { id: string; label: string; attribute: Attribute }[] = [
  { id: 'brand', label: 'Brand', attribute: DM.Brand.Brand },
  { id: 'category', label: 'Category', attribute: DM.Category.Category },
  { id: 'country', label: 'Country', attribute: DM.Country.Country },
  { id: 'condition', label: 'Condition', attribute: DM.Commerce.Condition },
];

const TOTAL_REVENUE = measureFactory.sum(DM.Commerce.Revenue, 'Total Revenue');
const DATE_LEVEL = DM.Commerce.Date.Months;
const DATE_RANGE_LEVEL = DM.Commerce.Date.Years;

export default function App() {
  const [seriesId, setSeriesId] = useState('brand');
  const [from, setFrom] = useState('2012-01-01');
  const [to, setTo] = useState('2013-12-31');
  const [options, setOptions] = useState<DiscoveryOptions>({
    minPointsWithData: 2,
    minSharePct: 0.5,
    seriesCap: 6,
    treatZeroAsMissing: true,
  });
  const [showNaive, setShowNaive] = useState(true);

  const series = SERIES_OPTIONS.find((s) => s.id === seriesId) ?? SERIES_OPTIONS[0];

  // MUST be memoized: filterFactory returns a new object every call, and this
  // array is a query parameter.
  const baseFilters = useMemo<Filter[]>(
    () => [filterFactory.dateRange(DATE_RANGE_LEVEL, from, to)],
    [from, to],
  );

  const { discovery, keptFilter, isLoading, isError, error } = useDynamicSeries({
    dataSource: DATA_SOURCE,
    seriesAttribute: series.attribute,
    dateLevel: DATE_LEVEL,
    measure: TOTAL_REVENUE,
    baseFilters,
    options,
  });

  const colors = useStableSeriesColors(discovery.keptMembers);

  // Peak across ALL members, so the smart and naive charts share one scale and
  // the comparison is honest. Use discovery.globalMax (kept only) instead when
  // you fan out into small multiples.
  const sharedMax = useMemo(
    () => niceCeiling(discovery.all.reduce((m, s) => Math.max(m, s.peak), 0)),
    [discovery.all],
  );

  const smartFilters = keptFilter ? [...baseFilters, keptFilter] : baseFilters;
  const nothingKept = !isLoading && discovery.keptMembers.length === 0;

  const styleOptions = {
    height: 360,
    line: { width: 2 },
    markers: { enabled: true, size: 'small' as const, fill: 'filled' as const },
    legend: { enabled: true, position: 'bottom' as const },
    xAxis: { gridLines: false, title: { enabled: false } },
    yAxis: {
      min: 0,
      max: sharedMax || undefined,
      gridLines: true,
      title: { enabled: true, text: 'Total Revenue' },
    },
  };

  const emptied = discovery.dropped.filter((d) => d.reason === 'no-data').length;

  return (
    <main className="app">
      <h1>Dynamic line series</h1>
      <p className="sub">
        One <code>breakBy</code>, N lines. A discovery query runs first and hands the
        survivors to <code>filterFactory.members</code>.
      </p>

      {isError && <p className="error">Query failed: {error?.message ?? 'unknown error'}</p>}

      {/* ------------------------------- controls -------------------------- */}
      <div className="controls">
        <label>
          Series dimension
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
            {SERIES_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <label>
          Min periods with data: <b>{options.minPointsWithData}</b>
          <input
            type="range"
            min={1}
            max={12}
            value={options.minPointsWithData}
            onChange={(e) =>
              setOptions({ ...options, minPointsWithData: Number(e.target.value) })
            }
          />
        </label>

        <label>
          Min share: <b>{options.minSharePct}%</b>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={options.minSharePct}
            onChange={(e) => setOptions({ ...options, minSharePct: Number(e.target.value) })}
          />
        </label>

        <label>
          Series cap: <b>{options.seriesCap}</b>
          <input
            type="range"
            min={1}
            max={SERIES_CAP_MAX}
            value={options.seriesCap}
            onChange={(e) => setOptions({ ...options, seriesCap: Number(e.target.value) })}
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={options.treatZeroAsMissing}
            onChange={(e) => setOptions({ ...options, treatZeroAsMissing: e.target.checked })}
          />
          Treat zero as missing
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={showNaive}
            onChange={(e) => setShowNaive(e.target.checked)}
          />
          Show the naive chart
        </label>
      </div>

      {/* -------------------------------- tiles ---------------------------- */}
      <div className="tiles">
        <div className="tile">
          <b>{discovery.universeSize}</b>
          <span>{series.label} members in the model</span>
        </div>
        <div className="tile">
          <b>{discovery.kept.length}</b>
          <span>Lines drawn</span>
        </div>
        <div className="tile">
          <b>{emptied}</b>
          <span>Returned no data</span>
        </div>
        <div className="tile">
          <b>{discovery.periods.length}</b>
          <span>Periods in window</span>
        </div>
      </div>

      {/* ------------------------------ the chart -------------------------- */}
      <section>
        <h2>Total revenue by month, {series.label.toLowerCase()} with data</h2>
        <p className="sub">
          {discovery.kept.length} of {discovery.universeSize} members drawn.
        </p>

        {isLoading ? (
          <p className="placeholder">Running the discovery query…</p>
        ) : nothingKept ? (
          <p className="placeholder">
            No member passed discovery. Widen the date range or relax the rules. Note that
            the app renders this instead of calling{' '}
            <code>filterFactory.members(attr, [])</code> — an empty member list does not
            mean “show nothing” in Sisense.
          </p>
        ) : (
          <LineChart
            dataSet={DATA_SOURCE}
            dataOptions={{
              category: [{ column: DATE_LEVEL, dateFormat: 'MMM yyyy' }],
              value: [TOTAL_REVENUE],
              breakBy: [series.attribute], // one attribute - the filter sets the count
              seriesToColorMap: colors,
            }}
            filters={smartFilters}
            styleOptions={styleOptions}
          />
        )}
      </section>

      {/* ---------------------------- naive contrast ----------------------- */}
      {showNaive && !isLoading && (
        <section className="muted">
          <h2>The same chart with the discovery step removed</h2>
          <p className="sub">
            Identical <code>dataOptions</code>, no member filter. Sisense still hides
            members with no rows at all — but every one-point stub and every 0.1% series
            is now on the chart.
          </p>
          <LineChart
            dataSet={DATA_SOURCE}
            dataOptions={{
              category: [{ column: DATE_LEVEL, dateFormat: 'MMM yyyy' }],
              value: [TOTAL_REVENUE],
              breakBy: [series.attribute],
              seriesToColorMap: colors,
            }}
            filters={baseFilters}
            styleOptions={styleOptions}
          />
        </section>
      )}

      {/* ------------------------------- the table ------------------------- */}
      <DiscoveryTable discovery={discovery} colors={colors} seriesLabel={series.label} />
    </main>
  );
}