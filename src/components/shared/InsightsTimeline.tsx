import { useState } from 'react';
import { C } from '../../theme';

export interface InsightPeriod {
  label: string;
  warmth: number;
  insight: string;
  start?: string[];
  stop?: string[];
}

export interface InsightsTimelineProps {
  /** Period data keyed by timeframe */
  periods: {
    weeks: InsightPeriod[];
    months: InsightPeriod[];
    quarters: InsightPeriod[];
  };
}

/**
 * Vertical timeline of coaching insights with timeframe switcher.
 * Shows insight cards colored by warmth score, with start/stop action items.
 */
const InsightsTimeline = ({ periods }: InsightsTimelineProps) => {
  const [timeframe, setTimeframe] = useState<'weeks' | 'months' | 'quarters'>('weeks');
  const items = [...(periods[timeframe] || [])].reverse();

  const warmthColor = (w: number) => w >= 0.6 ? C.teal : w >= 0.4 ? C.amber : C.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Timeframe switcher */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['weeks', 'months', 'quarters'] as const).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'capitalize',
              letterSpacing: 0.3,
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
              background: timeframe === tf ? C.tealGlow : 'transparent',
              border: `1px solid ${timeframe === tf ? C.tealBorder : C.border}`,
              color: timeframe === tf ? C.teal : C.textDim,
              transition: 'all 0.2s',
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Timeline cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((period, i) => (
          <div key={i} style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: C.hoverBg,
            borderLeft: `2px solid ${warmthColor(period.warmth)}`,
            borderTop: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              {period.label}
            </div>
            {period.insight && (
              <div style={{
                fontSize: 11.5, color: C.textDim, lineHeight: 1.55,
                fontStyle: 'italic', marginBottom: 8,
              }}>
                &ldquo;{period.insight.slice(0, 120)}{period.insight.length > 120 ? '\u2026' : ''}&rdquo;
              </div>
            )}
            {period.start?.[0] && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: '#7ED68A', marginTop: 2, flexShrink: 0 }}>+</span>
                <div style={{ fontSize: 11, color: C.tealMuted, lineHeight: 1.5 }}>
                  {period.start[0]}
                </div>
              </div>
            )}
            {period.stop?.[0] && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ fontSize: 9, color: C.amber, marginTop: 2, flexShrink: 0 }}>&times;</span>
                <div style={{ fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
                  {period.stop[0]}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsightsTimeline;
