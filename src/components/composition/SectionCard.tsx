import React, { useState, useCallback } from 'react';
import { C, useThemeMode } from '../../theme';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className,
  noPadding,
}) => {
  useThemeMode();
  const [hovered, setHovered] = useState(false);

  const handleEnter = useCallback(() => setHovered(true), []);
  const handleLeave = useCallback(() => setHovered(false), []);

  const hasHeader = title || headerAction;

  return (
    <div
      className={className}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        transition: 'box-shadow 0.2s ease',
        boxShadow: hovered ? `0 4px 20px ${C.shadowColor}` : 'none',
      }}
    >
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: "'Josefin Sans', sans-serif",
                  color: C.text,
                  letterSpacing: 0.2,
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {headerAction && <div style={{ flexShrink: 0 }}>{headerAction}</div>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : 20 }}>{children}</div>
    </div>
  );
};
