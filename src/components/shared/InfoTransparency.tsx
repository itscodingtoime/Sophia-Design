import type { ReactNode } from 'react';
import { C } from '../../theme';

export interface TransparencyItem {
  icon?: ReactNode;
  label: string;
  dest: string;
}

export interface InfoTransparencyProps {
  title?: string;
  items: TransparencyItem[];
}

/**
 * Info / transparency disclosure card.
 * Shows a list of data-flow items with icons, labels, and destination descriptions.
 */
const InfoTransparency = ({ title, items }: InfoTransparencyProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
    {title && (
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {title}
      </div>
    )}
    {items.map((item, i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
        borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
      }}>
        {item.icon && (
          <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.icon}
          </div>
        )}
        <div style={{ flex: 1, fontSize: 11.5, color: C.textSec, fontWeight: 500, minWidth: 0 }}>
          {item.label}
        </div>
        <div style={{
          fontSize: 10, color: C.textDim, fontWeight: 500,
          letterSpacing: 0.3, textAlign: 'right' as const,
          flexShrink: 0, maxWidth: 80, lineHeight: 1.3,
        }}>
          {item.dest}
        </div>
      </div>
    ))}
  </div>
);

export default InfoTransparency;
