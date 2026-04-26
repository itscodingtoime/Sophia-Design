import type { ReactNode } from 'react';
import { C, useThemeMode } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';

export interface NotificationCardProps {
  title: string;
  body: string;
  time: string;
  icon?: ReactNode;
  onClick?: () => void;
  onDismiss?: () => void;
}

/**
 * Notification display card with icon, title, body, and time.
 * Defaults to SophiaWhiteOrb as the icon.
 */
const NotificationCard = ({ title, body, time, icon, onClick, onDismiss }: NotificationCardProps) => {
  useThemeMode();
  return (
  <div
    style={{
      padding: '16px 18px',
      background: C.tealGlow,
      border: `1px solid ${C.tealBorder}`,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      cursor: onClick ? 'pointer' : undefined,
      transition: 'background 0.2s',
    }}
    onClick={onClick}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(192,230,137,0.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = C.tealGlow; }}
  >
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icon || <SophiaWhiteOrb size={32} animate={false} />}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.teal,
          boxShadow: `0 0 8px ${C.teal}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5 }}>{body}</div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{time}</div>
    </div>

    {onDismiss && (
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: 'none', border: 'none', color: C.textDim,
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
        }}
      >
        &times;
      </button>
    )}
  </div>
  );
};

export default NotificationCard;
