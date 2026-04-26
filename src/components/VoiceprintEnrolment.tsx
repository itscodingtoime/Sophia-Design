import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import { enrolVoiceprint, deleteVoiceprint, getVoiceprintQuality } from '../services/api';

// ─── Types ───

type EnrolStep = 'idle' | 'record' | 'submitting';

interface VoiceprintEnrolmentProps {
  isEnrolled: boolean;
  enrolledAt: string | null;
  onStatusChange: () => void;
}

// ─── Single Enrollment Passage ───

const ENROLLMENT_PASSAGE = {
  text: "SOPHIA means wisdom. She's our AI team coach, here to support how we work together, not judge it. Privacy is at the heart of everything she does, and she will never monitor or evaluate anyone individually. SOPHIA exists for one reason: to make our working lives easier. She helps us see what's working, what's not, and where we're leaving potential on the table. Better communication. Clearer decisions. Less stress. More time doing the work that actually matters. She's not here to fix us. She's here to empower us. A guide in the background, helping the team become the best version of itself.",
  durationHint: '~40 seconds',
};

const RECORD_DURATION = 45; // seconds max
const MIN_RECORD_SECONDS = 25; // seconds minimum before "Done" enabled
const SILENCE_RMS_THRESHOLD = 0.02;

// ─── Mic Icon (self-contained) ───

const MicIcon = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// ─── Checkmark Icon ───

