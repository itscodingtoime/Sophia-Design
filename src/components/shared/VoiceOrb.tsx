import { C } from '../../theme';

export interface VoiceOrbProps {
  isListening: boolean;
  onClick?: () => void;
  size?: number;
}

/** Inline SVG microphone icon */
const MicIcon = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/**
 * Animated pulsing orb for voice input.
 * Shows a glass-like rainbow orb with ripple animations when listening.
 * Includes inline CSS keyframes for pulsing glow effect.
 */
const VoiceOrb = ({ isListening, onClick, size = 240 }: VoiceOrbProps) => {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        transition: 'all 0.5s ease',
        animation: 'orbFloat 5s ease-in-out infinite',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <style>{`
        @keyframes voiceRipple { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.8); opacity: 0; } }
        @keyframes voiceRipple2 { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(3.2); opacity: 0; } }
        @keyframes voiceRipple3 { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(3.6); opacity: 0; } }
        @keyframes orbFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes loginOrbSwirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes loginOrbSwirlReverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes loginOrbRadiate { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
      `}</style>

      {/* Ripple rings -- visible when listening */}
      {isListening && [0, 1, 2].map(i => (
        <div key={`ripple-${i}`} style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '50%',
          border: '1.5px solid rgba(180,200,220,0.35)',
          animation: `voiceRipple${i === 0 ? '' : i === 1 ? '2' : '3'} ${3 + i * 0.6}s ease-out infinite ${i * 1.1}s`,
          pointerEvents: 'none' as const,
        }} />
      ))}

      {/* Rainbow glow behind orb */}
      <div style={{
        position: 'absolute', inset: -70, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, hsla(280,50%,80%,0.14) 20%, hsla(200,50%,75%,0.1) 35%, hsla(50,50%,75%,0.06) 50%, transparent 65%)',
        filter: 'blur(22px)',
        animation: 'loginOrbRadiate 5s ease-in-out infinite',
      }} />

      {/* Main orb body */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
        background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.92) 0%, rgba(248,250,255,0.75) 20%, rgba(240,245,255,0.55) 45%, rgba(225,235,250,0.4) 70%, rgba(210,220,245,0.32) 100%)',
        boxShadow: 'inset 0 0 5px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.12)',
      }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 75% 65% at 28% 25%, hsla(260,85%,68%,0.6) 0%, hsla(230,85%,72%,0.35) 30%, transparent 60%)', animation: 'loginOrbSwirl 8s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 55% 70% at 18% 55%, hsla(185,90%,55%,0.65) 0%, hsla(170,85%,60%,0.3) 35%, transparent 65%)', animation: 'loginOrbSwirlReverse 10s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 50% 50% at 30% 75%, hsla(140,80%,52%,0.5) 0%, hsla(120,70%,58%,0.22) 40%, transparent 65%)', animation: 'loginOrbSwirl 12s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 45% at 50% 80%, hsla(48,85%,60%,0.5) 0%, hsla(40,80%,65%,0.22) 40%, transparent 65%)', animation: 'loginOrbSwirlReverse 9s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 50% 65% at 78% 60%, hsla(20,85%,58%,0.55) 0%, hsla(10,80%,62%,0.28) 35%, transparent 60%)', animation: 'loginOrbSwirl 11s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 65% 55% at 72% 28%, hsla(330,85%,62%,0.5) 0%, hsla(310,75%,66%,0.25) 35%, transparent 60%)', animation: 'loginOrbSwirlReverse 7s linear infinite' }} />
        {/* Rainbow rim ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from -30deg, hsla(0,90%,60%,0.65) 0%, hsla(30,90%,62%,0.6) 8%, hsla(55,90%,60%,0.55) 14%, hsla(100,85%,55%,0.5) 22%, hsla(160,90%,55%,0.55) 30%, hsla(195,90%,58%,0.6) 38%, hsla(220,90%,60%,0.65) 46%, hsla(260,90%,62%,0.6) 54%, hsla(290,85%,65%,0.55) 62%, hsla(325,90%,62%,0.55) 70%, hsla(350,90%,60%,0.6) 80%, hsla(10,90%,58%,0.6) 90%, hsla(0,90%,60%,0.65) 100%)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 48%, black 68%, black 100%)',
          maskImage: 'radial-gradient(circle, transparent 48%, black 68%, black 100%)',
          animation: 'loginOrbSwirl 18s linear infinite',
        }} />
        {/* Rotating rainbow overlay wash */}
        <div style={{
          position: 'absolute', inset: '-35%', borderRadius: '50%',
          background: 'conic-gradient(from 0deg, hsla(0,70%,75%,0.2) 0%, hsla(45,70%,72%,0.22) 12%, hsla(90,60%,70%,0.18) 24%, hsla(160,65%,72%,0.2) 36%, hsla(210,70%,74%,0.22) 48%, hsla(260,65%,76%,0.2) 60%, hsla(310,60%,74%,0.18) 72%, hsla(340,65%,72%,0.2) 84%, hsla(0,70%,75%,0.2) 100%)',
          animation: 'loginOrbSwirlReverse 14s linear infinite',
          mixBlendMode: 'overlay' as const,
          opacity: 0.9,
        }} />
        {/* Glass core + highlights */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 45% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.15) 50%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse 28% 22% at 72% 72%, rgba(255,255,255,0.35) 0%, rgba(230,240,255,0.15) 40%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 3px rgba(0,0,0,0.15), inset 0 0 1px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.12)' }} />
        <div style={{ position: 'absolute', inset: 1, borderRadius: '50%', border: '0.5px solid rgba(255,255,255,0.3)', pointerEvents: 'none' as const }} />
      </div>

      {/* Blue rim ring */}
      <div style={{
        position: 'absolute', inset: -4, borderRadius: '50%',
        border: '2px solid hsla(215,70%,60%,0.55)',
        boxShadow: '0 0 12px hsla(215,65%,55%,0.25), 0 0 25px hsla(215,60%,60%,0.12), inset 0 0 8px hsla(215,60%,70%,0.15)',
      }} />

      {/* Mic icon overlay when listening */}
      {isListening && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          opacity: 0.7,
        }}>
          <MicIcon size={size * 0.15} color={C.teal} />
        </div>
      )}
    </div>
  );
};

export default VoiceOrb;
