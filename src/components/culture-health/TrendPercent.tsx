import { C } from '../../theme';
import type { PeriodData } from './constants';

export interface TrendPercentProps {
  periods: PeriodData[];
  activeIdx: number;
  label: string;
}

/**
 * Trend percentage display showing change from previous period.
 * Large arrow + percentage with contextual label below.
 */
const TrendPercent = ({ periods, activeIdx, label }: TrendPercentProps) => {
  // Calculate % change from previous period
  const current = periods[activeIdx]?.warmth || 0;
  const previous = activeIdx > 0 ? periods[activeIdx - 1]?.warmth : periods[0]?.warmth;
  const prevVal = previous || current;
  const change = prevVal > 0 ? ((current - prevVal) / prevVal) * 100 : 0;
  const isUp = change > 0;
  const isFlat = Math.abs(change) < 0.5;
  const arrow = isFlat ? "\u2192" : isUp ? "\u2191" : "\u2193";
  const color = isFlat ? C.amber : isUp ? C.teal : C.red;

  return (
    <div style={{ textAlign: "center", marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 300, color, fontFamily: "'Josefin Sans', sans-serif", letterSpacing: -1 }}>
          {arrow} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>
        {label} · {isFlat ? "Steady" : isUp ? "Strengthening" : "Dipping"} vs previous
      </div>
    </div>
  );
};

export default TrendPercent;
