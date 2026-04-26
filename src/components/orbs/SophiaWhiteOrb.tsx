/* ─── SOPHIA Rainbow Orb — Full spectrum, MAX luminosity ─── */

export const SophiaWhiteOrb = ({ size = 34, animate = true }: { size?: number; animate?: boolean }) => {
  const iriAlpha = 0.7;
  const iriSat = 85;
  const coreBright = 0.92;
  const specAlpha = 0.85;
  const rimAlpha = 0.65;
  const rimSat = 90;
  const glowAlpha = 0.4;
  const edgeAlpha = 0.18;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: "absolute", bottom: `-${size * 0.12}px`, left: "5%", width: "90%", height: "45%", borderRadius: "50%",
        background: `radial-gradient(ellipse, hsla(280,70%,70%,${glowAlpha * 0.6}) 0%, hsla(200,60%,65%,${glowAlpha * 0.4}) 25%, hsla(340,55%,65%,${glowAlpha * 0.3}) 50%, transparent 75%)`,
        filter: `blur(${size * 0.14}px)`, zIndex: 0,
      }} />
      <div style={{
        position: "absolute", inset: `-${size * 0.22}px`, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255,255,255,${glowAlpha * 0.4}) 0%, hsla(280,50%,80%,${glowAlpha * 0.35}) 20%, hsla(200,50%,75%,${glowAlpha * 0.25}) 35%, hsla(50,50%,75%,${glowAlpha * 0.15}) 50%, transparent 65%)`,
        filter: `blur(${size * 0.22}px)`, zIndex: 0,
      }} />
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,${coreBright}) 0%, rgba(248,250,255,${coreBright * 0.82}) 20%, rgba(240,245,255,${coreBright * 0.6}) 45%, rgba(225,235,250,${coreBright * 0.45}) 70%, rgba(210,220,245,${coreBright * 0.35}) 100%)`,
        boxShadow: `inset 0 0 ${size * 0.04}px rgba(255,255,255,0.7), 0 ${size * 0.02}px ${size * 0.07}px rgba(0,0,0,0.12)`,
      }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 75% 65% at 28% 25%, hsla(260,${iriSat}%,68%,${iriAlpha * 0.65}) 0%, hsla(230,${iriSat}%,72%,${iriAlpha * 0.4}) 30%, transparent 60%)`, animation: animate ? "iridShift 8s linear infinite" : undefined, zIndex: 2 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 55% 70% at 18% 55%, hsla(185,${iriSat + 5}%,65%,${iriAlpha * 0.7}) 0%, hsla(170,${iriSat}%,70%,${iriAlpha * 0.35}) 35%, transparent 65%)`, animation: animate ? "iridRotate 10s linear infinite" : undefined, zIndex: 3 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 50% 50% at 30% 75%, hsla(140,${iriSat * 0.9}%,60%,${iriAlpha * 0.55}) 0%, hsla(120,${iriSat * 0.7}%,65%,${iriAlpha * 0.25}) 40%, transparent 65%)`, animation: animate ? "iridShift 12s linear infinite" : undefined, zIndex: 4 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 60% 45% at 50% 80%, hsla(48,${iriSat}%,65%,${iriAlpha * 0.5}) 0%, hsla(40,${iriSat * 0.8}%,70%,${iriAlpha * 0.25}) 40%, transparent 65%)`, animation: animate ? "iridRotate 9s linear infinite" : undefined, zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 50% 65% at 78% 60%, hsla(20,${iriSat}%,62%,${iriAlpha * 0.6}) 0%, hsla(10,${iriSat * 0.8}%,66%,${iriAlpha * 0.3}) 35%, transparent 60%)`, animation: animate ? "iridShift 11s linear infinite" : undefined, zIndex: 6 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 65% 55% at 72% 28%, hsla(330,${iriSat * 0.9}%,68%,${iriAlpha * 0.55}) 0%, hsla(310,${iriSat * 0.7}%,72%,${iriAlpha * 0.3}) 35%, transparent 60%)`, animation: animate ? "iridRotate 7s linear infinite" : undefined, zIndex: 7 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(from -30deg, hsla(0,${rimSat}%,60%,${rimAlpha}) 0%, hsla(30,${rimSat}%,62%,${rimAlpha * 0.9}) 8%, hsla(55,${rimSat}%,60%,${rimAlpha * 0.85}) 14%, hsla(100,${rimSat * 0.9}%,55%,${rimAlpha * 0.8}) 22%, hsla(160,${rimSat}%,55%,${rimAlpha * 0.85}) 30%, hsla(195,${rimSat}%,58%,${rimAlpha * 0.9}) 38%, hsla(220,${rimSat}%,60%,${rimAlpha}) 46%, hsla(260,${rimSat}%,62%,${rimAlpha * 0.95}) 54%, hsla(290,${rimSat * 0.9}%,65%,${rimAlpha * 0.9}) 62%, hsla(325,${rimSat}%,62%,${rimAlpha * 0.85}) 70%, hsla(350,${rimSat}%,60%,${rimAlpha * 0.9}) 80%, hsla(10,${rimSat}%,58%,${rimAlpha * 0.95}) 90%, hsla(0,${rimSat}%,60%,${rimAlpha}) 100%)`,
          WebkitMaskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)", maskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
          animation: "iridShift 18s linear infinite", zIndex: 8,
        }} />
        <div style={{ position: "absolute", inset: "-35%", borderRadius: "50%",
          background: "conic-gradient(from 0deg at 50% 50%, hsla(0,70%,75%,0.2) 0%, hsla(45,70%,72%,0.22) 12%, hsla(90,60%,70%,0.18) 24%, hsla(160,65%,72%,0.2) 36%, hsla(210,70%,74%,0.22) 48%, hsla(260,65%,76%,0.2) 60%, hsla(310,60%,74%,0.18) 72%, hsla(340,65%,72%,0.2) 84%, hsla(0,70%,75%,0.2) 100%)",
          animation: "iridRotate 20s linear infinite", zIndex: 9, mixBlendMode: "overlay" as const, opacity: 0.9,
        }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)", zIndex: 10 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,${specAlpha}) 0%, rgba(255,255,255,${specAlpha * 0.75}) 18%, rgba(255,255,255,${specAlpha * 0.2}) 50%, transparent 70%)`, zIndex: 11 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(ellipse 28% 22% at 72% 72%, rgba(255,255,255,${specAlpha * 0.4}) 0%, rgba(230,240,255,${specAlpha * 0.2}) 40%, transparent 70%)`, zIndex: 12 }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}), inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.7})`, zIndex: 13,
        }} />
        <div style={{ position: "absolute", inset: `${Math.max(1, size * 0.01)}px`, borderRadius: "50%", border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,0.3)`, zIndex: 14, pointerEvents: "none" }} />
      </div>
      {animate && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: "crystalPulse 5s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 15 }} />}
      {/* White ring */}
      <div style={{
        position: "absolute", inset: -3, borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.35)",
        boxShadow: `0 0 ${size * 0.08}px rgba(255,255,255,0.08)`,
        pointerEvents: "none", zIndex: 16,
      }} />
    </div>
  );
};

export default SophiaWhiteOrb;
