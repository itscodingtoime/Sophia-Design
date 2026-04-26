import { C, useThemeMode } from '../../theme';

export interface AvatarProps {
  name: string;
  size?: number;
  image?: string | null;
  bgColor?: string | null;
  ringColor?: string | null;
}

/**
 * Circular avatar with name-initial fallback and optional image.
 * Generates a deterministic hue from the name for gradient + glow.
 */
const Avatar = ({ name, size = 38, image, bgColor, ringColor }: AvatarProps) => {
  useThemeMode();
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const glowColor = ringColor || `hsla(${hue},50%,55%,1)`;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: image
        ? `url(${image}) center/cover no-repeat`
        : bgColor || `linear-gradient(135deg, hsla(${hue},40%,30%,0.9), hsla(${hue + 40},35%,20%,0.95))`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 700,
      color: C.white,
      boxShadow: `0 0 0 3px ${glowColor}88, 0 0 12px ${glowColor}44`,
      flexShrink: 0,
      letterSpacing: 0.5,
      textShadow: '0 1px 3px rgba(0,0,0,0.25)',
      fontFamily: "'Tomorrow', sans-serif",
    }}>
      {!image && initials}
    </div>
  );
};

export default Avatar;
