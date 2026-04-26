/* ─── Studio Crystal Orb — Color-dominant based on orbColors ─── */

export const CrystalStudioOrb = ({ warmth = 0.5, size = 80, dominantHue = 220, secondaryHue = 280, colorBlend = 0.3, ringColor }: {
  warmth?: number; size?: number; dominantHue?: number; secondaryHue?: number; colorBlend?: number; ringColor?: string;
}) => {
  const w = Math.max(0, Math.min(1, warmth));
  const blend = Math.max(0, Math.min(1, colorBlend));
  const colorAlpha = 0.15 + w * 0.65;
  const colorSat = 35 + w * 55;
  const coreBright = 0.25 + w * 0.6;
  const specAlpha = 0.2 + w * 0.6;
  const glowAlpha = 0.04 + w * 0.36;
  const edgeAlpha = 0.06 + w * 0.16;
  const vibrancy = 0.25 + w * 0.75;
  const secAlpha = colorAlpha * blend * 0.7;
  const secSat = colorSat * (0.6 + blend * 0.4);
  const tertiaryHue = (dominantHue + secondaryHue) / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: "absolute", bottom: `-${size * 0.1}px`, left: "10%", width: "80%", height: "40%", borderRadius: "50%",
        background: `radial-gradient(ellipse, hsla(${dominantHue},${colorSat}%,55%,${glowAlpha * 0.7}) 0%, hsla(${dominantHue},${colorSat * 0.6}%,50%,${glowAlpha * 0.3}) 50%, transparent 75%)`,
        filter: `blur(${size * 0.12}px)`, zIndex: 0,
      }} />
      <div style={{
        position: "absolute", inset: `-${size * 0.18}px`, borderRadius: "50%",
        background: `radial-gradient(circle, hsla(${dominantHue},${colorSat * 0.5}%,75%,${glowAlpha * 0.45}) 0%, hsla(${dominantHue},${colorSat * 0.3}%,70%,${glowAlpha * 0.2}) 40%, transparent 65%)`,
        filter: `blur(${size * 0.2}px)`, zIndex: 0,
      }} />
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,${coreBright * 0.8}) 0%, hsla(${dominantHue},${colorSat * 0.15}%,92%,${coreBright * 0.65}) 20%, hsla(${dominantHue},${colorSat * 0.2}%,85%,${coreBright * 0.45}) 50%, hsla(${dominantHue},${colorSat * 0.25}%,75%,${coreBright * 0.35}) 75%, hsla(${dominantHue},${colorSat * 0.3}%,65%,${coreBright * 0.3}) 100%)`,
        boxShadow: `inset 0 0 ${size * 0.03}px rgba(255,255,255,0.4), 0 ${size * 0.02}px ${size * 0.06}px rgba(0,0,0,0.15)`,
      }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 85% 85% at 45% 45%, hsla(${dominantHue},${colorSat}%,62%,${colorAlpha * 0.7}) 0%, hsla(${dominantHue},${colorSat * 0.9}%,68%,${colorAlpha * 0.5}) 25%, hsla(${dominantHue},${colorSat * 0.7}%,72%,${colorAlpha * 0.25}) 50%, transparent 75%)`, zIndex: 2 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 50% 55% at 40% 50%, hsla(${dominantHue},${colorSat + 10}%,55%,${colorAlpha * 0.6}) 0%, hsla(${dominantHue + 10},${colorSat}%,60%,${colorAlpha * 0.3}) 40%, transparent 70%)`, zIndex: 3 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 55% 60% at 72% 35%, hsla(${secondaryHue},${secSat}%,68%,${secAlpha * 0.65}) 0%, hsla(${secondaryHue},${secSat * 0.8}%,72%,${secAlpha * 0.3}) 40%, transparent 65%)`, zIndex: 4 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `linear-gradient(145deg, transparent 20%, hsla(${tertiaryHue},${colorSat * 0.6}%,70%,${colorAlpha * 0.25}) 35%, hsla(${tertiaryHue + 15},${colorSat * 0.5}%,74%,${colorAlpha * 0.15}) 50%, transparent 65%)`, zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(from 0deg, hsla(${dominantHue},${colorSat}%,60%,${colorAlpha * 0.4}) 0%, hsla(${dominantHue + 30},${colorSat * 0.8}%,65%,${colorAlpha * 0.3}) 15%, hsla(${secondaryHue},${secSat * 0.6}%,68%,${secAlpha * 0.35}) 30%, transparent 42%, transparent 55%, hsla(${dominantHue - 20},${colorSat * 0.7}%,62%,${colorAlpha * 0.35}) 65%, hsla(${dominantHue},${colorSat}%,58%,${colorAlpha * 0.45}) 80%, transparent 90%, hsla(${dominantHue},${colorSat}%,60%,${colorAlpha * 0.4}) 100%)`,
          WebkitMaskImage: "radial-gradient(circle, transparent 52%, black 72%, black 100%)", maskImage: "radial-gradient(circle, transparent 52%, black 72%, black 100%)",
          animation: "iridShift 20s linear infinite", zIndex: 6,
        }} />
        <div style={{ position: "absolute", inset: "-30%", borderRadius: "50%",
          background: `conic-gradient(from 0deg at 50% 50%, hsla(${dominantHue},${colorSat * 0.4}%,78%,${colorAlpha * 0.18}) 0%, hsla(${dominantHue + 20},${colorSat * 0.3}%,80%,${colorAlpha * 0.15}) 25%, hsla(${secondaryHue},${secSat * 0.3}%,78%,${secAlpha * 0.12}) 50%, hsla(${dominantHue - 20},${colorSat * 0.3}%,80%,${colorAlpha * 0.15}) 75%, hsla(${dominantHue},${colorSat * 0.4}%,78%,${colorAlpha * 0.18}) 100%)`,
          animation: "iridRotate 25s linear infinite", zIndex: 7, mixBlendMode: "overlay" as const, opacity: vibrancy,
        }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 42% 42%, rgba(255,255,255,${w * 0.35}) 0%, rgba(255,255,255,${w * 0.1}) 35%, transparent 60%)`, zIndex: 8 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,${specAlpha * 0.9}) 0%, rgba(255,255,255,${specAlpha * 0.6}) 20%, rgba(255,255,255,${specAlpha * 0.15}) 50%, transparent 70%)`, zIndex: 9 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 28% 22% at 70% 70%, rgba(255,255,255,${specAlpha * 0.3}) 0%, hsla(${dominantHue},20%,90%,${specAlpha * 0.12}) 40%, transparent 70%)`, zIndex: 10 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}), inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.8})`, zIndex: 11,
        }} />
        <div style={{ position: "absolute", inset: `${Math.max(1, size * 0.01)}px`, borderRadius: "50%", border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,${0.08 + w * 0.2})`, zIndex: 12, pointerEvents: "none" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: "crystalPulse 6s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 13 }} />
      {/* Color ring */}
      {ringColor && <div style={{
        position: "absolute", inset: -3, borderRadius: "50%",
        border: `1.5px solid ${ringColor}`,
        boxShadow: `0 0 ${size * 0.08}px ${ringColor.replace(/[\d.]+\)$/, '0.12)')}`,
        pointerEvents: "none", zIndex: 14,
      }} />}
    </div>
  );
};

export default CrystalStudioOrb;
