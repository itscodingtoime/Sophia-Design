import { C, useThemeMode } from '../../theme';

export interface GrowthRing {
  label: string;
  detail?: string;
  progress: number;
  color: string;
  bgColor?: string;
}

export interface GrowthRingsProps {
  rings: GrowthRing[];
  /** SVG canvas size in px (default 160) */
  size?: number;
}

/**
 * Concentric progress rings (typically 3) with a legend.
 * Each ring shows progress as a filled arc with glow effect.
 */
const GrowthRings = ({ rings, size = 160 }: GrowthRingsProps) => {
  useThemeMode();
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 12;
  const gap = 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => {
          const radius = size / 2 - strokeWidth / 2 - (strokeWidth + gap) * i - 10;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference * (1 - ring.progress);
          return (
            <g key={i}>
              <circle
                cx={cx} cy={cy} r={radius}
                fill="none"
                stroke={ring.bgColor || C.border}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <circle
                cx={cx} cy={cy} r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  filter: `drop-shadow(0 0 6px ${ring.color}60)`,
                  transition: 'stroke-dashoffset 1s ease',
                }}
              />
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, width: '100%' }}>
        {rings.map((ring, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: ring.color,
              boxShadow: `0 0 6px ${ring.color}50`,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{ring.label}</div>
              {ring.detail && (
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>{ring.detail}</div>
              )}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: ring.color,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {Math.round(ring.progress * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GrowthRings;
