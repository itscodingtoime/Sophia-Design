export interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Smooth cubic-bezier SVG sparkline chart with glowing endpoint.
 * Pure component -- no external deps beyond props.
 */
const MiniSparkline = ({ data, color = '#C0E689', width = 80, height = 28 }: MiniSparklineProps) => {
  if (data.length < 2) return null;

  const min = Math.min(...data) - 0.05;
  const max = Math.max(...data) + 0.05;
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  // Catmull-Rom -> cubic bezier smooth curve (no straight segments)
  const tension = 0.3;
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  const last = pts[pts.length - 1];
  // Build filled area path: line path + close to bottom-right -> bottom-left
  const areaD = d + ` L${pts[pts.length - 1].x.toFixed(2)},${height} L${pts[0].x.toFixed(2)},${height} Z`;

  // Unique gradient ID based on color to avoid SVG ID collisions when multiple sparklines render
  const gradientId = `spark-fill-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
      />
      {/* Glowing endpoint -- concentric rings fading outward (static, no animation) */}
      <circle cx={last.x} cy={last.y} r="5" fill={color} opacity="0.12" />
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} opacity="0.3" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
};

export default MiniSparkline;
