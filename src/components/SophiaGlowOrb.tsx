/**
 * SophiaGlowOrb — brand-correct sophia mark with a soft glow halo and the
 * brand "sophia" wordmark. Wordmark colour follows the active theme.
 */
import sophiaOrbmark from '../assets/sophia-orbmark-brand.png';
import sophiaWordmarkWhite from '../assets/sophia-wordmark-brand-white.png';
import sophiaWordmarkBlack from '../assets/sophia-wordmark-brand-black.png';
import { useThemeMode } from '../theme';

interface SophiaGlowOrbProps {
  size?: number;
  showWordmark?: boolean;
  glow?: boolean;
}

export function SophiaGlowOrb({
  size = 120,
  showWordmark = true,
  glow = true,
}: SophiaGlowOrbProps) {
  const { mode } = useThemeMode();
  const wordmark = mode === 'dark' ? sophiaWordmarkWhite : sophiaWordmarkBlack;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: '-32%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,210,170,0.5), transparent 55%),' +
              'radial-gradient(circle at 75% 30%, rgba(255,170,200,0.5), transparent 55%),' +
              'radial-gradient(circle at 70% 80%, rgba(195,240,180,0.45), transparent 60%),' +
              'radial-gradient(circle at 25% 80%, rgba(255,250,200,0.4), transparent 60%)',
            filter: 'blur(32px)',
            opacity: 0.95,
            animation: 'sophiaGlowPulse 6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <img
        src={sophiaOrbmark}
        alt="sophia"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
      />

      {showWordmark && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <img
            src={wordmark}
            alt="sophia"
            style={{
              width: '55%',
              height: 'auto',
              opacity: 0.96,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes sophiaGlowPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default SophiaGlowOrb;
