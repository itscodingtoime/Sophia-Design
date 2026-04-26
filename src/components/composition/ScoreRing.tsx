import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showGlow?: boolean;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  showGlow = true,
}) => {
  useThemeMode();
  const ringColor = color ?? C.teal;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const dash = circ * pct;
  const gap = circ - dash;

  // Compute arc endpoint for glowing terminator dot
  const angle = pct * 2 * Math.PI;
  const cx = size / 2;
  const cy = size / 2;
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy + r * Math.sin(angle);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={C.border}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Foreground arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth + 0.5}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${ringColor}44)`,
            transition: 'stroke-dasharray 0.6s ease',
          }}
        />
        {/* Glowing terminator dot */}
        {showGlow && pct > 0.02 && (
          <>
            <circle cx={dotX} cy={dotY} r={size * 0.065} fill={ringColor} opacity={0.15} />
            <circle cx={dotX} cy={dotY} r={size * 0.045} fill={ringColor} opacity={0.4} />
            <circle
              cx={dotX}
              cy={dotY}
              r={size * 0.028}
              fill="#fff"
              style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
            />
          </>
        )}
      </svg>
      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: size * 0.3,
            fontWeight: 300,
            fontFamily: "'JetBrains Mono', monospace",
            color: C.text,
            lineHeight: 1,
          }}
        >
          {label ?? score}
        </div>
      </div>
    </div>
  );
};
