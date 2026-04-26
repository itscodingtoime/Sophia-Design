import { useState, useEffect, useCallback } from 'react';
import { C, useThemeMode } from '../../theme';
import { FEATURE_LABELS, DONUT_COLORS } from './constants';

export interface ScoringWeightsSlidersProps {
  weights: Record<string, number>;  // word keys: { ownership: 0.10, inquiry: 0.10, ... }
  isAdmin: boolean;
  updatedBy?: string | null;
  onSave: (weights: Record<string, number>) => Promise<void>;
}

/** Convert 0-1 weight to 1-10 importance scale */
function weightToImportance(w: number): number {
  return Math.max(1, Math.min(10, Math.round(w * 100)));
}

/** Convert 1-10 importance values to normalized 0-1 weights */
function importanceToWeights(importance: Record<string, number>): Record<string, number> {
  const total = Object.values(importance).reduce((s, v) => s + v, 0);
  if (total === 0) {
    const equal: Record<string, number> = {};
    FEATURE_LABELS.forEach(f => { equal[f.key] = 0.10; });
    return equal;
  }
  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries(importance)) {
    weights[k] = round4(v / total);
  }
  return weights;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const ScoringWeightsSliders = ({ weights: initialWeights, isAdmin, updatedBy, onSave }: ScoringWeightsSlidersProps) => {
  useThemeMode();

  // Convert incoming weights to 1-10 importance scale
  const toImportance = (w: Record<string, number>) => {
    const imp: Record<string, number> = {};
    FEATURE_LABELS.forEach(f => { imp[f.key] = weightToImportance(w[f.key] || 0.10); });
    return imp;
  };

  const [localImportance, setLocalImportance] = useState(() => toImportance(initialWeights));
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedImportance, setSavedImportance] = useState(() => toImportance(initialWeights));

  useEffect(() => {
    const imp = toImportance(initialWeights);
    setLocalImportance(imp);
    setSavedImportance(imp);
  }, [JSON.stringify(initialWeights)]);

  const hasChanges = JSON.stringify(localImportance) !== JSON.stringify(savedImportance);

  const handleChange = useCallback((key: string, value: number) => {
    setLocalImportance(prev => ({ ...prev, [key]: Math.max(1, Math.min(10, value)) }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const weights = importanceToWeights(localImportance);
      await onSave(weights);
      setSavedImportance(localImportance);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save weights:', err);
    } finally {
      setIsSaving(false);
    }
  }, [localImportance, onSave]);

  const handleReset = useCallback(() => {
    const equal: Record<string, number> = {};
    FEATURE_LABELS.forEach(f => { equal[f.key] = 5; });
    setLocalImportance(equal);
  }, []);

  const isDefault = FEATURE_LABELS.every(f => localImportance[f.key] === 5);

  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: '12px 16px',
      border: `1px solid ${C.border}`,
      boxShadow: `0 2px 12px ${C.shadowColor}`,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: C.textDim,
        textTransform: 'uppercase', letterSpacing: 1.2,
        fontFamily: "'Tomorrow', sans-serif",
        marginBottom: 8,
      }}>
        Dimension Importance
      </div>

      {/* Compact slider rows */}
      {FEATURE_LABELS.map((f, i) => {
        const val = localImportance[f.key] || 5;
        const fillPct = ((val - 1) / 9) * 100;

        return (
          <div key={f.key} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: DONUT_COLORS[i],
              width: 72, flexShrink: 0,
              fontFamily: "'Tomorrow', sans-serif",
            }}>
              {f.short}
            </span>

            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={val}
              onChange={(e) => handleChange(f.key, Number(e.target.value))}
              disabled={!isAdmin}
              aria-label={`${f.short} importance`}
              style={{
                flex: 1, height: 3,
                appearance: 'none', WebkitAppearance: 'none',
                background: `linear-gradient(to right, ${DONUT_COLORS[i]}${isAdmin ? '99' : '4D'} ${fillPct}%, ${C.border} ${fillPct}%)`,
                borderRadius: 2,
                outline: 'none',
                cursor: isAdmin ? 'pointer' : 'default',
                opacity: isAdmin ? 1 : 0.6,
                pointerEvents: isAdmin ? 'auto' : 'none',
              }}
            />

            <span style={{
              fontSize: 11, fontWeight: 600, color: C.textSec,
              fontFamily: "'JetBrains Mono', monospace",
              width: 20, textAlign: 'right', flexShrink: 0,
            }}>
              {val}
            </span>
          </div>
        );
      })}

      {/* Actions */}
      {isAdmin && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 8,
        }}>
          {!isDefault ? (
            <button
              onClick={handleReset}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 10, color: C.textDim, fontFamily: "'Tomorrow', sans-serif",
                padding: 0,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
            >
              Reset
            </button>
          ) : <div />}

          {showSuccess ? (
            <span style={{ fontSize: 10, color: C.teal, fontFamily: "'Tomorrow', sans-serif" }}>Saved</span>
          ) : hasChanges ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                background: C.teal, color: C.bg, borderRadius: 8,
                padding: '4px 16px', fontSize: 11, fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif",
                border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.5 : 1,
              }}
            >
              {isSaving ? '...' : 'Save'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ScoringWeightsSliders;
