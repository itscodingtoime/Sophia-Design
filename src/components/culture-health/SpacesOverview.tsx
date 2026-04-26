import { C } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';
import { MiniSparkline } from '../shared';
import { STUDIOS, STUDIO_DATA, getTrendWord, getStudioColor } from './constants';
import type { Studio } from './constants';
import RainbowOrb from './RainbowOrb';

export interface SpacesOverviewProps {
  studios?: Record<string, Studio>;
  studioData?: Record<string, { weeks: { warmth: number; insight?: string; phase?: string }[] }>;
  onSelect: (studioId: string) => void;
  healthLoaded?: boolean;
}

/** Direction arrow icon: up, down, or flat */
const DirectionArrow = ({ direction, color }: { direction: "up" | "down" | "flat"; color: string }) => {
  if (direction === 'up') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
};

/**
 * Grid layout of team overview cards for Culture Health page.
 * Each row shows: orb + team info | insight | direction arrow | trend + sparkline | chevron.
 */
const SpacesOverview = ({ studios, studioData, onSelect, healthLoaded = true }: SpacesOverviewProps) => {
  const allStudios = Object.values(studios || STUDIOS);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 32px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", color: C.text, letterSpacing: 0.3 }}>Culture Health</div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4 }}>Overview of team dynamics across all teams</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {allStudios.map(s => {
            const data = (studioData as Record<string, typeof STUDIO_DATA[string]> | undefined)?.[s.id] || STUDIO_DATA[s.id];
            const latestWeek = data?.weeks[data.weeks.length - 1];
            const trend = getTrendWord(s.id);
            const sparkData = data?.weeks.map(w => w.warmth) || [];
            const studioColor = getStudioColor(s.id);
            const sparkColor = studioColor;
            const keyInsight = latestWeek?.insight || s.latestObs;
            const directionColor = s.trend === 'up' ? C.teal : s.trend === 'down' ? C.red : C.amber;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  display: "flex", alignItems: "stretch", width: "100%",
                  borderRadius: 20, cursor: "pointer",
                  background: C.card, backdropFilter: "blur(24px) saturate(1.2)",
                  border: `1px solid ${C.border}`, textAlign: "left",
                  fontFamily: "'Tomorrow', sans-serif",
                  boxShadow: `0 2px 16px ${C.shadowColor}`,
                  transition: "all 0.3s ease", overflow: "hidden",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.boxShadow = `0 2px 16px ${C.shadowColor}`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Column 1: Orb + Team Info */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "24px 24px", gap: 12, minWidth: 140,
                }}>
                  {healthLoaded ? (
                    <RainbowOrb studioId={s.id} warmth={s.warmth} size={88} />
                  ) : (
                    <div style={{
                      width: 88, height: 88, borderRadius: '50%',
                      background: C.hoverBg,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: 0.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 120,
                    }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{s.description.length > 34 ? s.description.slice(0, 34) + "..." : s.description}</div>
                  </div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 2: Insight */}
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
                  padding: "20px 24px", minWidth: 0, gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <SophiaWhiteOrb size={14} animate={false} />
                    <span style={{ fontSize: 9, color: C.teal, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Latest Insight</span>
                  </div>
                  <div style={{
                    fontSize: 12.5, color: C.textSec, lineHeight: 1.65, fontStyle: "italic",
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                    WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
                  }}>
                    &ldquo;{keyInsight}&rdquo;
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500 }}>{latestWeek?.phase || ""}</div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 3: Direction arrow (replaces raw score ring) */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "20px 20px", gap: 6, minWidth: 100,
                }}>
                  <DirectionArrow direction={s.trend} color={directionColor} />
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: directionColor,
                    textTransform: 'capitalize',
                  }}>
                    {s.trend === 'up' ? 'Improving' : s.trend === 'down' ? 'Declining' : 'Steady'}
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Direction</div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 4: Trend word + sparkline */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "20px 20px", gap: 8, minWidth: 110,
                }}>
                  <div style={{ fontSize: 11, color: trend.color, fontWeight: 600, letterSpacing: 0.3 }}>{trend.word}</div>
                  <MiniSparkline data={sparkData} color={sparkColor} width={80} height={28} />
                </div>

                {/* Chevron */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: 14, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpacesOverview;
