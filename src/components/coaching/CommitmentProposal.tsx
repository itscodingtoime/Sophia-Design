/**
 * CommitmentProposal -- Inline chat proposal card for commitments.
 *
 * Renders inside SOPHIA chat bubble with Save / Not now buttons.
 * Becomes read-only after action (shows Saved/Skipped chip).
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { C, useThemeMode } from '../../theme';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface CommitmentProposalProps {
  action: string;
  doneWhen: string;
  dueDate: string;
  sessionId?: string;
  token: string;
  onSaved: () => void;
  evidenceQuote?: string;  // Phase 21 D-16 — optional transcript line for the expand
  meetingDate?: string;    // Phase 21 D-16 — optional date to render in the expand header
}

export function CommitmentProposal({ action, doneWhen, dueDate, sessionId, token, onSaved, evidenceQuote, meetingDate }: CommitmentProposalProps) {
  useThemeMode(); // Subscribe to theme re-renders

  const [state, setState] = useState<'pending' | 'saved' | 'skipped'>('pending');
  const [saving, setSaving] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState<boolean>(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/coach/commitments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          done_when: doneWhen || null,
          due_date: dueDate || null,
          session_id: sessionId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save commitment');
      setState('saved');
      onSaved();
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setState('skipped');
  };

  return (
    <div style={{
      background: C.tealGlow,
      border: `1px solid ${C.tealBorder}`,
      borderRadius: 14,
      padding: 16,
      marginTop: 12,
    }}>
      {/* Label + action */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: 'uppercase', letterSpacing: 1 }}>
          Commit to:
        </span>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.4 }}>
          {action}
        </div>
      </div>

      {/* Done when */}
      {doneWhen && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 400, color: C.textDim }}>
            Done when: {doneWhen}
          </span>
        </div>
      )}

      {/* Due date */}
      {dueDate && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 400, color: C.textDim }}>
            By: {dueDate}
          </span>
        </div>
      )}

      {/* Action buttons or result chip */}
      {state === 'pending' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: !doneWhen && !dueDate ? 12 : 0 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: C.teal,
              color: '#0A0A0C',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 10,
              padding: '8px 16px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontFamily: "'Tomorrow', sans-serif",
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? 'Saving...' : 'Save Commitment'}
          </button>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              color: C.textDim,
              fontSize: 12,
              borderRadius: 10,
              padding: '8px 16px',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Not now
          </button>
        </div>
      ) : state === 'saved' ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
          padding: '6px 12px', borderRadius: 8,
          marginTop: !doneWhen && !dueDate ? 12 : 0,
        }}>
          <Check size={12} style={{ color: C.teal }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.teal }}>Saved</span>
        </div>
      ) : (
        <div style={{ marginTop: !doneWhen && !dueDate ? 12 : 0 }}>
          <span style={{ fontSize: 12, color: C.textDim }}>Skipped</span>
        </div>
      )}

      {/* Phase 21 D-16: Evidence expand — only when evidenceQuote is present */}
      {evidenceQuote && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => setEvidenceOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: C.textDim,
              fontSize: 12,
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            <span style={{ fontSize: 10, lineHeight: 1 }}>{evidenceOpen ? '\u25BE' : '\u25B8'}</span>
            Where did this come from?
          </button>
          {evidenceOpen && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSec,
                  marginBottom: 6,
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                {meetingDate ? `From your meeting on ${meetingDate}:` : 'From your meeting:'}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.text,
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                &ldquo;{evidenceQuote}&rdquo;
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.textDim,
                  marginTop: 8,
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Paraphrased in SOPHIA's voice. This is the transcript line it came from.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
