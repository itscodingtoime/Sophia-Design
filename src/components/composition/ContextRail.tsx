import React from 'react';
import { C, useThemeMode } from '../../theme';

export interface ContextRailProps {
  open: boolean;
  onToggle: () => void;
  width?: number;
  children: React.ReactNode;
}

export const ContextRail: React.FC<ContextRailProps> = ({
  open,
  onToggle,
  width = 300,
  children,
}) => {
  useThemeMode();
  return (
  <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
    {/* Toggle button */}
    <button
      onClick={onToggle}
      aria-label={open ? 'Collapse panel' : 'Expand panel'}
      style={{
        position: 'absolute',
        left: -14,
        top: 16,
        zIndex: 2,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: C.card,
        border: `1px solid ${C.border}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        color: open ? C.teal : C.textDim,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.35s ease',
        }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    {/* Panel */}
    <div
      style={{
        width: open ? width : 0,
        overflow: open ? 'visible' : 'hidden',
        borderLeft: open ? `1px solid ${C.border}` : 'none',
        background: C.bgSub,
        transition: 'all 0.35s ease',
        opacity: open ? 1 : 0,
      }}
    >
      <div
        style={{
          width,
          height: '100%',
          overflowY: 'auto',
          padding: open ? '24px 20px' : '24px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {children}
      </div>
    </div>
  </div>
  );
};
