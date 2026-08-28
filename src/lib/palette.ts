/**
 * Series colours.
 *
 * Eight slots, validated to stay distinguishable for colourblind viewers on a
 * light background. Assigned in fixed order and never cycled - which is why the
 * series cap can never exceed 8. A ninth series would have to reuse a colour,
 * and two identical colours on one chart is worse than an omitted series.
 */
export const CATEGORICAL = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

/** Hard upper bound for the series cap. */
export const SERIES_CAP_MAX = CATEGORICAL.length;

/** Reserved status colours - never reused as a series colour. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;