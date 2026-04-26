import { useState } from 'react';
import { C, useThemeMode } from '../../theme';
import { FEATURE_LABELS, DONUT_COLORS } from '../culture-health/constants';

export interface MeetingDimensionWheelProps {
  weights: { dimension: string; weight: number }[];
  orbSize?: number;
}

/**
 * SVG donut chart showing per-meeting dimension weight breakdown.
 * Adapted from FeatureDonut -- accepts weights as props instead of reading
 * from global STUDIO_FEATURES module state. Designed for ContextRail (300px).
 */
export const MeetingDimensionWheel = ({ weights, orbSize = 90 }: MeetingDimensionWheelProps) => {
  useThemeMode();
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  if (!weights || weights.length === 0) return null;

  // Map single-letter dimensions (A-J) to FEATURE_LABELS index
  const LETTER_TO_INDEX: Record<string, number> = {
    A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  };

  const entries = weights
    .map(w => {
      // Support both single-letter ("B") and full key ("inquiry") formats
      let dimIndex = LETTER_TO_INDEX[w.dimension];
      if (dimIndex === undefined) {
        dimIndex = FEATURE_LABELS.findIndex(f => f.key === w.dimension);
      }
      if (dimIndex === undefined || dimIndex === -1) return null;
      return {
        key: w.dimension,
        short: FEATURE_LABELS[dimIndex].short,
        label: FEATURE_LABELS[dimIndex].label,
        raw: w.weight,
        ci: dimIndex,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) return null;

  // Normalize so all features sum to 100%
  const total = entries.reduce((s, e) => s + e.raw, 0);
  if (total === 0) return null;
  const norm = entries.map(e => ({ ...e, pct: e.raw / total }));
  norm.sort((a, b) => b.pct - a.pct);

  const svgSize = orbSize + 200;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const innerR = orbSize / 2 + 18;
  const outerR = innerR + 12;
  const gap = 0.02;

  let angle = -Math.PI / 2; // Start at top (12 o'clock)
  const segs = norm.map(e => {
    const sweep = e.pct * Math.PI * 2;
    const s = { ...e, sa: angle + gap / 2, ea: angle + sweep - gap / 2, mid: angle + sweep / 2 };
    angle += sweep;
    return s;
  });

  const arc = (ir: number, or: number, sa: number, ea: number) => {
    const c = Math.cos, s = Math.sin, la = ea - sa > Math.PI ? 1 : 0;
    return `M${cx + or * c(sa)},${cy + or * s(sa)} A${or},${or} 0 ${la} 1 ${cx + or * c(ea)},${cy + or * s(ea)} L${cx + ir * c(ea)},${cy + ir * s(ea)} A${ir},${ir} 0 ${la} 0 ${cx + ir * c(sa)},${cy + ir * s(sa)} Z`;
  };

  // Left / Right label columns with connector lines
  const labelGap = 10;
  const lineH = 13;
  const rightX = cx + outerR + labelGap;
  const leftX = cx - outerR - labelGap;

  type LblEntry = (typeof segs)[0] & { i: number; idealY: number; y: number; side: 'R' | 'L' };
  const rightCol: LblEntry[] = [];
  const leftCol: LblEntry[] = [];

  segs.forEach((s, i) => {
    const cosM = Math.cos(s.mid);
    const idealY = cy + (outerR + 4) * Math.sin(s.mid);
    const entry: LblEntry = { ...s, i, idealY, y: idealY, side: cosM >= 0 ? 'R' : 'L' };
    if (cosM >= 0) rightCol.push(entry);
    else leftCol.push(entry);
  });

  // Relaxation: sort by ideal Y, then push apart any that are closer than lineH
  const spreadCol = (col: LblEntry[]) => {
    col.sort((a, b) => a.idealY - b.idealY);
    for (let pass = 0; pass < 12; pass++) {
      for (let j = 1; j < col.length; j++) {
        const dy = col[j].y - col[j - 1].y;
        if (dy < lineH) {
          const push = (lineH - dy) / 2;
          col[j - 1].y -= push;
          col[j].y += push;
        }
      }
      const yMin = 10;
      const yMax = svgSize - 28;
      col.forEach(l => {
        l.y = Math.max(yMin, Math.min(yMax, l.y));
      });
    }
  };
  spreadCol(rightCol);
  spreadCol(leftCol);
  const allLabels = [...rightCol, ...leftCol];

  return (
    <div
      style={{
        position: 'relative',
        width: svgSize,
        height: svgSize,
        overflow: 'visible',
      }}
    >
      <svg width={svgSize} height={svgSize} style={{ overflow: 'visible' }}>
        {/* Donut segments */}
        {segs.map((s, i) => (
          <path
            key={i}
            d={arc(innerR, hovIdx === i ? outerR + 4 : outerR, s.sa, s.ea)}
            fill={DONUT_COLORS[s.ci]}
            opacity={hovIdx !== null && hovIdx !== i ? 0.3 : 0.85}
            style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
          />
        ))}
        {/* Connector lines + labels */}
        {allLabels.map(l => {
          const isHov = hovIdx === l.i;
          const pctVal = Math.round(l.pct * 100);
          const isR = l.side === 'R';
          const rX = cx + outerR * Math.cos(l.mid);
          const rY = cy + outerR * Math.sin(l.mid);
          const eX = isR ? rightX - 2 : leftX + 2;
          const tX = isR ? rightX : leftX;
          const lineOp = hovIdx !== null && hovIdx !== l.i ? 0.1 : 0.28;
          return (
            <g key={`lbl-${l.i}`}>
              <polyline
                points={`${rX},${rY} ${eX},${l.y} ${tX},${l.y}`}
                fill="none"
                stroke={DONUT_COLORS[l.ci]}
                strokeWidth={0.6}
                opacity={lineOp}
                style={{ transition: 'opacity 0.2s' }}
              />
              <circle cx={rX} cy={rY} r={1.3} fill={DONUT_COLORS[l.ci]} opacity={lineOp * 1.4} />
              <text
                x={tX}
                y={l.y}
                textAnchor={isR ? 'start' : 'end'}
                dominantBaseline="central"
                fill={DONUT_COLORS[l.ci]}
                fontSize={isHov ? 10.5 : 9}
                fontWeight={isHov ? 700 : 600}
                fontFamily="'Tomorrow', sans-serif"
                opacity={hovIdx !== null && hovIdx !== l.i ? 0.35 : 1}
                style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
              >
                {l.short} {pctVal}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Bottom label */}
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.textSec,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            fontFamily: "'Tomorrow', sans-serif",
          }}
        >
          Dimension Analysis
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textDim,
            marginTop: 1,
            fontFamily: "'Tomorrow', sans-serif",
          }}
        >
          Feature weightings for this meeting
        </div>
      </div>
    </div>
  );
};

export default MeetingDimensionWheel;
