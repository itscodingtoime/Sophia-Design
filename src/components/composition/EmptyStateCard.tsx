import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface EmptyStateCardProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  useThemeMode();
  return (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      gap: 12,
    }}
  >
    {icon && (
      <div style={{ fontSize: 48, color: C.textDim, marginBottom: 4, lineHeight: 1 }}>
        {icon}
      </div>
    )}
    <div
      style={{
        fontSize: 16,
        fontWeight: 500,
        fontFamily: "'Josefin Sans', sans-serif",
        color: C.text,
        lineHeight: 1.3,
      }}
    >
      {title}
    </div>
    {description && (
      <div
        style={{
          fontSize: 13,
          color: C.textSec,
          lineHeight: 1.5,
          maxWidth: 320,
        }}
      >
        {description}
      </div>
    )}
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </div>
  );
};