const CheckIcon = ({ size = 16, color = 'rgb(34,197,94)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Main Component ───

export default function VoiceprintEnrolment({ isEnrolled, enrolledAt, onStatusChange }: VoiceprintEnrolmentProps) {
  useThemeMode(); // subscribe to theme changes for C.* inline styles

  const { getApiToken } = useSophiaAuth();
  const { user } = useUser();

  // ─── State ───
  const [step, setStep] = useState<EnrolStep>('idle');
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Quality display after enrolment
  const [qualityInfo, setQualityInfo] = useState<{ sample_count: number } | null>(null);

  // ─── Refs ───
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxRmsRef = useRef(0);
  const secondsRef = useRef(0);

  // ─── Cleanup on unmount or step change away from record ───
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [cleanupRecording]);

  // ─── Recording logic ───

  const startRecording = async () => {
    setError(null);
    setRecordingSeconds(0);
    setAudioLevel(0);
    maxRmsRef.current = 0;
    secondsRef.current = 0;
    chunksRef.current = [];
    setSilenceWarning(false);
    setIsRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Set up AudioContext + AnalyserNode for level meter
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Choose MIME type with fallback
      const mimeOptions = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let mimeType: string | undefined;
      for (const mime of mimeOptions) {
        if (MediaRecorder.isTypeSupported(mime)) { mimeType = mime; break; }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        // Check for silence
        if (maxRmsRef.current < SILENCE_RMS_THRESHOLD) {
          setSilenceWarning(true);
        }

        cleanupRecording();
        setIsRecording(false);

        // Auto-submit immediately after recording stops
        submitRecording(blob);
      };

      recorder.start(250);

      // Countdown timer
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
      }, 1000);

      // Auto-stop at RECORD_DURATION
      stopTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, RECORD_DURATION * 1000);

      // Audio level animation loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        if (rms > maxRmsRef.current) maxRmsRef.current = rms;
        setAudioLevel(rms);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateLevel);
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Microphone access denied. Please allow microphone access and try again.');
      setIsRecording(false);
    }
  };

  const stopEarly = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // ─── Submit (single blob, auto-called after recording) ───

  const submitRecording = async (blob: Blob) => {
    setStep('submitting');
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await getApiToken();
      // Pass the Clerk display name + photo so the voiceprint row has
      // display_name / image_url set at enrolment time instead of NULL.
      // Without this, matched speakers show up with raw Clerk user_ids
      // in the transcript UI. See BUG-44 / BUG-62.
      const displayName = user?.fullName || user?.firstName || undefined;
      const imageUrl = user?.imageUrl || undefined;
      await enrolVoiceprint(blob, token, displayName, imageUrl);

      // Fetch quality info
      try {
        const quality = await getVoiceprintQuality(token);
        setQualityInfo({ sample_count: quality.sample_count });
      } catch {
        // Non-critical, continue without quality info
      }

      toast.success('Voiceprint enrolled successfully');
      onStatusChange();
      resetFlow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enrol voiceprint';
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr?.response?.data?.detail || msg);
      setStep('record'); // Allow retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete ───

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await getApiToken();
      await deleteVoiceprint(token);
      toast.success('Voiceprint deleted');
      onStatusChange();
      resetFlow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete voiceprint';
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr?.response?.data?.detail || msg);
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ─── Helpers ───

  const resetFlow = () => {
    cleanupRecording();
    setStep('idle');
    setConsentChecked(false);
    setSilenceWarning(false);
    setError(null);
    setShowDeleteConfirm(false);
    setRecordingSeconds(0);
    setAudioLevel(0);
    setIsRecording(false);
    setQualityInfo(null);
  };

  const countdown = RECORD_DURATION - recordingSeconds;
  const canStopEarly = recordingSeconds >= MIN_RECORD_SECONDS;

  // ─── Render ───

  // Enrolled idle state
  if (step === 'idle' && isEnrolled) {
    const formattedDate = enrolledAt
      ? new Date(enrolledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '';

    return (
      <div>
        {/* Enrolled badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckIcon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>Enrolled</span>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'rgb(34,197,94)',
                background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6,
              }}>Active</span>
            </div>
            {formattedDate && (
              <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2 }}>Enrolled on {formattedDate}</div>
            )}
            {qualityInfo && (
              <div style={{ fontSize: 12, color: C.teal, marginTop: 2 }}>
                Voiceprint created with {qualityInfo.sample_count} samples. It will keep improving with every meeting.
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setConsentChecked(true); setStep('record'); }}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: C.hoverBg, border: `1px solid ${C.tealBorder}`,
              color: C.teal, fontSize: 13, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Re-record
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(212,90,90,0.06)', border: '1px solid rgba(212,90,90,0.2)',
              color: '#D45A5A', fontSize: 13, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            Delete
          </button>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div style={{
            marginTop: 12, padding: '16px 18px', borderRadius: 12,
            background: 'rgba(212,90,90,0.05)', border: '1px solid rgba(212,90,90,0.15)',
          }}>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 500, marginBottom: 8 }}>Delete your voiceprint?</div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 14 }}>
              Future recordings won&apos;t identify your voice. Past recordings will show you as &quot;Unknown Speaker&quot;. This can&apos;t be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                style={{
                  flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  background: C.hoverBg, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 12, fontWeight: 600,
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                style={{
                  flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(212,90,90,0.12)', border: '1px solid rgba(212,90,90,0.25)',
                  color: '#D45A5A', fontSize: 12, fontWeight: 600,
                  fontFamily: "'Tomorrow', sans-serif",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#D45A5A', padding: '8px 12px', borderRadius: 8, background: 'rgba(212,90,90,0.06)' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Not enrolled idle state
  if (step === 'idle') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: C.hoverBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MicIcon size={22} color={C.textDim} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>Not enrolled</div>
            <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2 }}>Enrol your voice so SOPHIA can recognise you in meetings</div>
          </div>
        </div>
        <button
          onClick={() => setStep('record')}
          style={{
            width: '100%', padding: 12, borderRadius: 10, cursor: 'pointer',
            background: C.tealGlow || `${C.teal}12`, border: `1px solid ${C.tealBorder}`,
            color: C.teal, fontSize: 13, fontWeight: 600,
            fontFamily: "'Tomorrow', sans-serif",
          }}
        >
          Enrol Voice
        </button>
      </div>
    );
  }

  // ─── Active flow steps ───

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 16, fontSize: 12, color: '#D45A5A', padding: '8px 12px', borderRadius: 8, background: 'rgba(212,90,90,0.06)' }}>
          {error}
        </div>
      )}

      {/* Record step: passage + inline consent + start */}
      {step === 'record' && !isRecording && (
        <div style={{ animation: 'fadeSlide 0.3s ease' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 6 }}>Read the passage aloud</div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
            Read this passage aloud ({ENROLLMENT_PASSAGE.durationHint}). Speak continuously and avoid long pauses.
          </div>

          {/* Passage text */}
          <div style={{
            padding: '16px 18px', borderRadius: 10, marginBottom: 16,
            background: C.hoverBg, border: `1px solid ${C.border}`,
            fontSize: 14, color: C.text, lineHeight: 1.9,
            fontStyle: 'italic', letterSpacing: '0.02em',
          }}>
            &ldquo;{ENROLLMENT_PASSAGE.text}&rdquo;
          </div>

          {/* Silence warning from previous attempt */}
          {silenceWarning && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(245,158,11)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <div style={{ fontSize: 12.5, color: 'rgb(245,158,11)', fontWeight: 500, marginBottom: 2 }}>
                  Low audio detected
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim }}>Please try again in a quieter environment and speak clearly.</div>
              </div>
            </div>
          )}

          {/* Inline consent checkbox (pre-checked for returning users) */}
          {!consentChecked && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '10px 12px', borderRadius: 8,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              marginBottom: 14,
              transition: 'all 0.2s',
            }}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.teal, width: 15, height: 15 }}
              />
              <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                I consent to SOPHIA recording my voice for speaker identification
              </span>
            </label>
          )}

          <button
            onClick={startRecording}
            disabled={!consentChecked}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              cursor: consentChecked ? 'pointer' : 'not-allowed',
              background: consentChecked ? C.teal : C.hoverBg,
              border: `1px solid ${consentChecked ? C.teal : C.border}`,
              color: consentChecked ? '#fff' : C.textDim,
              fontSize: 13, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: consentChecked ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <MicIcon size={14} color={consentChecked ? '#fff' : C.textDim} />
            Start Recording
          </button>

          <button
            onClick={resetFlow}
            style={{
              width: '100%', marginTop: 10, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.textDim, fontSize: 13, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active recording */}
      {step === 'record' && isRecording && (
        <div style={{ animation: 'fadeSlide 0.3s ease', textAlign: 'center' }}>
          {/* Header */}
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Recording
          </div>

          {/* Countdown */}
          <div style={{
            fontSize: 48, fontWeight: 700, color: C.text,
            fontFamily: "'Josefin Sans', sans-serif", marginBottom: 4,
          }}>
            {countdown > 0 ? countdown : 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: C.red,
              animation: 'pulse 1.4s ease infinite', boxShadow: `0 0 6px ${C.red}`,
            }} />
            <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>Recording</span>
          </div>

          {/* Audio level bar */}
          <div style={{
            width: '100%', height: 8, borderRadius: 4,
            background: C.hoverBg, overflow: 'hidden', marginBottom: 8,
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${C.teal}, ${C.teal})`,
              width: `${Math.min(audioLevel * 500, 100)}%`,
              transition: 'width 0.08s ease-out',
            }} />
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 20 }}>Audio level</div>

          {/* Passage text during recording */}
          <div style={{
            padding: '16px 20px', borderRadius: 10,
            background: C.hoverBg, border: `1px solid ${C.border}`,
            fontSize: 14, color: C.text, lineHeight: 1.9,
            fontStyle: 'italic', marginBottom: 20, textAlign: 'left',
            letterSpacing: '0.02em',
          }}>
            &ldquo;{ENROLLMENT_PASSAGE.text}&rdquo;
          </div>

          {/* Done button (enabled after MIN_RECORD_SECONDS) */}
          {canStopEarly && (
            <button
              onClick={stopEarly}
              style={{
                padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
                background: C.teal, border: `1px solid ${C.teal}`,
                color: '#fff', fontSize: 13, fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Submitting state */}
      {step === 'submitting' && (
        <div style={{ animation: 'fadeSlide 0.3s ease', textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${C.border}`, borderTopColor: C.teal,
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            Creating your voiceprint...
          </div>
          <div style={{ fontSize: 12, color: C.textDim }}>
            This takes a few seconds.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
