import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface HeroInsightCardProps {
  title: string;
  subtitle?: string;
  timestamp?: string;
  icon?: React.ReactNode;
  onTap?: () => void;
  onDismiss?: () => void;
}

const DefaultIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={C.teal}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L16.18 19 12 15.27 7.82 19l1.09-6.26L3.82 9l6.09-.74z" />
  </svg>
);

export const HeroInsightCard: React.FC<HeroInsightCardProps> = ({
  title,
  subtitle,
  timestamp,
  icon,
  onTap,
  onDismiss,
}) => {
  useThemeMode();
  return (
  <div
    onClick={onTap}
    role={onTap ? 'button' : undefined}
    tabIndex={onTap ? 0 : undefined}
    onKeyDown={onTap ? (e) => { if (e.key === 'Enter') onTap(); } : undefined}
    style={{
      padding: '16px 18px',
      background: C.tealGlow,
      border: `1px solid ${C.tealBorder}`,
      borderLeft: `3px solid ${C.teal}`,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      cursor: onTap ? 'pointer' : 'default',
      transition: 'background 0.2s',
      animation: 'notifSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    }}
    onMouseEnter={(e) => {
      if (onTap) e.currentTarget.style.background = 'rgba(192,230,137,0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = C.tealGlow;
    }}
  >
    {/* Icon */}
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.tealGlow,
      }}
    >
      {icon ?? <DefaultIcon />}
    </div>

    {/* Content */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: C.teal,
            boxShadow: `0 0 8px ${C.teal}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Josefin Sans', sans-serif",
            color: C.teal,
          }}
        >
          {title}
        </span>
      </div>
      {subtitle && (
        <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5 }}>{subtitle}</div>
      )}
      {timestamp && (
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{timestamp}</div>
      )}
    </div>

    {/* Dismiss */}
    {onDismiss && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: C.textDim,
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
          flexShrink: 0,
        }}
      >
        {'\u00D7'}
      </button>
    )}
  </div>
  );
};
