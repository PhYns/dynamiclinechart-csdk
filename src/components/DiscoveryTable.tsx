/**
 * The decision table.
 *
 * Not decoration. It answers "why isn't X on the chart?" in one second instead
 * of a minute of hedging, and it is where the audience sees that the rules are
 * data rather than code.
 */
import {
  DROP_REASON_LABEL,
  formatNumber,
  formatPeriod,
  type DiscoveryResult,
} from '../lib/discovery.ts';
import { STATUS } from '../lib/palette.ts';
import type { SeriesColorMap } from '../hooks/useStableSeriesColors.ts';

export interface DiscoveryTableProps {
  discovery: DiscoveryResult;
  colors: SeriesColorMap;
  seriesLabel: string;
}

export function DiscoveryTable({ discovery, colors, seriesLabel }: DiscoveryTableProps) {
  const rows = [
    ...discovery.kept.map((stat) => ({
      stat,
      label: 'Drawn',
      color: STATUS.good,
      glyph: '✓',
      drawn: true,
    })),
    ...discovery.dropped.map(({ stat, reason }) => ({
      stat,
      label: DROP_REASON_LABEL[reason],
      color:
        reason === 'no-data' || reason === 'non-positive' ? STATUS.critical : STATUS.warning,
      glyph: reason === 'no-data' || reason === 'non-positive' ? '✕' : '!',
      drawn: false,
    })),
  ];

  return (
    <section>
      <h2>Series decisions</h2>
      <p className="sub">
        Every {seriesLabel.toLowerCase()} member in the model, richest first, with the
        reason it is or is not a line.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>{seriesLabel}</th>
              <th>Decision</th>
              <th className="num">Total</th>
              <th className="num">Periods</th>
              <th className="num">Share</th>
              <th>Span</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ stat, label, color, glyph, drawn }) => (
              <tr key={stat.member} className={drawn ? '' : 'dim'}>
                <td>
                  {drawn && (
                    <span className="swatch" style={{ background: colors[stat.member] }} />
                  )}
                </td>
                <td className="member">{stat.member}</td>
                <td>
                  <span style={{ color, fontWeight: 700, marginRight: 6 }}>{glyph}</span>
                  {label}
                </td>
                <td className="num">{formatNumber(stat.total)}</td>
                <td className="num">
                  {stat.pointsWithData} / {discovery.periods.length || '-'}
                </td>
                <td className="num">{(stat.share * 100).toFixed(1)}%</td>
                <td>
                  {formatPeriod(stat.firstPeriod)}
                  {stat.lastPeriod && stat.lastPeriod !== stat.firstPeriod
                    ? ` – ${formatPeriod(stat.lastPeriod)}`
                    : ''}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No members returned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}