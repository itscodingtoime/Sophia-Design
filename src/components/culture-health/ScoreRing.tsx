import { C } from '../../theme';

export interface ScoreRingProps {
  score: number;
  color: string;
  size?: number;
}

/**
 * Score Ring -- donut chart with glowing terminator dot.
 * Shows a percentage arc with a pulsing endpoint dot.
 */
const ScoreRing = ({ score, color, size = 72 }: ScoreRingProps) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const dash = circ * pct;
  const gap = circ - dash;
  // Compute arc endpoint for glowing terminator dot
  const angle = pct * 2 * Math.PI;
  const dotX = size / 2 + r * Math.cos(angle);
  const dotY = size / 2 + r * Math.sin(angle);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={5} opacity={0.3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5.5}
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}44)`, transition: "stroke-dasharray 0.6s ease" }} />
        {/* Glowing terminator dot at arc tip */}
        {pct > 0.02 && (
          <>
            <circle cx={dotX} cy={dotY} r={size * 0.065} fill={color} opacity="0.15" />
            <circle cx={dotX} cy={dotY} r={size * 0.045} fill={color} opacity="0.4" />
            <circle cx={dotX} cy={dotY} r={size * 0.028} fill="#fff" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          </>
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 0,
      }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 300, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {score}
        </div>
      </div>
    </div>
  );
};

export default ScoreRing;
