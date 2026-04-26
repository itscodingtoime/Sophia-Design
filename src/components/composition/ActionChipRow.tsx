import React, { useCallback } from 'react';
import { C, useThemeMode } from '../../theme';

export interface Chip {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface ActionChipRowProps {
  chips: Chip[];
  activeValue?: string;
  onSelect: (value: string) => void;
  size?: 'sm' | 'md';
}

const ChipButton: React.FC<{
  chip: Chip;
  active: boolean;
  size: 'sm' | 'md';
  onSelect: (value: string) => void;
}> = ({ chip, active, size, onSelect }) => {
  useThemeMode();
  const handleClick = useCallback(() => onSelect(chip.value), [onSelect, chip.value]);

  const pad = size === 'sm' ? '6px 14px' : '10px 20px';
  const fontSize = size === 'sm' ? 12 : 13;

  return (
    <button
      onClick={handleClick}
      style={{
        padding: pad,
        borderRadius: 14,
        cursor: 'pointer',
        background: active ? C.tealGlow : C.hoverBg,
        border: `1px solid ${active ? C.tealBorder : C.border}`,
        color: active ? C.teal : C.textSec,
        fontSize,
        fontWeight: 500,
        fontFamily: "'Tomorrow', sans-serif",
        transition: 'all 0.2s',
        whiteSpace: 'nowrap' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = C.tealBorder;
          e.currentTarget.style.color = C.text;
          e.currentTarget.style.background = C.activeBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.color = C.textSec;
          e.currentTarget.style.background = C.hoverBg;
        }
      }}
    >
      {chip.icon}
      {chip.label}
    </button>
  );
};

export const ActionChipRow: React.FC<ActionChipRowProps> = ({
  chips,
  activeValue,
  onSelect,
  size = 'md',
}) => {
  useThemeMode();
  return (
  <div
    style={{
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      flexWrap: 'nowrap',
    }}
  >
    {chips.map((chip) => (
      <ChipButton
        key={chip.value}
        chip={chip}
        active={chip.value === activeValue}
        size={size}
        onSelect={onSelect}
      />
    ))}
  </div>
  );
};
