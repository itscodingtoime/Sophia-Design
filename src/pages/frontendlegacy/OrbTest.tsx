import React from 'react';

/* ─────────────────────────────────────────────────────────────────
   SOPHIA Rainbow Orb — Full spectrum, MAX luminosity
   This is the AI coach's signature orb. Always at peak brightness
   with the full rainbow visible through the crystal.
   ───────────────────────────────────────────────────────────────── */
const SophiaRainbowOrb = ({ size = 120 }: { size?: number }) => {
  // Everything cranked to max
  const iriAlpha = 0.7;
  const iriSat = 85;
  const coreBright = 0.92;
  const specAlpha = 0.85;
  const rimAlpha = 0.65;
  const rimSat = 90;
  const glowAlpha = 0.4;
  const edgeAlpha = 0.18;

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
    }}>

      {/* ── Rainbow ground shadow ── */}
      <div style={{
        position: 'absolute',
        bottom: `-${size * 0.12}px`,
        left: '5%',
        width: '90%',
        height: '45%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse,
          hsla(280, 70%, 70%, ${glowAlpha * 0.6}) 0%,
          hsla(200, 60%, 65%, ${glowAlpha * 0.4}) 25%,
          hsla(340, 55%, 65%, ${glowAlpha * 0.3}) 50%,
          transparent 75%)`,
        filter: `blur(${size * 0.14}px)`,
        zIndex: 0,
      }} />

      {/* ── Bright rainbow aura ── */}
      <div style={{
        position: 'absolute',
        inset: `-${size * 0.22}px`,
        borderRadius: '50%',
        background: `radial-gradient(circle,
          rgba(255, 255, 255, ${glowAlpha * 0.4}) 0%,
          hsla(280, 50%, 80%, ${glowAlpha * 0.35}) 20%,
          hsla(200, 50%, 75%, ${glowAlpha * 0.25}) 35%,
          hsla(50, 50%, 75%, ${glowAlpha * 0.15}) 50%,
          transparent 65%)`,
        filter: `blur(${size * 0.22}px)`,
        zIndex: 0,
      }} />

      {/* ── Main Crystal Sphere ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        zIndex: 1,
        background: `radial-gradient(circle at 40% 35%,
          rgba(255, 255, 255, ${coreBright}) 0%,
          rgba(248, 250, 255, ${coreBright * 0.82}) 20%,
          rgba(240, 245, 255, ${coreBright * 0.6}) 45%,
          rgba(225, 235, 250, ${coreBright * 0.45}) 70%,
          rgba(210, 220, 245, ${coreBright * 0.35}) 100%)`,
        boxShadow: `
          inset 0 0 ${size * 0.04}px rgba(255,255,255,0.7),
          0 ${size * 0.02}px ${size * 0.07}px rgba(0,0,0,0.12)`,
      }}>

        {/* ── Full-spectrum rainbow wash: Violet/Blue — upper left ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 75% 65% at 28% 25%,
            hsla(260, ${iriSat}%, 68%, ${iriAlpha * 0.65}) 0%,
            hsla(230, ${iriSat}%, 72%, ${iriAlpha * 0.4}) 30%,
            transparent 60%)`,
          zIndex: 2,
        }} />

        {/* ── Cyan/Teal — left center ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 55% 70% at 18% 55%,
            hsla(185, ${iriSat + 5}%, 65%, ${iriAlpha * 0.7}) 0%,
            hsla(170, ${iriSat}%, 70%, ${iriAlpha * 0.35}) 35%,
            transparent 65%)`,
          zIndex: 3,
        }} />

        {/* ── Green/Emerald — bottom left ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 50% 50% at 30% 75%,
            hsla(140, ${iriSat * 0.9}%, 60%, ${iriAlpha * 0.55}) 0%,
            hsla(120, ${iriSat * 0.7}%, 65%, ${iriAlpha * 0.25}) 40%,
            transparent 65%)`,
          zIndex: 4,
        }} />

        {/* ── Warm Yellow/Gold — bottom center ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 60% 45% at 50% 80%,
            hsla(48, ${iriSat}%, 65%, ${iriAlpha * 0.5}) 0%,
            hsla(40, ${iriSat * 0.8}%, 70%, ${iriAlpha * 0.25}) 40%,
            transparent 65%)`,
          zIndex: 5,
        }} />

        {/* ── Orange/Coral — right side ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 50% 65% at 78% 60%,
            hsla(20, ${iriSat}%, 62%, ${iriAlpha * 0.6}) 0%,
            hsla(10, ${iriSat * 0.8}%, 66%, ${iriAlpha * 0.3}) 35%,
            transparent 60%)`,
          zIndex: 6,
        }} />

        {/* ── Rose/Magenta — upper right ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 65% 55% at 72% 28%,
            hsla(330, ${iriSat * 0.9}%, 68%, ${iriAlpha * 0.55}) 0%,
            hsla(310, ${iriSat * 0.7}%, 72%, ${iriAlpha * 0.3}) 35%,
            transparent 60%)`,
          zIndex: 7,
        }} />

        {/* ── Full spectrum rainbow rim — thick and vivid ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from -30deg,
            hsla(0, ${rimSat}%, 60%, ${rimAlpha}) 0%,
            hsla(30, ${rimSat}%, 62%, ${rimAlpha * 0.9}) 8%,
            hsla(55, ${rimSat}%, 60%, ${rimAlpha * 0.85}) 14%,
            hsla(100, ${rimSat * 0.9}%, 55%, ${rimAlpha * 0.8}) 22%,
            hsla(160, ${rimSat}%, 55%, ${rimAlpha * 0.85}) 30%,
            hsla(195, ${rimSat}%, 58%, ${rimAlpha * 0.9}) 38%,
            hsla(220, ${rimSat}%, 60%, ${rimAlpha}) 46%,
            hsla(260, ${rimSat}%, 62%, ${rimAlpha * 0.95}) 54%,
            hsla(290, ${rimSat * 0.9}%, 65%, ${rimAlpha * 0.9}) 62%,
            hsla(325, ${rimSat}%, 62%, ${rimAlpha * 0.85}) 70%,
            hsla(350, ${rimSat}%, 60%, ${rimAlpha * 0.9}) 80%,
            hsla(10, ${rimSat}%, 58%, ${rimAlpha * 0.95}) 90%,
            hsla(0, ${rimSat}%, 60%, ${rimAlpha}) 100%)`,
          WebkitMaskImage: `radial-gradient(circle, transparent 48%, black 68%, black 100%)`,
          maskImage: `radial-gradient(circle, transparent 48%, black 68%, black 100%)`,
          animation: 'iridShift 18s linear infinite',
          zIndex: 8,
        }} />

        {/* ── Animated rainbow shimmer — fills the interior ── */}
        <div style={{
          position: 'absolute',
          inset: '-35%',
          borderRadius: '50%',
          background: `conic-gradient(from 0deg at 50% 50%,
            hsla(0, 70%, 75%, 0.2) 0%,
            hsla(45, 70%, 72%, 0.22) 12%,
            hsla(90, 60%, 70%, 0.18) 24%,
            hsla(160, 65%, 72%, 0.2) 36%,
            hsla(210, 70%, 74%, 0.22) 48%,
            hsla(260, 65%, 76%, 0.2) 60%,
            hsla(310, 60%, 74%, 0.18) 72%,
            hsla(340, 65%, 72%, 0.2) 84%,
            hsla(0, 70%, 75%, 0.2) 100%)`,
          animation: 'iridRotate 20s linear infinite',
          zIndex: 9,
          mixBlendMode: 'overlay',
          opacity: 0.9,
        }} />

        {/* ── Bright white core glow — SOPHIA is maximally lit ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 45% 45%,
            rgba(255, 255, 255, 0.6) 0%,
            rgba(255, 255, 255, 0.2) 30%,
            transparent 60%)`,
          zIndex: 10,
        }} />

        {/* ── Primary Specular Highlight ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 55% 45% at 32% 28%,
            rgba(255, 255, 255, ${specAlpha}) 0%,
            rgba(255, 255, 255, ${specAlpha * 0.75}) 18%,
            rgba(255, 255, 255, ${specAlpha * 0.2}) 50%,
            transparent 70%)`,
          zIndex: 11,
        }} />

        {/* ── Secondary specular ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 28% 22% at 72% 72%,
            rgba(255, 255, 255, ${specAlpha * 0.4}) 0%,
            rgba(230, 240, 255, ${specAlpha * 0.2}) 40%,
            transparent 70%)`,
          zIndex: 12,
        }} />

        {/* ── Fresnel edge ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}),
                       inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.7})`,
          zIndex: 13,
        }} />

        {/* ── Inner edge highlight ── */}
        <div style={{
          position: 'absolute',
          inset: `${Math.max(1, size * 0.01)}px`,
          borderRadius: '50%',
          border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,0.3)`,
          zIndex: 14,
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Breathing animation ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        animation: 'crystalPulse 5s ease-in-out infinite alternate',
        pointerEvents: 'none',
        zIndex: 15,
      }} />
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────────
   Studio Orb — Color-dominant crystal based on coaching dimensions

   The dominant color comes from feature weights:
   - Ownership      → Blue   (hue ~220)
   - Trust          → Green  (hue ~140)
   - Communication  → Orange (hue ~28)
   - Emotional Int. → Gold   (hue ~48)
   - Accountability → Red    (hue ~355)

   Pass `dominantHue` for the primary color, `secondaryHue` for blend.
   `colorBlend` (0-1) controls how much secondary shows through.
   `warmth` (0-1) controls overall brightness.
   ───────────────────────────────────────────────────────────────── */
const StudioOrb = ({
  warmth = 0.5,
  size = 120,
  dominantHue = 220,
  secondaryHue = 280,
  colorBlend = 0.3,
}: {
  warmth?: number;
  size?: number;
  dominantHue?: number;
  secondaryHue?: number;
  colorBlend?: number;
}) => {
  const w = Math.max(0, Math.min(1, warmth));
  const blend = Math.max(0, Math.min(1, colorBlend));

  // Derived from warmth
  const colorAlpha = 0.15 + w * 0.65;
  const colorSat = 35 + w * 55;
  const coreBright = 0.25 + w * 0.6;
  const specAlpha = 0.2 + w * 0.6;
  const glowAlpha = 0.04 + w * 0.36;
  const edgeAlpha = 0.06 + w * 0.16;
  const vibrancy = 0.25 + w * 0.75;

  // Blend between dominant and secondary
  const secAlpha = colorAlpha * blend * 0.7;
  const secSat = colorSat * (0.6 + blend * 0.4);

  // Tertiary: midpoint between the two hues for depth
  const tertiaryHue = (dominantHue + secondaryHue) / 2;

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
    }}>

      {/* ── Colored ground shadow ── */}
      <div style={{
        position: 'absolute',
        bottom: `-${size * 0.1}px`,
        left: '10%',
        width: '80%',
        height: '40%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse,
          hsla(${dominantHue}, ${colorSat}%, 55%, ${glowAlpha * 0.7}) 0%,
          hsla(${dominantHue}, ${colorSat * 0.6}%, 50%, ${glowAlpha * 0.3}) 50%,
          transparent 75%)`,
        filter: `blur(${size * 0.12}px)`,
        zIndex: 0,
      }} />

      {/* ── Color-tinted glow aura ── */}
      <div style={{
        position: 'absolute',
        inset: `-${size * 0.18}px`,
        borderRadius: '50%',
        background: `radial-gradient(circle,
          hsla(${dominantHue}, ${colorSat * 0.5}%, 75%, ${glowAlpha * 0.45}) 0%,
          hsla(${dominantHue}, ${colorSat * 0.3}%, 70%, ${glowAlpha * 0.2}) 40%,
          transparent 65%)`,
        filter: `blur(${size * 0.2}px)`,
        zIndex: 0,
      }} />

      {/* ── Main Crystal Sphere ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        zIndex: 1,
        // Tinted glass base — color-shifted white
        background: `radial-gradient(circle at 40% 35%,
          rgba(255, 255, 255, ${coreBright * 0.8}) 0%,
          hsla(${dominantHue}, ${colorSat * 0.15}%, 92%, ${coreBright * 0.65}) 20%,
          hsla(${dominantHue}, ${colorSat * 0.2}%, 85%, ${coreBright * 0.45}) 50%,
          hsla(${dominantHue}, ${colorSat * 0.25}%, 75%, ${coreBright * 0.35}) 75%,
          hsla(${dominantHue}, ${colorSat * 0.3}%, 65%, ${coreBright * 0.3}) 100%)`,
        boxShadow: `
          inset 0 0 ${size * 0.03}px rgba(255,255,255,0.4),
          0 ${size * 0.02}px ${size * 0.06}px rgba(0,0,0,0.15)`,
      }}>

        {/* ── Dominant Color: Large central wash ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 85% 85% at 45% 45%,
            hsla(${dominantHue}, ${colorSat}%, 62%, ${colorAlpha * 0.7}) 0%,
            hsla(${dominantHue}, ${colorSat * 0.9}%, 68%, ${colorAlpha * 0.5}) 25%,
            hsla(${dominantHue}, ${colorSat * 0.7}%, 72%, ${colorAlpha * 0.25}) 50%,
            transparent 75%)`,
          zIndex: 2,
        }} />

        {/* ── Dominant Color: Concentrated inner glow ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 50% 55% at 40% 50%,
            hsla(${dominantHue}, ${colorSat + 10}%, 55%, ${colorAlpha * 0.6}) 0%,
            hsla(${dominantHue + 10}, ${colorSat}%, 60%, ${colorAlpha * 0.3}) 40%,
            transparent 70%)`,
          zIndex: 3,
        }} />

        {/* ── Secondary Color: Accent wash ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 55% 60% at 72% 35%,
            hsla(${secondaryHue}, ${secSat}%, 68%, ${secAlpha * 0.65}) 0%,
            hsla(${secondaryHue}, ${secSat * 0.8}%, 72%, ${secAlpha * 0.3}) 40%,
            transparent 65%)`,
          zIndex: 4,
        }} />

        {/* ── Tertiary: Depth band ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(145deg,
            transparent 20%,
            hsla(${tertiaryHue}, ${colorSat * 0.6}%, 70%, ${colorAlpha * 0.25}) 35%,
            hsla(${tertiaryHue + 15}, ${colorSat * 0.5}%, 74%, ${colorAlpha * 0.15}) 50%,
            transparent 65%)`,
          zIndex: 5,
        }} />

        {/* ── Color-tinted rim — subtle edge iridescence ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg,
            hsla(${dominantHue}, ${colorSat}%, 60%, ${colorAlpha * 0.4}) 0%,
            hsla(${dominantHue + 30}, ${colorSat * 0.8}%, 65%, ${colorAlpha * 0.3}) 15%,
            hsla(${secondaryHue}, ${secSat * 0.6}%, 68%, ${secAlpha * 0.35}) 30%,
            transparent 42%,
            transparent 55%,
            hsla(${dominantHue - 20}, ${colorSat * 0.7}%, 62%, ${colorAlpha * 0.35}) 65%,
            hsla(${dominantHue}, ${colorSat}%, 58%, ${colorAlpha * 0.45}) 80%,
            transparent 90%,
            hsla(${dominantHue}, ${colorSat}%, 60%, ${colorAlpha * 0.4}) 100%)`,
          WebkitMaskImage: `radial-gradient(circle, transparent 52%, black 72%, black 100%)`,
          maskImage: `radial-gradient(circle, transparent 52%, black 72%, black 100%)`,
          animation: 'iridShift 20s linear infinite',
          zIndex: 6,
        }} />

        {/* ── Slow color shimmer ── */}
        <div style={{
          position: 'absolute',
          inset: '-30%',
          borderRadius: '50%',
          background: `conic-gradient(from 0deg at 50% 50%,
            hsla(${dominantHue}, ${colorSat * 0.4}%, 78%, ${colorAlpha * 0.18}) 0%,
            hsla(${dominantHue + 20}, ${colorSat * 0.3}%, 80%, ${colorAlpha * 0.15}) 25%,
            hsla(${secondaryHue}, ${secSat * 0.3}%, 78%, ${secAlpha * 0.12}) 50%,
            hsla(${dominantHue - 20}, ${colorSat * 0.3}%, 80%, ${colorAlpha * 0.15}) 75%,
            hsla(${dominantHue}, ${colorSat * 0.4}%, 78%, ${colorAlpha * 0.18}) 100%)`,
          animation: 'iridRotate 25s linear infinite',
          zIndex: 7,
          mixBlendMode: 'overlay',
          opacity: vibrancy,
        }} />

        {/* ── White core glow (warmth-driven) ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 42% 42%,
            rgba(255, 255, 255, ${w * 0.35}) 0%,
            rgba(255, 255, 255, ${w * 0.1}) 35%,
            transparent 60%)`,
          zIndex: 8,
        }} />

        {/* ── Primary Specular Highlight ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 55% 45% at 32% 28%,
            rgba(255, 255, 255, ${specAlpha * 0.9}) 0%,
            rgba(255, 255, 255, ${specAlpha * 0.6}) 20%,
            rgba(255, 255, 255, ${specAlpha * 0.15}) 50%,
            transparent 70%)`,
          zIndex: 9,
        }} />

        {/* ── Secondary specular ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse 28% 22% at 70% 70%,
            rgba(255, 255, 255, ${specAlpha * 0.3}) 0%,
            hsla(${dominantHue}, 20%, 90%, ${specAlpha * 0.12}) 40%,
            transparent 70%)`,
          zIndex: 10,
        }} />

        {/* ── Fresnel edge ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}),
                       inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.8})`,
          zIndex: 11,
        }} />

        {/* ── Inner edge highlight ── */}
        <div style={{
          position: 'absolute',
          inset: `${Math.max(1, size * 0.01)}px`,
          borderRadius: '50%',
          border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,${0.08 + w * 0.2})`,
          zIndex: 12,
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Breathing animation ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        animation: 'crystalPulse 6s ease-in-out infinite alternate',
        pointerEvents: 'none',
        zIndex: 13,
      }} />
    </div>
  );
};


/* ─── Coaching Dimension Color Map ─── */
const DIMENSION_COLORS: Record<string, number> = {
  ownership: 220,       // Blue
  trust: 140,           // Green
  communication: 28,    // Orange
  emotional: 48,        // Gold/Yellow
  accountability: 355,  // Red/Coral
};


/* ─── Test Page ─── */
const OrbTest = () => {
  // Studio data with coaching dimension weights
  const studios: Array<{ name: string; warmth: number; weights: Record<string, number> }> = [
    {
      name: 'Sales Team',
      warmth: 0.68,
      // Ownership: heavy, Trust: moderate → dominant blue with green accent
      weights: { ownership: 0.6, trust: 0.25, communication: 0.1, emotional: 0.05 },
    },
    {
      name: 'Product Buildout',
      warmth: 0.41,
      // Communication: heavy, Accountability: moderate → dominant orange with red accent
      weights: { communication: 0.5, accountability: 0.3, ownership: 0.1, trust: 0.1 },
    },
    {
      name: 'Creative',
      warmth: 0.78,
      // Trust: heavy, Emotional: moderate → dominant green with gold accent
      weights: { trust: 0.5, emotional: 0.3, communication: 0.15, ownership: 0.05 },
    },
  ];

  // Derive dominant/secondary hue from weights
  const getOrbColors = (weights: Record<string, number>) => {
    const sorted = Object.entries(weights)
      .sort(([, a], [, b]) => b - a);
    const [dominantEntry = ['ownership', 1], secondaryEntry = dominantEntry] = sorted;
    const [dominantKey, dominantWeight] = dominantEntry;
    const [secondaryKey, secondaryWeight] = secondaryEntry;
    const dominantHue = DIMENSION_COLORS[dominantKey] ?? 220;
    const secondaryHue = DIMENSION_COLORS[secondaryKey] ?? 280;
    const colorBlend = secondaryWeight / dominantWeight; // ratio of 2nd to 1st
    return { dominantHue, secondaryHue, colorBlend, dominantKey, secondaryKey };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0C0D0A, #080807)',
      color: '#FFFFFF',
      fontFamily: "'Tomorrow', sans-serif",
      padding: '60px 40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600&family=Tomorrow:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&display=swap');

        @keyframes iridShift {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes iridRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes crystalPulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.025); }
        }
      `}</style>

      {/* ═══ Section 1: SOPHIA's Rainbow Orb ═══ */}
      <h1 style={{
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 32,
        fontWeight: 300,
        letterSpacing: '0.05em',
        marginBottom: 8,
        color: '#C0E689',
      }}>
        SOPHIA — Rainbow Crystal Orb
      </h1>
      <p style={{ color: '#8A8880', fontSize: 14, marginBottom: 40 }}>
        Full spectrum, maximum luminosity. The AI coach's signature orb — always at peak brightness.
      </p>

      <div style={{
        display: 'flex',
        gap: 60,
        alignItems: 'flex-end',
        marginBottom: 40,
        flexWrap: 'wrap',
      }}>
        <div style={{ textAlign: 'center' }}>
          <SophiaRainbowOrb size={200} />
          <div style={{ marginTop: 24, fontSize: 15, fontWeight: 500, color: '#D4D2CE' }}>
            Detail View
          </div>
          <div style={{ fontSize: 12, color: '#8A8880', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            200px
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <SophiaRainbowOrb size={120} />
          <div style={{ marginTop: 20, fontSize: 14, color: '#D4D2CE' }}>
            Standard
          </div>
          <div style={{ fontSize: 12, color: '#8A8880', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            120px
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <SophiaRainbowOrb size={72} />
          <div style={{ marginTop: 18, fontSize: 14, color: '#D4D2CE' }}>
            Card
          </div>
          <div style={{ fontSize: 12, color: '#8A8880', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            72px
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <SophiaRainbowOrb size={34} />
          <div style={{ marginTop: 16, fontSize: 14, color: '#D4D2CE' }}>
            Avatar
          </div>
          <div style={{ fontSize: 12, color: '#8A8880', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
            34px
          </div>
        </div>
      </div>

      <div style={{
        height: 1,
        background: 'rgba(255,255,255,0.06)',
        margin: '60px 0',
      }} />

      {/* ═══ Section 2: Studio Orbs — Color-Dominant ═══ */}
      <h1 style={{
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 32,
        fontWeight: 300,
        letterSpacing: '0.05em',
        marginBottom: 8,
        color: '#C0E689',
      }}>
        Studio Orbs — Color-Dominant
      </h1>
      <p style={{ color: '#8A8880', fontSize: 14, marginBottom: 12 }}>
        Each studio's dominant color comes from coaching dimension weights. Brightness from warmth score.
      </p>
      <div style={{
        display: 'flex',
        gap: 24,
        marginBottom: 40,
        flexWrap: 'wrap',
      }}>
        {Object.entries(DIMENSION_COLORS).map(([name, hue]) => (
          <div key={name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `hsl(${hue}, 70%, 55%)`,
            }} />
            <span style={{
              fontSize: 12,
              color: '#D4D2CE',
              textTransform: 'capitalize',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        gap: 80,
        alignItems: 'flex-start',
        marginBottom: 80,
        flexWrap: 'wrap',
      }}>
        {studios.map((s) => {
          const { dominantHue, secondaryHue, colorBlend, dominantKey, secondaryKey } = getOrbColors(s.weights);
          return (
            <div key={s.name} style={{ textAlign: 'center', maxWidth: 200 }}>
              <StudioOrb
                warmth={s.warmth}
                size={130}
                dominantHue={dominantHue}
                secondaryHue={secondaryHue}
                colorBlend={colorBlend}
              />
              <div style={{
                marginTop: 20,
                fontSize: 15,
                fontWeight: 500,
                color: '#D4D2CE',
              }}>
                {s.name}
              </div>
              <div style={{
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#8A8880',
                marginTop: 6,
              }}>
                warmth: {s.warmth}
              </div>
              <div style={{
                fontSize: 11,
                color: '#5A5850',
                marginTop: 4,
              }}>
                {dominantKey} ({Math.round(s.weights[dominantKey as keyof typeof s.weights] * 100)}%)
                {' + '}
                {secondaryKey} ({Math.round(s.weights[secondaryKey as keyof typeof s.weights] * 100)}%)
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        height: 1,
        background: 'rgba(255,255,255,0.06)',
        margin: '60px 0',
      }} />

      {/* ═══ Section 3: Warmth Spectrum — Same Color, Different Brightness ═══ */}
      <h2 style={{
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 22,
        fontWeight: 400,
        color: '#D4D2CE',
        marginBottom: 10,
        letterSpacing: '0.04em',
      }}>
        Warmth Spectrum — Blue (Ownership)
      </h2>
      <p style={{ color: '#8A8880', fontSize: 13, marginBottom: 30 }}>
        Same dominant color, varying warmth. Low = dim crystal, High = vivid glowing orb.
      </p>
      <div style={{
        display: 'flex',
        gap: 45,
        alignItems: 'flex-end',
        marginBottom: 80,
        flexWrap: 'wrap',
      }}>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((w) => (
          <div key={w} style={{ textAlign: 'center' }}>
            <StudioOrb
              warmth={w}
              size={110}
              dominantHue={220}
              secondaryHue={260}
              colorBlend={0.3}
            />
            <div style={{
              marginTop: 18,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#8A8880',
            }}>
              {w.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: '#5A5850', marginTop: 3 }}>
              {w <= 0.2 ? 'Very Low' : w <= 0.4 ? 'Low' : w <= 0.6 ? 'Moderate' : w <= 0.8 ? 'Strong' : 'Very Strong'}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Section 4: All Dimension Colors at High Warmth ═══ */}
      <h2 style={{
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 22,
        fontWeight: 400,
        color: '#D4D2CE',
        marginBottom: 10,
        letterSpacing: '0.04em',
      }}>
        All Dimension Colors — 0.8 Warmth
      </h2>
      <p style={{ color: '#8A8880', fontSize: 13, marginBottom: 30 }}>
        Each coaching dimension as the dominant color at high warmth.
      </p>
      <div style={{
        display: 'flex',
        gap: 50,
        alignItems: 'flex-end',
        marginBottom: 80,
        flexWrap: 'wrap',
      }}>
        {Object.entries(DIMENSION_COLORS).map(([name, hue]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <StudioOrb
              warmth={0.8}
              size={110}
              dominantHue={hue}
              secondaryHue={(hue + 60) % 360}
              colorBlend={0.25}
            />
            <div style={{
              marginTop: 18,
              fontSize: 13,
              fontWeight: 500,
              color: '#D4D2CE',
              textTransform: 'capitalize',
            }}>
              {name}
            </div>
            <div style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#8A8880',
              marginTop: 4,
            }}>
              hue: {hue}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        height: 1,
        background: 'rgba(255,255,255,0.06)',
        margin: '60px 0',
      }} />

      {/* ═══ Section 5: Size Comparison — Side by Side ═══ */}
      <h2 style={{
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 22,
        fontWeight: 400,
        color: '#D4D2CE',
        marginBottom: 10,
        letterSpacing: '0.04em',
      }}>
        SOPHIA vs Studio — Side by Side
      </h2>
      <p style={{ color: '#8A8880', fontSize: 13, marginBottom: 30 }}>
        SOPHIA's rainbow at different sizes next to a studio orb at equivalent size.
      </p>
      <div style={{
        display: 'flex',
        gap: 60,
        alignItems: 'center',
        marginBottom: 80,
        flexWrap: 'wrap',
      }}>
        <div style={{ textAlign: 'center' }}>
          <SophiaRainbowOrb size={160} />
          <div style={{ marginTop: 22, fontSize: 14, color: '#D4D2CE' }}>SOPHIA</div>
          <div style={{ fontSize: 11, color: '#8A8880', marginTop: 2 }}>Rainbow · Max</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <StudioOrb warmth={0.68} size={160} dominantHue={220} secondaryHue={140} colorBlend={0.35} />
          <div style={{ marginTop: 22, fontSize: 14, color: '#D4D2CE' }}>Sales Team</div>
          <div style={{ fontSize: 11, color: '#8A8880', marginTop: 2 }}>Blue · 0.68</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <StudioOrb warmth={0.41} size={160} dominantHue={28} secondaryHue={355} colorBlend={0.5} />
          <div style={{ marginTop: 22, fontSize: 14, color: '#D4D2CE' }}>Product</div>
          <div style={{ fontSize: 11, color: '#8A8880', marginTop: 2 }}>Orange · 0.41</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <StudioOrb warmth={0.78} size={160} dominantHue={140} secondaryHue={48} colorBlend={0.5} />
          <div style={{ marginTop: 22, fontSize: 14, color: '#D4D2CE' }}>Creative</div>
          <div style={{ fontSize: 11, color: '#8A8880', marginTop: 2 }}>Green · 0.78</div>
        </div>
      </div>
    </div>
  );
};

export default OrbTest;
