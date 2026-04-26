import { useState, useEffect } from 'react';
import { C } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';
import { Avatar } from '../shared';
import {
  STUDIOS, STUDIO_DATA, STUDIO_FEATURES,
  FEATURE_LABELS, DONUT_COLORS, DIMENSION_DESCRIPTIONS,
  getTrendWord, getStudioColor,
} from './constants';
import type { Studio, StudioDataEntry, PeriodData } from './constants';
import RainbowOrb from './RainbowOrb';
import OrbDonutMorph from './OrbDonutMorph';
import ScoringWeightsSliders from './ScoringWeightsSliders';

/** Render basic markdown (bold/italic) as React elements */
const renderMarkdown = (text: string) => {
  // Split on **bold** and *italic* markers, return React fragments
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
};
import { getTeamTrends } from '../../services/api';
import { useSophiaAuth } from '../../hooks/useSophiaAuth';

export interface SpaceDetailProps {
  studioId: string;
  studio?: Studio;
  studioData?: StudioDataEntry;
  studioFeatures?: Record<string, number>;
  onClose?: () => void;
  onTrendClick?: (periodKey: string) => void;
  selectedPeriodKey?: string | null;
  trendDetailSlot?: React.ReactNode;
  // Phase 08.8: Configurable weights
  teamWeights?: Record<string, number>;  // word-keyed: { ownership: 0.10, ... }
  isAdmin?: boolean;
  weightUpdatedBy?: string | null;
  onSaveWeights?: (weights: Record<string, number>) => Promise<void>;
  refreshKey?: number;  // Increments on weight save to trigger trend data re-fetch
  // Phase 08.11: Close animation support
  isClosing?: boolean;
  onCollapseComplete?: () => void;
  // Voiceprint enrollment status: userId → enrolled
  voiceprintStatus?: Record<string, boolean>;
}

/** Direction arrow icon */
const DirectionArrow = ({ direction, size = 20 }: { direction: "up" | "down" | "flat"; size?: number }) => {
  const color = direction === 'up' ? C.teal : direction === 'down' ? C.red : C.amber;
  if (direction === 'up') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
};

/**
 * Full detail pane for selected team/space.
 * Layout order: hero orb, orb+explanation card, insight, donut, scoring weight sliders,
 * trend chart, trend detail, start/stop/keep, team members, insight history.
 */
