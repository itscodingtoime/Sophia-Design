import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { C, useThemeMode } from '../../theme';
import { FEATURE_LABELS, DONUT_COLORS, STUDIO_FEATURES } from './constants';

// ─── Types ───

export interface OrbDonutMorphProps {
  studioId: string;
  warmth?: number;
  expanded: boolean;
  features?: Record<string, number>;
  weights?: Record<string, number>;
  hoveredIndex?: number | null;
  onHoverSegment?: (index: number | null) => void;
  onExpandComplete?: () => void;
  onCollapseComplete?: () => void;
}

// ─── Constants ───

const SVG_SIZE = 320;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const INNER_R = 52;
const OUTER_R = 60;
const GAP = 0.03; // radians gap between segments
const LINE_H = 13;
const LABEL_GAP = 10;

// ─── Arc Path Builder ───

function buildArc(
  cx: number, cy: number,
  ir: number, or_: number,
  sa: number, ea: number,
): string {
  const c = Math.cos, s = Math.sin, la = ea - sa > Math.PI ? 1 : 0;
  return `M${cx + or_ * c(sa)},${cy + or_ * s(sa)} A${or_},${or_} 0 ${la} 1 ${cx + or_ * c(ea)},${cy + or_ * s(ea)} L${cx + ir * c(ea)},${cy + ir * s(ea)} A${ir},${ir} 0 ${la} 0 ${cx + ir * c(sa)},${cy + ir * s(sa)} Z`;
}

// ─── Label Relaxation ───

interface LblEntry {
  i: number;
  ci: number;
  short: string;
  pct: number;
  mid: number;
  y: number;
  side: 'R' | 'L';
}

function spreadCol(col: LblEntry[]): void {
  col.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 12; pass++) {
    for (let j = 1; j < col.length; j++) {
      const dy = col[j].y - col[j - 1].y;
      if (dy < LINE_H) {
        const push = (LINE_H - dy) / 2;
        col[j - 1].y -= push;
        col[j].y += push;
      }
    }
    col.forEach(l => { l.y = Math.max(10, Math.min(SVG_SIZE - 28, l.y)); });
  }
}

// ─── Segment Computation ───

interface Segment {
  ci: number;
  short: string;
  pct: number;
  sa: number;
  ea: number;
  mid: number;
}

function computeSegments(
  featuresProp: Record<string, number> | undefined,
  studioId: string,
): Segment[] {
  const features = featuresProp || STUDIO_FEATURES[studioId];
  if (!features) return [];

  const entries = FEATURE_LABELS.map((f, i) => ({
    short: f.short, raw: features[f.key] || 0, ci: i,
  }));
  const total = entries.reduce((s, e) => s + e.raw, 0);
  if (total === 0) return [];

  const norm = entries.map(e => ({ ...e, pct: e.raw / total }));
  norm.sort((a, b) => b.pct - a.pct);

  let angle = -Math.PI / 2;
  return norm.map(e => {
    const sweep = e.pct * Math.PI * 2;
    const seg: Segment = {
      ci: e.ci, short: e.short, pct: e.pct,
      sa: angle + GAP / 2, ea: angle + sweep - GAP / 2,
      mid: angle + sweep / 2,
    };
    angle += sweep;
    return seg;
  });
}

function computeLabels(segs: Segment[]): LblEntry[] {
  const rightCol: LblEntry[] = [];
  const leftCol: LblEntry[] = [];

  segs.forEach((s, i) => {
    const cosM = Math.cos(s.mid);
    const idealY = CY + (OUTER_R + 4) * Math.sin(s.mid);
    const entry: LblEntry = {
      i, ci: s.ci, short: s.short, pct: s.pct,
      mid: s.mid, y: idealY,
      side: cosM >= 0 ? 'R' : 'L',
    };
    if (cosM >= 0) rightCol.push(entry); else leftCol.push(entry);
  });

  spreadCol(rightCol);
  spreadCol(leftCol);
  return [...rightCol, ...leftCol];
}

// ─── Spring configs ───

const arcSpring = { type: 'spring' as const, stiffness: 100, damping: 16, mass: 0.9 };
const arcCollapseSpring = { type: 'spring' as const, stiffness: 160, damping: 22, mass: 0.6 };
const labelSpring = { type: 'spring' as const, stiffness: 90, damping: 18 };
const ARC_STAGGER = 0.07;  // 70ms between each arc
const ARC_COLLAPSE_STAGGER = 0.035;  // faster collapse
const LABEL_STAGGER = 0.05;  // 50ms between each label

// ─── Component ───

