import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface SophiaPageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: string[];
}

export const SophiaPageHeader: React.FC<SophiaPageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  breadcrumb,
}) => {
  useThemeMode();
  return (
  <div
    style={{
      width: '100%',
      padding: '16px 24px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: C.textDim,
            fontFamily: "'Tomorrow', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
              <span>{crumb}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div style={{ flexShrink: 0, color: C.teal, display: 'flex', alignItems: 'center' }}>
            {icon}
          </div>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            fontFamily: "'Josefin Sans', sans-serif",
            color: C.text,
            letterSpacing: 0.3,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
      </div>
      {subtitle && (
        <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.4 }}>{subtitle}</div>
      )}
    </div>

    {actions && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {actions}
      </div>
    )}
  </div>
  );
};
