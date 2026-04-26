import { useState } from 'react';
import { C } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';
import { Avatar, MiniSparkline, TrendIndicator } from '../shared';
import { STUDIO_DATA, SOPHIA_PROMPTS, getTrendWord, getStudioColor } from './constants';
import type { Studio, StudioDataEntry } from './constants';
import RainbowOrb from './RainbowOrb';

export interface SpaceCardProps {
  studio: Studio;
  studioData?: StudioDataEntry;
  onClick?: () => void;
}

/**
 * Grid card for team overview in SpacesOverview.
 * Shows orb, name, SOPHIA chat bubble, trend graph, key insight, and team members.
 */
const SpaceCard = ({ studio, studioData, onClick }: SpaceCardProps) => {
  const [hovered, setHovered] = useState(false);
  const [bubbleHover, setBubbleHover] = useState(false);
  const data = studioData || STUDIO_DATA[studio.id];
  const sparkData = data?.weeks.map(w => w.warmth) || [];
  const color = getStudioColor(studio.id);
  const trend = getTrendWord(studio.id);
  // Get latest insight
  const latestWeek = data?.weeks[data.weeks.length - 1];
  const keyInsight = latestWeek?.insight || studio.latestObs;
  const sophiaPrompt = SOPHIA_PROMPTS[studio.id] || "What patterns should I explore with this team?";

  // Compute trend change for TrendIndicator
  const weeks = data?.weeks || [];
  const trendChange = weeks.length >= 2
    ? (() => {
        const current = weeks[weeks.length - 1].warmth;
        const previous = weeks[weeks.length - 2].warmth;
        return previous > 0 ? ((current - previous) / previous) * 100 : 0;
      })()
    : 0;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", width: "100%", padding: "28px 24px",
        background: hovered ? C.cardHover : C.card,
        backdropFilter: "blur(28px) saturate(1.2)", WebkitBackdropFilter: "blur(28px) saturate(1.2)",
        border: `1px solid ${C.border}`,
        borderRadius: 18, cursor: "pointer", transition: "all 0.35s ease",
        fontFamily: "'Tomorrow', sans-serif", textAlign: "left",
        boxShadow: hovered ? "0 8px 36px rgba(0,0,0,0.32)" : "0 2px 16px rgba(0,0,0,0.18)",
        position: "relative",
      }}
    >
      {/* Top: Orb + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <RainbowOrb studioId={studio.id} warmth={studio.warmth} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: 0.3 }}>{studio.name}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{studio.description}</div>
        </div>
      </div>

      {/* SOPHIA chat bubble -- own row */}
      <div
        style={{ position: "relative", marginBottom: 14 }}
        onMouseEnter={() => setBubbleHover(true)}
        onMouseLeave={() => setBubbleHover(false)}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px",
          background: bubbleHover ? C.tealGlow : C.hoverBg,
          border: `1px solid ${bubbleHover ? C.tealBorder : C.border}`,
          borderRadius: 14, transition: "all 0.25s", cursor: "default",
        }}>
          <SophiaWhiteOrb size={20} animate={false} />
          <div style={{ fontSize: 11.5, color: bubbleHover ? C.text : C.textSec, lineHeight: 1.4, fontStyle: "italic" }}>
            {sophiaPrompt}
          </div>
        </div>
      </div>

      {/* 3 equal sections with dividers: Graph + % | Insight | Team */}
      <div style={{
        display: "flex",
        background: C.hoverBg, borderRadius: 12,
        border: `1px solid ${C.border}`,
      }}>
        {/* Section 1: Graph + Trend % */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8,
          padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textSec, letterSpacing: 0.3 }}>{trend.word}</div>
            <TrendIndicator value={trendChange} />
          </div>
          <MiniSparkline data={sparkData} color={color} width={160} height={28} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", margin: "10px 0", background: C.border }} />

        {/* Section 2: Key Insight */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{
            fontSize: 11.5, color: C.textDim, lineHeight: 1.55, fontStyle: "italic",
            overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
            WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
          }}>
            &ldquo;{keyInsight}&rdquo;
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", margin: "10px 0", background: C.border }} />

        {/* Section 3: Team */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 5, padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, maxWidth: 72 }}>
            {studio.members.slice(0, 6).map((m, i) => (
              <div key={i}><Avatar name={m.name} size={24} ringColor={color} /></div>
            ))}
          </div>
          {studio.members.length > 6 && (
            <span style={{ fontSize: 10, color: C.textDim }}>+{studio.members.length - 6}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 10 }}>{studio.lastMeeting}</div>
    </button>
  );
};

export default SpaceCard;
