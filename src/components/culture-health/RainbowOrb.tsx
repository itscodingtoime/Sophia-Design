import { C, useThemeMode } from '../../theme';
import { FEATURE_LABELS, DONUT_COLORS, STUDIOS, STUDIO_FEATURES, buildConicGradient } from './constants';

export interface RainbowOrbProps {
  studioId: string;
  warmth?: number;
  size?: number;
}

/**
 * Rainbow Orb -- feature-color conic gradient with liquid fill + outer ring.
 * Complex SVG animated orb with 3-layer wave surface and conic gradient based on feature weights.
 * Preserves ALL visual details: gradient layers, glow effects, animation from SophiaV2.
 */
const RainbowOrb = ({ studioId, warmth = 0, size = 120 }: RainbowOrbProps) => {
  useThemeMode(); // Subscribe to theme changes for C.hoverBg re-renders
  const w = Math.max(0, Math.min(1, warmth));
  const conicGrad = buildConicGradient(studioId);
  const fillPct = w * 100;
  const glowAlpha = 0.04 + w * 0.36;
  const edgeAlpha = 0.06 + w * 0.16;
  const specAlpha = 0.15 + w * 0.5;
  // Wave amplitude -- gentle, subtle motion
  const waveAmp = size * 0.045 * Math.max(0.25, Math.min(w, 1 - w, 0.45) / 0.45);
  const waveY = size * (1 - w);
  // Unique animation offset per studio
  const animDelay = studioId === "sales" ? 0 : studioId === "product" ? -2.5 : -5;
  // Outer ring sizing
  const ringGap = Math.max(3, size * 0.06);
  const ringWidth = Math.max(1.5, size * 0.02);
  const totalSize = size + (ringGap + ringWidth) * 2;
  const features = STUDIO_FEATURES[studioId];
  const hasData = features && Object.keys(features).length > 0;
  const oc = STUDIOS[studioId]?.orbColors;
  // Ring color derived from dominant feature color (matches donut ring)
  const domFeature = features ? FEATURE_LABELS.map((f, i) => ({ w: features[f.key] || 0, ci: i })).sort((a, b) => b.w - a.w)[0] : null;
  const domHex = domFeature ? DONUT_COLORS[domFeature.ci] : null;
  const ringColor = hasData
    ? (domHex ? `${domHex}${Math.round((0.25 + w * 0.45) * 255).toString(16).padStart(2, '0')}` : (oc ? `hsla(${oc.primary},60%,60%,${0.25 + w * 0.45})` : `rgba(127,193,170,${0.2 + w * 0.4})`))
    : 'rgba(120, 120, 125, 0.25)';
  const ringGlow = hasData
    ? (domHex ? `${domHex}${Math.round((w * 0.3) * 255).toString(16).padStart(2, '0')}` : (oc ? `hsla(${oc.primary},70%,65%,${w * 0.3})` : "transparent"))
    : 'transparent';

  return (
    <div style={{ position: "relative", width: totalSize, height: totalSize, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.6s ease-out", animation: "fadeIn 0.6s ease-out" }}>
      {/* Outer ring */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `${ringWidth}px solid ${ringColor}`,
        boxShadow: `0 0 ${size * 0.08}px ${ringGlow}, inset 0 0 ${size * 0.04}px ${ringGlow}`,
        animation: "crystalPulse 6s ease-in-out infinite alternate",
        transition: "border-color 0.6s ease, box-shadow 0.6s ease",
      }} />
      {/* Floor glow */}
      {hasData && w > 0.1 && <div style={{
        position: "absolute", bottom: ringGap * 0.3, left: "15%", width: "70%", height: "35%", borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(232,145,58,${glowAlpha * 0.6}) 0%, rgba(232,145,58,${glowAlpha * 0.25}) 50%, transparent 75%)`,
        filter: `blur(${size * 0.12}px)`, zIndex: 0,
      }} />}
      {/* Main sphere shell -- centered inside the ring */}
      <div style={{
        position: "relative", width: size, height: size, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: C.hoverBg,
      }}>
        {/* Empty glass top */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 65%)`,
          zIndex: 1,
        }} />
        {/* Liquid fill with animated wave surface -- 3 layers for more dynamic motion */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <defs>
            <clipPath id={`wave-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="2.8s"
                  repeatCount="indefinite"
                  begin={`${animDelay}s`}
                  values={`
                    M0,${waveY} C${size * 0.15},${waveY - waveAmp * 1.2} ${size * 0.3},${waveY + waveAmp} ${size * 0.5},${waveY} C${size * 0.7},${waveY - waveAmp} ${size * 0.85},${waveY + waveAmp * 1.2} ${size},${waveY} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.5} C${size * 0.2},${waveY + waveAmp * 1.3} ${size * 0.4},${waveY - waveAmp * 1.1} ${size * 0.5},${waveY - waveAmp * 0.3} C${size * 0.6},${waveY + waveAmp * 0.8} ${size * 0.8},${waveY - waveAmp * 1.2} ${size},${waveY - waveAmp * 0.4} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.3} C${size * 0.25},${waveY - waveAmp * 1.4} ${size * 0.35},${waveY + waveAmp * 1.2} ${size * 0.5},${waveY + waveAmp * 0.4} C${size * 0.65},${waveY - waveAmp * 0.6} ${size * 0.75},${waveY + waveAmp * 1.3} ${size},${waveY + waveAmp * 0.5} L${size},${size} L0,${size} Z;
                    M0,${waveY} C${size * 0.15},${waveY - waveAmp * 1.2} ${size * 0.3},${waveY + waveAmp} ${size * 0.5},${waveY} C${size * 0.7},${waveY - waveAmp} ${size * 0.85},${waveY + waveAmp * 1.2} ${size},${waveY} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
            <clipPath id={`wave2-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="3.4s"
                  repeatCount="indefinite"
                  begin={`${animDelay - 1}s`}
                  values={`
                    M0,${waveY + waveAmp * 0.4} C${size * 0.2},${waveY + waveAmp} ${size * 0.35},${waveY - waveAmp * 0.8} ${size * 0.5},${waveY + waveAmp * 0.3} C${size * 0.65},${waveY + waveAmp * 0.9} ${size * 0.8},${waveY - waveAmp * 0.7} ${size},${waveY + waveAmp * 0.4} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.5} C${size * 0.2},${waveY - waveAmp * 0.9} ${size * 0.35},${waveY + waveAmp} ${size * 0.5},${waveY - waveAmp * 0.4} C${size * 0.65},${waveY - waveAmp * 0.7} ${size * 0.8},${waveY + waveAmp * 0.9} ${size},${waveY - waveAmp * 0.5} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.4} C${size * 0.2},${waveY + waveAmp} ${size * 0.35},${waveY - waveAmp * 0.8} ${size * 0.5},${waveY + waveAmp * 0.3} C${size * 0.65},${waveY + waveAmp * 0.9} ${size * 0.8},${waveY - waveAmp * 0.7} ${size},${waveY + waveAmp * 0.4} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
            <clipPath id={`wave3-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="4.6s"
                  repeatCount="indefinite"
                  begin={`${animDelay - 2.3}s`}
                  values={`
                    M0,${waveY - waveAmp * 0.2} C${size * 0.3},${waveY + waveAmp * 0.6} ${size * 0.5},${waveY - waveAmp * 0.5} ${size * 0.7},${waveY + waveAmp * 0.3} C${size * 0.85},${waveY - waveAmp * 0.4} ${size * 0.95},${waveY + waveAmp * 0.5} ${size},${waveY} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.3} C${size * 0.2},${waveY - waveAmp * 0.7} ${size * 0.45},${waveY + waveAmp * 0.6} ${size * 0.6},${waveY - waveAmp * 0.4} C${size * 0.75},${waveY + waveAmp * 0.5} ${size * 0.9},${waveY - waveAmp * 0.3} ${size},${waveY + waveAmp * 0.2} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.2} C${size * 0.3},${waveY + waveAmp * 0.6} ${size * 0.5},${waveY - waveAmp * 0.5} ${size * 0.7},${waveY + waveAmp * 0.3} C${size * 0.85},${waveY - waveAmp * 0.4} ${size * 0.95},${waveY + waveAmp * 0.5} ${size},${waveY} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
          </defs>
        </svg>
        {/* Primary liquid layer -- smooth blended colours */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave-${studioId}-${size})`, zIndex: 2,
          transition: "opacity 0.6s ease-out",
        }}>
          {/* Base colour layer -- moderate blur for smooth blending */}
          <div style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.08}px)`, opacity: 0.85,
          }} />
          {/* Soft glow layer -- more diffuse for organic feel */}
          <div style={{
            position: "absolute", inset: "5%", borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.14}px)`, opacity: 0.4,
          }} />
          {/* Slow rotating overlay -- creates swirl movement */}
          <div style={{
            position: "absolute", inset: "-15%", borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.2}px)`, opacity: 0.25,
            animation: "iridRotate 18s linear infinite", mixBlendMode: "overlay" as const,
          }} />
        </div>
        {/* Secondary wave layer -- offset timing for depth */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave2-${studioId}-${size})`, zIndex: 3, opacity: 0.3,
        }}>
          <div style={{
            position: "absolute", inset: -6, borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.1}px)`, opacity: 0.8,
          }} />
        </div>
        {/* Third wave layer -- slowest, for shimmer */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave3-${studioId}-${size})`, zIndex: 4, opacity: 0.15,
        }}>
          <div style={{
            position: "absolute", inset: -3, borderRadius: "50%",
            background: `radial-gradient(circle at 30% 60%, rgba(255,255,255,0.35), transparent 60%), ${conicGrad}`,
            filter: `blur(${size * 0.08}px)`, opacity: 0.75,
          }} />
        </div>
        {/* Colour pool at bottom -- dominant colour settles here */}
        {domHex && w > 0.1 && <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(ellipse 90% 55% at 50% 90%, ${domHex}${Math.round(0.55 * 255).toString(16).padStart(2, '0')} 0%, ${domHex}${Math.round(0.3 * 255).toString(16).padStart(2, '0')} 30%, ${domHex}${Math.round(0.1 * 255).toString(16).padStart(2, '0')} 55%, transparent 75%)`,
          filter: `blur(${size * 0.05}px)`,
          zIndex: 5,
        }} />}
        {/* Glass specular -- subtle so colour proportions remain readable */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(ellipse 50% 40% at 32% 28%, rgba(255,255,255,${specAlpha * 0.3}) 0%, rgba(255,255,255,${specAlpha * 0.1}) 25%, transparent 50%)`,
          zIndex: 8,
        }} />
        {/* Center glow in filled area */}
        {hasData && w > 0.2 && <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 50% ${100 - fillPct * 0.5}%, rgba(255,255,255,${w * 0.18}) 0%, transparent 45%)`,
          zIndex: 9,
        }} />}
        {/* Edge shadow ring */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}), inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.7})`, zIndex: 11,
        }} />
        {/* Inner rim */}
        <div style={{
          position: "absolute", inset: `${Math.max(1, size * 0.01)}px`, borderRadius: "50%",
          border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,${0.05 + w * 0.1})`,
          zIndex: 12, pointerEvents: "none",
        }} />
      </div>
    </div>
  );
};

export default RainbowOrb;
