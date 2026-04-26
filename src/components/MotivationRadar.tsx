/**
 * MotivationRadar — 7-axis radar chart for the InnerSystems motivation drivers:
 * Achievement, Influence, Connection, Autonomy, Recognition, Purpose, Growth.
 *
 * Renders a single individual or two layered series (individual vs team avg).
 */
import { driverNames, type DriverName } from '../mock-data';
import { C, useThemeMode } from '../theme';

interface RadarSeries {
  label: string;
  values: Record<DriverName, number>;
  colour: string;
  fill?: string;
}

interface MotivationRadarProps {
  size?: number;
  series: RadarSeries[];
}

const TAU = Math.PI * 2;

export function MotivationRadar({ size = 360, series }: MotivationRadarProps) {
  useThemeMode();
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const labelR = size * 0.46;

  const angle = (i: number) => (-Math.PI / 2) + (TAU * i) / driverNames.length;

  const pointFor = (driverIdx: number, value: number) => {
    const a = angle(driverIdx);
    const r = (value / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const axisPoint = (driverIdx: number, scale: number) => {
    const a = angle(driverIdx);
    return [cx + scale * R * Math.cos(a), cy + scale * R * Math.sin(a)];
  };

  // Build polygon path for a series
  const seriesPath = (s: RadarSeries) =>
    driverNames.map((d, i) => {
      const [x, y] = pointFor(i, s.values[d]);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z';

  // Concentric rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div style={{ position: 'relative', width: size, height: size + 30 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {/* Glow halo behind chart */}
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(180,255,210,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          {series.map((s, idx) => (
            <radialGradient key={`grad-${idx}`} id={`series-${idx}`} cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor={s.fill || s.colour} stopOpacity="0.45" />
              <stop offset="100%" stopColor={s.fill || s.colour} stopOpacity="0.10" />
            </radialGradient>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={R + 16} fill="url(#radarGlow)" />

        {/* Concentric polygon rings (heptagon for 7 axes) */}
        {rings.map((s) => {
          const path = driverNames.map((_, i) => {
            const [x, y] = axisPoint(i, s);
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(' ') + ' Z';
          return (
            <path
              key={s}
              d={path}
              fill="none"
              stroke={C.border}
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          );
        })}

        {/* Spokes */}
        {driverNames.map((_, i) => {
          const [x, y] = axisPoint(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.border} strokeWidth={1} strokeOpacity={0.25} />;
        })}

        {/* Series fills */}
        {series.map((s, idx) => (
          <path key={`fill-${idx}`} d={seriesPath(s)} fill={`url(#series-${idx})`} stroke={s.colour} strokeWidth={1.8} strokeLinejoin="round" />
        ))}

        {/* Series points */}
        {series.map((s, idx) => driverNames.map((d, i) => {
          const [x, y] = pointFor(i, s.values[d]);
          return (
            <circle key={`pt-${idx}-${i}`} cx={x} cy={y} r={3} fill={s.colour} stroke={C.bg} strokeWidth={1.5} />
          );
        }))}

        {/* Labels */}
        {driverNames.map((d, i) => {
          const a = angle(i);
          const lx = cx + labelR * Math.cos(a);
          const ly = cy + labelR * Math.sin(a);
          const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
          return (
            <text
              key={d}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dy={Math.sin(a) > 0.2 ? 12 : Math.sin(a) < -0.2 ? -4 : 4}
              fontSize={11}
              fontFamily="'Futura', 'Tomorrow', sans-serif"
              fontWeight={600}
              fill={C.text}
              style={{ letterSpacing: 0.5 }}
            >
              {d}
            </text>
          );
        })}

        {/* Driver values along the axis (inside) */}
        {series[0] && driverNames.map((d, i) => {
          const a = angle(i);
          const r = (series[0].values[d] / 100) * R;
          const x = cx + (r + 14) * Math.cos(a);
          const y = cy + (r + 14) * Math.sin(a);
          return (
            <text
              key={`val-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={10}
              fontFamily="'Tomorrow', sans-serif"
              fill={series[0].colour}
              opacity={0.85}
            >
              {series[0].values[d]}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
        {series.map((s, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSec, fontFamily: "'Tomorrow', sans-serif" }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.colour }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MotivationRadar;
