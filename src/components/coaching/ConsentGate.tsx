/**
 * ConsentGate -- Inline consent chat bubble for new users.
 *
 * Renders as a SOPHIA chat message (not a modal). Shows consent explanation
 * with Accept/Decline buttons. After acceptance, shows static "Accepted" chip.
 *
 * Per UI-SPEC Component 1 and D-01, D-02.
 */
import { useState } from 'react';
import { C, useThemeMode } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';

interface ConsentGateProps {
  onAccept: () => void;
  onDecline: () => void;
  accepted?: boolean;
}

export function ConsentGate({ onAccept, onDecline, accepted }: ConsentGateProps) {
  useThemeMode();
  const [localAccepted, setLocalAccepted] = useState(accepted ?? false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept();
      setLocalAccepted(true);
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const isAccepted = localAccepted || accepted;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      marginBottom: 6,
    }}>
      <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
        <SophiaWhiteOrb size={36} animate={false} />
      </div>
      <div style={{
        maxWidth: 480,
        background: C.chatBubbleSophia,
        borderRadius: '18px 18px 18px 4px',
        padding: '16px 24px',
      }}>
        {/* Header */}
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: C.text,
          fontFamily: "'Josefin Sans', sans-serif",
          marginBottom: 12,
        }}>
          Welcome to SOPHIA
        </div>

        {/* Consent message -- exact UI-SPEC copy */}
        <div style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: C.text,
          fontFamily: "'Tomorrow', sans-serif",
          marginBottom: 16,
        }}>
          Hi! I'm SOPHIA — here to support how you and your team work together, not to judge it. Before we begin, here's what I do and how your data stays private:
        </div>

        <ul style={{
          margin: '0 0 16px 0',
          paddingLeft: 20,
          fontSize: 13,
          lineHeight: 1.6,
          color: C.textSec,
          fontFamily: "'Tomorrow', sans-serif",
        }}>
          <li style={{ marginBottom: 6 }}>I observe patterns in your meeting language to offer personalised coaching</li>
          <li style={{ marginBottom: 6 }}>I track your goals and commitments to help you grow</li>
          <li style={{ marginBottom: 6 }}>Your individual data is never shared with teammates or managers</li>
          <li>You control what I remember through your privacy settings</li>
        </ul>

        <div style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: C.text,
          fontFamily: "'Tomorrow', sans-serif",
          marginBottom: 20,
        }}>
          Ready to get started?
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          {isAccepted ? (
            <div style={{
              background: C.tealGlow,
              color: C.teal,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
              borderRadius: 12,
              padding: '12px 24px',
              cursor: 'default',
            }}>
              Accepted
            </div>
          ) : (
            <>
              <button
                onClick={handleAccept}
                disabled={loading}
                role="button"
                aria-label="Accept coaching consent and start coaching"
                style={{
                  background: C.teal,
                  color: '#0A0A0C',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Tomorrow', sans-serif",
                  borderRadius: 12,
                  padding: '12px 24px',
                  border: 'none',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {loading ? 'Saving...' : 'Accept & Start Coaching'}
              </button>
              <button
                onClick={onDecline}
                role="button"
                aria-label="Decline coaching consent"
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.textSec,
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: "'Tomorrow', sans-serif",
                  borderRadius: 12,
                  padding: '12px 24px',
                  cursor: 'pointer',
                }}
              >
                Not Right Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