const SpaceDetail = ({
  studioId, studio: studioProp, studioData: dataProp, onClose, onTrendClick, selectedPeriodKey, trendDetailSlot,
  teamWeights, isAdmin, weightUpdatedBy, onSaveWeights, refreshKey,
  isClosing, onCollapseComplete, voiceprintStatus,
}: SpaceDetailProps) => {
  const studio = studioProp || STUDIOS[studioId];
  const data = dataProp || STUDIO_DATA[studioId];
  const { getApiToken } = useSophiaAuth();

  const [trendPeriod, setTrendPeriod] = useState<"week" | "month" | "year">("week");
  const [trendData, setTrendData] = useState<{ date: string; avg_score: number | null; count: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const [timeframe, setTimeframe] = useState<"weeks" | "months" | "quarters">("weeks");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showInsightHistory, setShowInsightHistory] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [hoveredDimIdx, setHoveredDimIdx] = useState<number | null>(null);
  const [orbExpanded, setOrbExpanded] = useState(false);

  useEffect(() => { setSelectedIdx(null); setTimeframe("weeks"); setTrendPeriod("week"); setOrbExpanded(false); }, [studioId]);

  // Reverse morph: collapse orb back when closing
  useEffect(() => {
    if (isClosing) setOrbExpanded(false);
  }, [isClosing]);

  // Fetch trend data from API when period changes
  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const apiPeriod = { week: "day", month: "week", year: "month" }[trendPeriod] ?? "day";
        const resp = await getTeamTrends(studioId, apiPeriod, token);
        if (!cancelled) {
          setTrendData(resp.trends || []);
        }
      } catch {
        // API unavailable -- keep empty
        if (!cancelled) setTrendData([]);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studioId, trendPeriod, getApiToken, refreshKey]);

  if (!studio) return null;

  const timeframeLabels = { weeks: "Weeks", months: "Months", quarters: "Quarters" };
  const timeframeOptions: ("weeks" | "months" | "quarters")[] = ["weeks", "months", "quarters"];
  const periods = data ? (data[timeframe] || []) : [];

  /** Format raw period_key into a readable x-axis label */
  const formatPeriodLabel = (label: string, period: "week" | "month" | "year"): string => {
    if (period === "week") {
      // "2025-11-14" → "Nov 14"
      const d = new Date(label + "T00:00:00");
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return label;
    }
    if (period === "month") {
      // "2025-W46" → "Nov 11" (Monday of that ISO week)
      const m = label.match(/(\d{4})-W(\d+)/);
      if (m) {
        const year = parseInt(m[1]), week = parseInt(m[2]);
        const jan4 = new Date(year, 0, 4);
        const dow = jan4.getDay() || 7;
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
        return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return label;
    }
    // year view: "2025-11" → "Nov '25"
    const m = label.match(/(\d{4})-(\d{2})/);
    if (m) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m[2]) - 1] ?? label} '${m[1].slice(2)}`;
    }
    return label;
  };
  const activeIdx = selectedIdx !== null && selectedIdx < periods.length ? selectedIdx : periods.length - 1;
  const activePeriod = periods[activeIdx];
  const currentWarmth = studio.warmth || 0;
  const trend = getTrendWord(studioId);

  const graphColor = getStudioColor(studioId);
  const graphColorDim = graphColor + "26";
  const graphColorMid = graphColor + "66";
  const graphGlow = graphColor + "99";

  // Build chart points from trend API data
  const chartPoints = trendData
    .filter(t => t.avg_score !== null)
    .map(t => ({
      label: (() => { const d = new Date(t.date); return t.date && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : t.date || '—'; })(),
      warmth: t.avg_score!, // already 0-1 scale from on-the-fly health computation
      period_key: (t as any).period_key as string | null,
    }));

  // Use API trend data for the chart if available, otherwise fall back to periods
  const chartSource = chartPoints.length > 0 ? chartPoints : periods.map(p => ({ label: p.label, warmth: p.warmth, period_key: null as string | null }));

  // Period toggle labels for API-backed trends
  const trendPeriodLabels = { week: "Week", month: "Month", year: "Year" };
  const trendPeriodOptions: ("week" | "month" | "year")[] = ["week", "month", "year"];

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <style>{`@keyframes fadeSlideRight { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* 1. HERO: Orb/Donut (left) + Measurement Card (right when open) */}
      <div style={{
        display: 'flex',
        flexDirection: showExplanation ? 'row' : 'column',
        alignItems: showExplanation ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: showExplanation ? '32px 32px 24px' : '48px 32px 24px',
        background: `radial-gradient(ellipse 90% 80% at 50% 45%, ${C.hoverBg}, transparent)`,
        position: 'relative', zIndex: 5,
        gap: showExplanation ? 32 : 0,
        flexWrap: 'wrap',
      }}>
        {/* Left column: Orb/Donut + team info + toggle */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          flexShrink: 0,
          minWidth: showExplanation ? 320 : undefined,
        }}>
          {/* Orb → Donut transition area */}
          <div style={{
            position: 'relative',
            width: orbExpanded ? 320 : 120,
            height: orbExpanded ? 320 : 120,
            transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1), height 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* RainbowOrb — fades out when expanded */}
            <div
              onClick={() => { if (!orbExpanded) setOrbExpanded(true); }}
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                opacity: orbExpanded ? 0 : 1,
                scale: orbExpanded ? '0.6' : '1',
                transition: 'opacity 0.4s ease, scale 0.5s ease',
                pointerEvents: orbExpanded ? 'none' : 'auto',
                cursor: 'pointer',
                zIndex: 2,
              }}
              title="Click to explore dimensions"
            >
              <RainbowOrb studioId={studioId} warmth={currentWarmth} size={120} />
            </div>
            {/* OrbDonutMorph — always mounted, arcs animate themselves via framer-motion */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              pointerEvents: orbExpanded ? 'auto' : 'none',
              zIndex: 1,
            }}>
              <OrbDonutMorph
                studioId={studioId}
                warmth={currentWarmth}
                expanded={orbExpanded && !isClosing}
                features={STUDIO_FEATURES[studioId]}
                hoveredIndex={hoveredDimIdx}
                onHoverSegment={setHoveredDimIdx}
                onCollapseComplete={onCollapseComplete}
              />
            </div>
          </div>
          {/* Team name */}
          <div style={{ fontSize: 22, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", letterSpacing: 0.3, color: C.text, textAlign: 'center', marginTop: 8 }}>
            {studio.name}
          </div>
          {/* Description */}
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, textAlign: 'center' }}>
            {studio.description}
          </div>
          {/* Trend indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <DirectionArrow direction={studio.trend} size={28} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontSize: 13.5, fontWeight: 600,
                  color: studio.trend === 'up' ? C.teal : studio.trend === 'down' ? C.red : C.amber,
                }}>
                  {studio.trend === 'up' ? 'Improving' : studio.trend === 'down' ? 'Declining' : 'Steady'}
                </span>
                <span style={{ fontSize: 12, color: trend.color, fontWeight: 600 }}>{trend.word}</span>
              </div>
              <span style={{ fontSize: 11, color: C.textDim }}>{activePeriod?.phase || ''}</span>
            </div>
          </div>
          {/* What SOPHIA Measures toggle */}
          <button
            onClick={() => setShowExplanation(e => !e)}
            style={{
              marginTop: 16, padding: '4px 16px', borderRadius: 8,
              background: showExplanation ? C.activeBg : C.hoverBg,
              border: `1px solid ${showExplanation ? C.tealBorder : C.border}`,
              color: showExplanation ? C.teal : C.textDim,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif", letterSpacing: 0.5,
              transition: 'all 0.2s',
            }}
          >
            {showExplanation ? 'Hide' : 'What SOPHIA Measures'}
          </button>
        </div>

        {/* Right column: Measurement Card (when toggled) */}
        {showExplanation && (
          <div style={{
            flex: 1, minWidth: 280,
            background: C.card, borderRadius: 14,
            padding: '16px 24px',
            border: `1px solid ${C.border}`,
            boxShadow: `0 2px 12px ${C.shadowColor}`,
            animation: 'fadeSlideRight 0.25s ease',
            maxHeight: 520, overflowY: 'auto',
          }}>
            {/* Section A: Dimension Explanations with cross-highlight */}
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.textDim,
              textTransform: 'uppercase', letterSpacing: 1.2,
              fontFamily: "'Tomorrow', sans-serif",
              marginBottom: 8,
            }}>
              What SOPHIA Measures
            </div>
            <dl style={{ margin: 0 }}>
              {FEATURE_LABELS.map((f, i) => (
                <div
                  key={f.key}
                  onMouseEnter={() => setHoveredDimIdx(i)}
                  onMouseLeave={() => setHoveredDimIdx(null)}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '8px 0',
                    background: hoveredDimIdx === i ? `${DONUT_COLORS[i]}10` : 'transparent',
                    opacity: hoveredDimIdx !== null && hoveredDimIdx !== i ? 0.5 : 1,
                    transition: 'all 200ms ease',
                    borderRadius: 6,
                    cursor: 'default',
                  }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: DONUT_COLORS[i],
                    marginTop: 4, flexShrink: 0, marginLeft: 4,
                  }} />
                  <div style={{ fontSize: 12, lineHeight: 1.6, fontFamily: "'Tomorrow', sans-serif" }}>
                    <dt style={{ display: 'inline', fontWeight: 600, color: DONUT_COLORS[i] }}>
                      {f.short}
                    </dt>
                    <span style={{ color: C.textDim }}> -- </span>
                    <dd style={{ display: 'inline', margin: 0, fontWeight: 400, color: C.textSec }}>
                      {DIMENSION_DESCRIPTIONS[f.key]}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            {/* Spacer (24px whitespace divider) */}
            <div style={{ height: 24 }} />

            {/* Section B: Weight Sliders */}
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.textDim,
              textTransform: 'uppercase', letterSpacing: 1.2,
              fontFamily: "'Tomorrow', sans-serif",
              marginBottom: 8,
            }}>
              Dimension Importance
            </div>
            {(teamWeights && onSaveWeights) ? (
              <ScoringWeightsSliders
                weights={teamWeights}
                isAdmin={isAdmin || false}
                updatedBy={weightUpdatedBy}
                onSave={onSaveWeights}
              />
            ) : (
              <div style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic' }}>
                No weight configuration available
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONTENT: Single column stacked cards */}
      <div style={{
        padding: "0 32px 32px", maxWidth: 960, margin: "0 auto", overflow: "visible",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* 2. Insight card + trend chart combined */}
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14,
            padding: "16px 24px",
            border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.teal}`,
            boxShadow: `0 2px 12px ${C.shadowColor}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <SophiaWhiteOrb size={16} animate={false} />
              <div style={{ fontSize: 11, color: C.teal, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Insight</div>
              <div style={{ flex: 1 }} />
              {/* Period toggle inline with insight header */}
              <div style={{ display: "flex", gap: 4 }}>
                {trendPeriodOptions.map(tp => (
                  <button key={tp} onClick={() => setTrendPeriod(tp)} style={{
                    padding: "2px 8px", borderRadius: 8, fontSize: 9, fontWeight: trendPeriod === tp ? 600 : 400,
                    fontFamily: "'Tomorrow', sans-serif", cursor: "pointer", letterSpacing: 0.3,
                    background: trendPeriod === tp ? C.tealGlow : "transparent",
                    border: `1px solid ${trendPeriod === tp ? C.tealBorder : "transparent"}`,
                    color: trendPeriod === tp ? C.teal : C.textDim, transition: "all 0.2s",
                  }}>{trendPeriodLabels[tp]}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, fontWeight: 400, marginBottom: 16 }}>
              {renderMarkdown(studio.latestObs || (activePeriod?.insight) || 'No observations yet')}
            </div>
            {/* Trend chart inline */}
            <div style={{ position: "relative", height: 120, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 10, gap: 6 }}>
              {trendPeriodOptions.map(tp => (
                <button key={tp} onClick={() => setTrendPeriod(tp)} style={{
                  padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: trendPeriod === tp ? 600 : 400,
                  fontFamily: "'Tomorrow', sans-serif", cursor: "pointer", letterSpacing: 0.3,
                  background: trendPeriod === tp ? C.tealGlow : "transparent",
                  border: `1px solid ${trendPeriod === tp ? C.tealBorder : "transparent"}`,
                  color: trendPeriod === tp ? C.teal : C.textDim, transition: "all 0.2s",
                }}>{trendPeriodLabels[tp]}</button>
              ))}
            </div>
            <div style={{ position: "relative", height: 140 }}>
              {trendLoading ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: C.textDim, fontSize: 11,
                }}>
                  Loading trends...
                </div>
              ) : chartSource.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: C.textDim, fontSize: 11,
                }}>
                  No trend data yet
                </div>
              ) : (() => {
                const vh = 120;
                const padPct = 4;
                const usablePct = 100 - padPct * 2;
                const gapPct = chartSource.length > 1 ? usablePct / (chartSource.length - 1) : 0;
                const pxPct = (i: number) => padPct + i * gapPct;
                const py = (w: number) => vh - w * vh;
                const pyPct = (w: number) => ((1 - w) * 100);
                return (<>
                  <svg width="100%" height={vh} style={{ overflow: "visible", position: "absolute", inset: 0 }}>
                    <line x1={`${padPct}%`} y1={vh * 0.65} x2={`${100 - padPct}%`} y2={vh * 0.65} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                    <line x1={`${padPct}%`} y1={vh * 0.45} x2={`${100 - padPct}%`} y2={vh * 0.45} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                    <line x1={`${padPct}%`} y1={vh * 0.25} x2={`${100 - padPct}%`} y2={vh * 0.25} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                  </svg>
                  <svg width="100%" height={vh} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" style={{ overflow: "visible", position: "absolute", inset: 0 }}>
                    {chartSource.length > 1 && (() => {
                      const cPts = chartSource.map((p, i) => ({ x: pxPct(i), y: py(p.warmth) }));
                      const t = 0.3;
                      let d = `M${cPts[0].x},${cPts[0].y}`;
                      for (let j = 0; j < cPts.length - 1; j++) {
                        const q0 = cPts[Math.max(0, j - 1)], q1 = cPts[j], q2 = cPts[j + 1], q3 = cPts[Math.min(cPts.length - 1, j + 2)];
                        d += ` C${q1.x + (q2.x - q0.x) * t},${q1.y + (q2.y - q0.y) * t} ${q2.x - (q3.x - q1.x) * t},${q2.y - (q3.y - q1.y) * t} ${q2.x},${q2.y}`;
                      }
                      const areaD = d + ` L${cPts[cPts.length - 1].x},${vh} L${cPts[0].x},${vh} Z`;
                      return (<>
                        <defs>
                          <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={graphColor} stopOpacity="0.16" />
                            <stop offset="100%" stopColor={graphColor} stopOpacity="0.01" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#chart-area-fill)" />
                        <path d={d} fill="none" stroke={graphColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${graphGlow})` }} />
                      </>);
                    })()}
                  </svg>
                  {/* Dots as HTML so they don't stretch */}
                  {chartSource.map((p, i) => {
                    const isSelected = selectedPeriodKey != null && p.period_key === selectedPeriodKey;
                    const isLast = i === chartSource.length - 1;
                    return (
                    <div key={i} onClick={() => {
                      if (p.period_key && onTrendClick) onTrendClick(p.period_key);
                    }} style={{
                      position: "absolute", left: `${pxPct(i)}%`, top: `${pyPct(p.warmth)}%`,
                      transform: "translate(-50%, -50%)", cursor: "pointer", zIndex: 2,
                    }}>
                      {(isLast || isSelected) && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: isSelected ? `${C.teal}30` : graphColorDim, border: `1px solid ${isSelected ? C.teal : graphColorMid}` }} />}
                      <div style={{
                        width: isLast || isSelected ? 7 : 5, height: isLast || isSelected ? 7 : 5, borderRadius: "50%",
                        background: isSelected ? C.teal : isLast ? graphColor : C.textDim,
                        border: isLast || isSelected ? `1px solid ${isSelected ? C.teal : C.text}` : "none",
                        transition: "all 0.3s", position: "relative",
                        boxShadow: isSelected ? `0 0 8px ${C.teal}` : isLast ? `0 0 6px ${graphGlow}` : "none",
                      }} />
                      <div style={{ position: "absolute", inset: -14, borderRadius: "50%" }} />
                    </div>
                    );
                  })}
                </>);
              })()}
            </div>
            {chartSource.length > 0 && !trendLoading && (
              <div style={{ display: "flex", gap: 2 }}>
                {chartSource.map((p, i) => {
                  const isLast = i === chartSource.length - 1;
                  // Thin out labels when there are many points — always show first, last, and every Nth
                  const step = chartSource.length > 12 ? Math.ceil(chartSource.length / 6) : 1;
                  const show = isLast || i === 0 || i % step === 0;
                  return (
                  <div key={`trend-label-${i}`} style={{
                    flex: 1, textAlign: "center", fontSize: 9,
                    color: isLast ? C.text : C.textDim,
                    fontWeight: isLast ? 600 : 400,
                    visibility: show ? 'visible' : 'hidden',
                  }}>{show ? formatPeriodLabel(p.label, trendPeriod) : ''}</div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Close combined insight+trend card */}
          </div>

          {/* 3. Trend detail slot — right below the chart it came from */}
          {trendDetailSlot && (
            <div ref={el => { if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' })); }}
              style={{ position: 'relative', zIndex: 2 }}>
              {trendDetailSlot}
            </div>
          )}

          {/* 5. Start / Stop / Keep */}
          {activePeriod && (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* START */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid #7ED68A`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7ED68A" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  <div style={{ fontSize: 11, color: "#7ED68A", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Start</div>
                </div>
                {activePeriod.start.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.start.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7ED68A", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>

              {/* STOP */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid ${C.amber}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Stop</div>
                </div>
                {activePeriod.stop.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.stop.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.amber, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>

              {/* KEEP */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid #7EC8E0`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7EC8E0" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <div style={{ fontSize: 11, color: "#7EC8E0", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Keep</div>
                </div>
                {activePeriod.keep.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.keep.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7EC8E0", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* 6. Team Members */}
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 24px",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 16 }}>Team</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
              {studio.members.map((m, i) => {
                const isEnrolled = !!(m.userId && voiceprintStatus?.[m.userId]);
                return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 95 }}>
                  <Avatar name={m.name} size={68} ringColor={isEnrolled ? C.teal : `${graphColor}44`} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500, lineHeight: 1.3 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{m.roleTitle || m.role}</div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* 10. Insight History -- expandable timeline */}
          {periods.length > 0 && (
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14,
            border: `1px solid ${C.border}`, boxShadow: `0 2px 12px ${C.shadowColor}`, overflow: "hidden",
          }}>
            <button
              onClick={() => setShowInsightHistory(!showInsightHistory)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "14px 22px",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
                  Insight History
                </span>
                <span style={{ fontSize: 10, color: C.textDim, opacity: 0.6 }}>({periods.length})</span>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: showInsightHistory ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease" }}
              ><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showInsightHistory && (
              <div style={{ padding: "0 22px 18px", animation: "donutIn 0.25s ease-out" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {periods.slice().reverse().map((p, i) => {
                    const isActive = (periods.length - 1 - i) === activeIdx;
                    return (
                      <div key={i} style={{
                        display: "flex", gap: 14, padding: "12px 0",
                        borderBottom: i < periods.length - 1 ? `1px solid ${C.border}` : "none",
                        opacity: isActive ? 1 : 0.75,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onClick={() => setSelectedIdx(periods.length - 1 - i)}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = isActive ? "1" : "0.75")}
                      >
                        {/* Timeline dot + line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5, width: 12, flexShrink: 0 }}>
                          <div style={{
                            width: isActive ? 10 : 7, height: isActive ? 10 : 7, borderRadius: "50%",
                            background: isActive ? graphColor : C.textDim,
                            boxShadow: isActive ? `0 0 6px ${graphGlow}` : "none",
                            transition: "all 0.2s",
                          }} />
                          {i < periods.length - 1 && (
                            <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: isActive ? C.text : C.textSec,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>{p.label}</span>
                            <span style={{ fontSize: 10, color: C.textDim }}>{p.phase}</span>
                            {isActive && (
                              <span style={{
                                fontSize: 8, color: graphColor, background: graphColorDim,
                                padding: "1px 6px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                              }}>Current</span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 12, color: C.textSec, lineHeight: 1.6, fontStyle: "italic",
                          }}>
                            &ldquo;{renderMarkdown(p.insight)}&rdquo;
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SpaceDetail;