const OrbDonutMorph = ({
  studioId,
  expanded,
  features,
  hoveredIndex,
  onHoverSegment,
  onExpandComplete,
  onCollapseComplete,
}: OrbDonutMorphProps) => {
  useThemeMode();
  const prefersReduced = useReducedMotion();

  const [localHov, setLocalHov] = useState<number | null>(null);
  const activeHov = hoveredIndex !== undefined && hoveredIndex !== null
    ? hoveredIndex : localHov;

  const segs = useMemo(() => computeSegments(features, studioId), [features, studioId]);
  const labels = useMemo(() => computeLabels(segs), [segs]);

  // Reset hover on studio change
  useEffect(() => { setLocalHov(null); }, [studioId]);

  if (!segs.length) return null;

  const handleHoverIn = (index: number) => {
    if (!expanded) return;
    onHoverSegment ? onHoverSegment(index) : setLocalHov(index);
  };
  const handleHoverOut = () => {
    onHoverSegment ? onHoverSegment(null) : setLocalHov(null);
  };

  const rightX = CX + OUTER_R + LABEL_GAP;
  const leftX = CX - OUTER_R - LABEL_GAP;

  return (
    <div className="orb-donut-morph" style={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE }}>
      <svg width={SVG_SIZE} height={SVG_SIZE}>
        <defs>
          <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Donut arcs — scale up from center with stagger when expanded */}
        {segs.map((s, i) => {
          const isHov = activeHov === s.ci && expanded;
          const dimmed = activeHov !== null && activeHov !== s.ci && expanded;
          const or_ = isHov ? OUTER_R + 4 : OUTER_R;
          const arcPath = buildArc(CX, CY, INNER_R, or_, s.sa, s.ea);

          return (
            <motion.path
              key={s.ci}
              d={arcPath}
              fill={DONUT_COLORS[s.ci]}
              initial={false}
              animate={{
                opacity: expanded ? (dimmed ? 0.3 : 0.85) : 0,
                scale: expanded ? (isHov ? 1.04 : 1) : 0.3,
              }}
              transition={prefersReduced ? { duration: 0 } : {
                opacity: { duration: 0.3, delay: expanded ? i * ARC_STAGGER : (segs.length - 1 - i) * ARC_COLLAPSE_STAGGER },
                scale: expanded
                  ? { ...arcSpring, delay: i * ARC_STAGGER }
                  : { ...arcCollapseSpring, delay: (segs.length - 1 - i) * ARC_COLLAPSE_STAGGER },
              }}
              style={{
                cursor: expanded ? 'pointer' : 'default',
                outline: 'none',
                transformOrigin: `${CX}px ${CY}px`,
                filter: isHov ? 'url(#arc-glow)' : 'none',
                transition: 'filter 200ms ease',
              }}
              tabIndex={expanded ? 0 : -1}
              role="button"
              aria-label={`${s.short}: ${Math.round(s.pct * 100)}%`}
              onMouseEnter={() => handleHoverIn(s.ci)}
              onMouseLeave={handleHoverOut}
            />
          );
        })}

        {/* Labels + connector lines — only visible when expanded */}
        <AnimatePresence
          onExitComplete={() => {
            if (!expanded) onCollapseComplete?.();
          }}
        >
          {expanded && labels.map((l, idx) => {
            const isHov = activeHov === l.ci;
            const dimmed = activeHov !== null && activeHov !== l.ci;
            const pctVal = Math.round(l.pct * 100);
            const isR = l.side === 'R';
            const rX = CX + OUTER_R * Math.cos(l.mid);
            const rY = CY + OUTER_R * Math.sin(l.mid);
            const eX = isR ? rightX - 2 : leftX + 2;
            const tX = isR ? rightX : leftX;

            return (
              <motion.g
                key={`lbl-${l.ci}`}
                initial={{ opacity: 0, x: isR ? -8 : 8 }}
                animate={{
                  opacity: dimmed ? 0.35 : isHov ? 1.0 : 0.8,
                  x: 0,
                }}
                exit={{ opacity: 0, x: isR ? -8 : 8 }}
                transition={{
                  ...labelSpring,
                  delay: idx * LABEL_STAGGER + 0.25,
                }}
                style={{ pointerEvents: 'none' }}
              >
                <polyline
                  points={`${rX},${rY} ${eX},${l.y} ${tX},${l.y}`}
                  fill="none"
                  stroke={DONUT_COLORS[l.ci]}
                  strokeWidth={0.6}
                  opacity={dimmed ? 0.1 : 0.28}
                />
                <circle cx={rX} cy={rY} r={1.3} fill={DONUT_COLORS[l.ci]} opacity={dimmed ? 0.14 : 0.4} />
                <text
                  x={tX} y={l.y}
                  textAnchor={isR ? 'start' : 'end'}
                  dominantBaseline="central"
                  fill={DONUT_COLORS[l.ci]}
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="'Tomorrow', sans-serif"
                >
                  {l.short} {pctVal}%
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>

      {/* Notify expand complete after arc animation settles */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 0.7 }}
          onAnimationComplete={() => onExpandComplete?.()}
          style={{ position: 'absolute', width: 0, height: 0 }}
        />
      )}
    </div>
  );
};

export default OrbDonutMorph;
