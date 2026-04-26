/**
 * AvatarWithRing -- Avatar wrapper that shows a green enrollment status ring.
 *
 * Enrolled: green box-shadow ring (2.5px, C.teal color)
 * Not enrolled: no ring
 */
import { C, useThemeMode } from '../theme';

interface AvatarWithRingProps {
  imageUrl?: string | null;
  name: string;
  isEnrolled: boolean;
  size?: number;
}

export default function AvatarWithRing({ imageUrl, name, isEnrolled, size = 36 }: AvatarWithRingProps) {
  useThemeMode(); // subscribe to theme re-renders
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        boxShadow: isEnrolled ? `0 0 0 2.5px ${C.teal}` : 'none',
        padding: isEnrolled ? 2 : 0,
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: C.teal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.35,
            fontWeight: 600,
            color: C.bg,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
