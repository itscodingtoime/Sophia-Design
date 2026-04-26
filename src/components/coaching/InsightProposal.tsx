/**
 * InsightProposal -- Inline chat proposal card for insights.
 *
 * Renders inside SOPHIA chat bubble with Remember This / Skip buttons.
 * Becomes read-only after action (shows Saved/Skipped chip).
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { C, useThemeMode } from '../../theme';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface InsightProposalProps {
  observation: string;
  sessionId?: string;
  token: string;
  onApproved: () => void;
}

export function InsightProposal({ observation, sessionId, token, onApproved }: InsightProposalProps) {
  useThemeMode(); // Subscribe to theme re-renders

  const [state, setState] = useState<'pending' | 'saved' | 'skipped'>('pending');
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/coach/insights`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observation,
          session_id: sessionId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save insight');
      setState('saved');
      onApproved();
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setState('skipped');
  };

  return (
    <div style={{
      background: C.hoverBg,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 16,
      marginTop: 12,
    }}>
      {/* Observation text */}
      <div style={{
        fontSize: 13,
        fontWeight: 400,
        fontStyle: 'italic',
        color: C.text,
        lineHeight: 1.5,
        marginBottom: 12,
      }}>
        {observation}
      </div>

      {/* Action buttons or result chip */}
      {state === 'pending' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleApprove}
            disabled={saving}
            style={{
              background: C.tealGlow,
              border: `1px solid ${C.tealBorder}`,
              color: C.teal,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 10,
              padding: '8px 16px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontFamily: "'Tomorrow', sans-serif",
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? 'Saving...' : 'Remember This'}
          </button>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              color: C.textDim,
              fontSize: 12,
              borderRadius: 10,
              padding: '8px 16px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Skip
          </button>
        </div>
      ) : state === 'saved' ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
          padding: '6px 12px', borderRadius: 8,
        }}>
          <Check size={12} style={{ color: C.teal }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.teal }}>Saved</span>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: C.textDim }}>Skipped</span>
      )}
    </div>
  );
}
