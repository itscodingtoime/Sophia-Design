import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import {
  getUnmatchedSpeakers,
  confirmSpeaker,
  rejectSpeaker,
  type UnmatchedSpeaker,
} from '../services/api';

// ─── Types ───

interface SpeakerConfirmationProps {
  meetingId: number;
  onSpeakersUpdated?: () => void;
}

// ─── Icons ───

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const UserIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Speaker Row ───

function SpeakerRow({
  speaker,
  onConfirm,
  onReject,
  busy,
}: {
  speaker: UnmatchedSpeaker;
  onConfirm: (speakerLabel: string, voiceprintId: string) => void;
  onReject: (speakerLabel: string, voiceprintId: string | null, correctName: string | null) => void;
  busy: boolean;
}) {
  useThemeMode();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [selectedVoiceprintId, setSelectedVoiceprintId] = useState<string>('');
  const [freeTextName, setFreeTextName] = useState('');

  const suggestions = speaker.voiceprint_suggestions ?? [];
  const topSuggestion = suggestions.length > 0 ? suggestions[0] : null;

  const handleRejectSubmit = () => {
    if (selectedVoiceprintId) {
      onReject(speaker.speaker_label, selectedVoiceprintId, null);
    } else if (freeTextName.trim()) {
      onReject(speaker.speaker_label, null, freeTextName.trim());
    }
    setShowRejectForm(false);
    setSelectedVoiceprintId('');
    setFreeTextName('');
  };

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: C.hoverBg, border: `1px solid ${C.border}`,
      marginBottom: 8,
    }}>
      {/* Speaker info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: `${C.teal}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <UserIcon size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
              {speaker.current_name || speaker.speaker_label}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {topSuggestion && (
            <button
              onClick={() => onConfirm(speaker.speaker_label, topSuggestion.id)}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                background: `${C.teal}15`, border: `1px solid ${C.tealBorder}`,
                color: C.teal, fontSize: 11, fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif",
                opacity: busy ? 0.5 : 1,
              }}
            >
              <CheckIcon size={12} />
              {topSuggestion.display_name}
            </button>
          )}
          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.textDim, fontSize: 11, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {showRejectForm ? <XIcon size={12} /> : <UserIcon size={12} />}
            {showRejectForm ? 'Cancel' : 'Name'}
          </button>
        </div>
      </div>

      {/* Reject / assign form */}
      {showRejectForm && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>Assign this speaker to:</div>

          {suggestions.length > 0 && (
            <select
              value={selectedVoiceprintId}
              onChange={e => { setSelectedVoiceprintId(e.target.value); setFreeTextName(''); }}
              style={{
                padding: '8px 12px', borderRadius: 8,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                cursor: 'pointer',
              }}
            >
              <option value="">Select a known voice...</option>
              {suggestions.map(vp => (
                <option key={vp.id} value={vp.id}>
                  {vp.display_name}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {suggestions.length > 0 && (
              <span style={{ fontSize: 11, color: C.textDim }}>or</span>
            )}
            <input
              type="text"
              value={freeTextName}
              onChange={e => { setFreeTextName(e.target.value); setSelectedVoiceprintId(''); }}
              placeholder="Type a name..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleRejectSubmit}
            disabled={busy || (!selectedVoiceprintId && !freeTextName.trim())}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              background: C.teal, border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
              opacity: (busy || (!selectedVoiceprintId && !freeTextName.trim())) ? 0.5 : 1,
              alignSelf: 'flex-end',
            }}
          >
            Assign
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export function SpeakerConfirmation({ meetingId, onSpeakersUpdated }: SpeakerConfirmationProps) {
  useThemeMode();
  const { getApiToken } = useSophiaAuth();

  const [unmatchedSpeakers, setUnmatchedSpeakers] = useState<UnmatchedSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchUnmatched = useCallback(async () => {
    try {
      const token = await getApiToken();
      const data = await getUnmatchedSpeakers(meetingId, token);
      setUnmatchedSpeakers(data?.unmatched_speakers ?? []);
    } catch {
      // API error — silently hide component
    } finally {
      setLoading(false);
    }
  }, [meetingId, getApiToken]);

  useEffect(() => {
    fetchUnmatched();
  }, [fetchUnmatched]);

  const handleConfirm = async (speakerLabel: string, voiceprintId: string) => {
    setBusy(true);
    try {
      const token = await getApiToken();
      const result = await confirmSpeaker(meetingId, speakerLabel, voiceprintId, token);
      toast.success(`Speaker confirmed -- ${result.turns_updated} turn${result.turns_updated !== 1 ? 's' : ''} updated`);
      await fetchUnmatched();
      onSpeakersUpdated?.();
    } catch (err) {
      console.error('Failed to confirm speaker:', err);
      toast.error('Failed to confirm speaker');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (speakerLabel: string, voiceprintId: string | null, correctName: string | null) => {
    setBusy(true);
    try {
      const token = await getApiToken();
      await rejectSpeaker(meetingId, speakerLabel, voiceprintId, correctName, token);
      toast.success('Speaker assignment updated');
      await fetchUnmatched();
      onSpeakersUpdated?.();
    } catch (err) {
      console.error('Failed to update speaker:', err);
      toast.error('Failed to update speaker');
    } finally {
      setBusy(false);
    }
  };

  // Render nothing while loading, if no unmatched speakers, or on error
  if (loading || unmatchedSpeakers.length === 0) return null;

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', marginBottom: 16,
      border: `1px solid ${C.tealBorder}`,
      background: C.card,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer',
          background: `${C.teal}08`, border: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: `${C.teal}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserIcon size={13} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.teal, fontFamily: "'Tomorrow', sans-serif" }}>
            {unmatchedSpeakers.length} speaker{unmatchedSpeakers.length !== 1 ? 's' : ''} weren&apos;t identified
          </span>
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 400 }}>
            &mdash; Name them now
          </span>
        </div>
        <div style={{ color: C.teal }}>
          <ChevronIcon open={expanded} />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '12px 18px 18px' }}>
          {unmatchedSpeakers.map(speaker => (
            <SpeakerRow
              key={speaker.speaker_label}
              speaker={speaker}
              onConfirm={handleConfirm}
              onReject={handleReject}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SpeakerConfirmation;
