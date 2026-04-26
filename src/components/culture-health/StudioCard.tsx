import { useState } from 'react';
import { C } from '../../theme';
import { Avatar, TrendIndicator } from '../shared';
import { STUDIO_DATA, getTrendWord, getStudioColor } from './constants';
import type { Studio } from './constants';
import RainbowOrb from './RainbowOrb';

export interface StudioCardProps {
  studio: Studio;
  isActive: boolean;
  onClick?: () => void;
}

/**
 * Sidebar list card for a single studio/team.
 * Shows orb, name, description, trend, members, and latest observation.
 */
const StudioCard = ({ studio, isActive, onClick }: StudioCardProps) => {
  const [hovered, setHovered] = useState(false);
  const studioColor = getStudioColor(studio.id);

  // Compute trend change for TrendIndicator
  const data = STUDIO_DATA[studio.id];
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
        display: "flex", alignItems: "center", gap: 24, width: "100%", padding: "24px 28px",
        background: isActive ? C.activeBg : hovered ? C.cardHover : C.card,
        backdropFilter: "blur(28px) saturate(1.2)", WebkitBackdropFilter: "blur(28px) saturate(1.2)",
        border: `1px solid ${isActive ? C.tealBorder : C.border}`,
        borderRadius: 18, cursor: "pointer", transition: "all 0.35s ease",
        fontFamily: "'Tomorrow', sans-serif", textAlign: "left",
        boxShadow: hovered ? "0 8px 36px rgba(0,0,0,0.32)" : "0 2px 16px rgba(0,0,0,0.18)",
      }}
    >
      <RainbowOrb studioId={studio.id} warmth={studio.warmth} size={72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: C.text, letterSpacing: 0.3 }}>{studio.name}</div>
          <TrendIndicator value={trendChange} />
        </div>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 10 }}>{studio.description}</div>
        <div style={{
          fontSize: 12.5, color: C.textDim, lineHeight: 1.6, fontStyle: "italic",
          overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
        }}>
          &ldquo;{studio.latestObs}&rdquo;
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {studio.members.slice(0, 4).map((m, i) => (
              <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, position: "relative", zIndex: 4 - i }}>
                <Avatar name={m.name} size={26} ringColor={studioColor} />
              </div>
            ))}
            {studio.members.length > 4 && (
              <div style={{
                marginLeft: -8, width: 26, height: 26, borderRadius: "50%",
                background: C.elevated, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 600, color: C.textDim, border: `1px solid ${C.border}`,
              }}>+{studio.members.length - 4}</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.textDim }}>{studio.members.length} members</div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: C.textDim }}>{studio.lastMeeting}</div>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? C.teal : C.textDim} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
};

export default StudioCard;
