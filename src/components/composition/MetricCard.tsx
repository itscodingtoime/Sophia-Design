import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; percent: number };
  icon?: React.ReactNode;
  sparkline?: React.ReactNode;
  subtitle?: string;
}

const TrendBadge: React.FC<{ direction: 'up' | 'down' | 'flat'; percent: number }> = ({
  direction,
  percent,
}) => {
  const color = direction === 'up' ? C.green : direction === 'down' ? C.red : C.textDim;
  const arrow = direction === 'up' ? '\u2191' : direction === 'down' ? '\u2193' : '\u2192';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 600,
        color,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {arrow} {percent}%
    </span>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  icon,
  sparkline,
  subtitle,
}) => {
  useThemeMode();
  return (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            color: C.text,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: "'Tomorrow', sans-serif",
            color: C.textSec,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      </div>
      {icon && (
        <div style={{ color: C.textDim, flexShrink: 0 }}>{icon}</div>
      )}
    </div>

    {trend && <TrendBadge direction={trend.direction} percent={trend.percent} />}

    {subtitle && (
      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.3 }}>{subtitle}</div>
    )}

    {sparkline && <div style={{ marginTop: 4 }}>{sparkline}</div>}
  </div>
  );
};
