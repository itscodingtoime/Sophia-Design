import { C, useThemeMode } from '../../theme';

export interface TrendIndicatorProps {
  /** Percentage change value (positive = up, negative = down, near-zero = flat) */
  value: number;
  /** Optional suffix displayed after the number (defaults to "%") */
  suffix?: string;
}

/**
 * Small up/down/neutral trend arrow with percentage.
 * Green for positive, red for negative, amber for flat (< 0.5 abs).
 */
const TrendIndicator = ({ value, suffix = '%' }: TrendIndicatorProps) => {
  useThemeMode();
  const isFlat = Math.abs(value) < 0.5;
  const isUp = value > 0;
  const arrow = isFlat ? '\u2192' : isUp ? '\u2191' : '\u2193';
  const color = isFlat ? C.amber : isUp ? C.teal : C.red;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      color,
      fontWeight: 600,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{ fontSize: 13 }}>{arrow}</span>
      {Math.abs(value).toFixed(1)}{suffix}
    </div>
  );
};

export default TrendIndicator;
