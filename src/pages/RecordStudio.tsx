import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useOrganizationList, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { Monitor, RefreshCw, MoreVertical } from 'lucide-react';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import { getMeetings, uploadMeeting, submitTranscript, getVoiceprintStatus, deleteMeeting as deleteMeetingApi, updateMeetingTeam, renameMeeting, reprocessMeeting, API_BASE_URL, type Meeting } from '../services/api';
import { C, useThemeMode } from '../theme';
import { CrystalStudioOrb } from '../components/orbs';
import { useProcessingJobs } from '../providers/ProcessingStatusProvider';
import { FEATURE_LABELS, DONUT_COLORS } from '../components/culture-health/constants';
import { MeetingDimensionWheel } from '../components/meetings/MeetingDimensionWheel';
import { useTabAudioCapture } from '../hooks/useTabAudioCapture';
import { SpeakerConfirmation } from '../components/SpeakerConfirmation';

// ─── Types ───
interface PastRecording {
  id: string;
  name: string;
  date: string;
  duration: string;
  space: string;
  spaceKey: string;
  status: 'transcribed' | 'analysed';
  processedStatus?: 'pending' | 'processing' | 'complete' | 'failed';
  orgId?: string;
}

interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  meetingId?: number;
  error?: string;
}

// ─── Team Colors (8 distinct colors for team pill badges) ───
const TEAM_COLORS = [
  { bg: 'rgba(20,180,120,0.12)', text: '#14b478', border: 'rgba(20,180,120,0.25)' },
  { bg: 'rgba(80,160,220,0.12)', text: '#50a0dc', border: 'rgba(80,160,220,0.25)' },
  { bg: 'rgba(180,100,220,0.12)', text: '#b464dc', border: 'rgba(180,100,220,0.25)' },
  { bg: 'rgba(232,145,58,0.12)', text: '#e8913a', border: 'rgba(232,145,58,0.25)' },
  { bg: 'rgba(220,80,80,0.12)', text: '#dc5050', border: 'rgba(220,80,80,0.25)' },
  { bg: 'rgba(100,200,180,0.12)', text: '#64c8b4', border: 'rgba(100,200,180,0.25)' },
  { bg: 'rgba(200,160,80,0.12)', text: '#c8a050', border: 'rgba(200,160,80,0.25)' },
  { bg: 'rgba(160,120,200,0.12)', text: '#a078c8', border: 'rgba(160,120,200,0.25)' },
];

// Deterministic color by hashing org ID characters
const getTeamColor = (orgId: string) => {
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    hash = ((hash << 5) - hash) + orgId.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
};

// ─── Space Colors (fallback for source_platform) ───
const SPACE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sales: { bg: "rgba(20, 180, 120, 0.08)", border: "rgba(20, 180, 120, 0.2)", text: "hsl(20, 75%, 68%)" },
  product: { bg: "rgba(80, 160, 220, 0.08)", border: "rgba(80, 160, 220, 0.2)", text: "hsl(210, 65%, 68%)" },
  creative: { bg: "rgba(180, 100, 220, 0.08)", border: "rgba(180, 100, 220, 0.2)", text: "hsl(270, 55%, 70%)" },
  company: { bg: "rgba(192, 230, 137, 0.06)", border: "rgba(192, 230, 137, 0.15)", text: C.teal },
};

// ─── Mic Icon ───
const MicIcon = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// ─── Processing Status Styles ───
const STATUS_STYLES: Record<string, { bg: string; color: string; label: string; pulse?: boolean }> = {
  pending: { bg: 'rgba(156,163,175,0.15)', color: 'rgb(156,163,175)', label: 'Pending' },
  processing: { bg: 'rgba(245,158,11,0.15)', color: 'rgb(245,158,11)', label: 'Processing', pulse: true },
  complete: { bg: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)', label: 'Complete' },
  failed: { bg: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)', label: 'Failed' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 600, color: style.color,
      padding: '3px 10px', borderRadius: 6,
      background: style.bg,
      animation: style.pulse ? 'statusPulse 2s ease-in-out infinite' : undefined,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: style.color, flexShrink: 0,
      }} />
      {style.label}
    </span>
  );
};

// ─── Meeting Detail Types ───
interface SpeakerTurn {
  id: string;
  speaker_label: string;
  speaker_name: string | null;
  is_matched: boolean;
  start_time: number;
  end_time: number;
  text: string;
}

interface Classification {
  id: string;
  speaker_turn_id: string;
  dimension: string;
  label: string;
  evidence: string;
  confidence: string;
}

interface DimensionWeight {
  dimension: string;
  weight: number;
}

interface MeetingTeamScore {
  collective_score: number | null;
  qualitative_observations: string | null;
  dimension_weights: DimensionWeight[];
}

// ─── Dimension Mapping ───
const DIMENSION_MAP: Record<string, { short: string; color: string }> = {};
['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((dim, i) => {
  DIMENSION_MAP[dim] = { short: FEATURE_LABELS[i].short, color: DONUT_COLORS[i] };
});

const speakerColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash % 360)}, 50%, 45%)`;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ─── Dimension Badge ───
const DimensionBadge = ({ classification, isExpanded, onToggle }: { classification: Classification; isExpanded: boolean; onToggle: () => void }) => {
  const dim = DIMENSION_MAP[classification.dimension];
  if (!dim) return null;
  const isNeg = classification.label.toLowerCase().includes('negative');
  const isNeutral = classification.label === 'Neutral';
  const arrow = isNeutral ? '' : isNeg ? ' \u2193' : ' \u2191';
  return (
    <div>
      <button onClick={onToggle} style={{
        display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6,
        background: `${dim.color}20`, color: dim.color, fontSize: 11, fontWeight: 600,
        fontFamily: "'Tomorrow', sans-serif", cursor: 'pointer', border: 'none',
      }}>
        {dim.short}{arrow}
      </button>
      {isExpanded && (
        <div style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic', lineHeight: 1.55, paddingLeft: 8, marginTop: 4, fontFamily: "'Tomorrow', sans-serif" }}>
          {classification.evidence}
        </div>
      )}
    </div>
  );
};

// ─── Transcript Bubble ───
const TranscriptBubble = ({ turn, classifications, currentUserName }: { turn: SpeakerTurn; classifications: Classification[]; currentUserName?: string }) => {
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
  const rawName = turn.speaker_name || turn.speaker_label;
  const displayName = rawName.startsWith('user_') && currentUserName ? currentUserName : rawName;
  const avatarClr = speakerColor(displayName);
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarClr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Tomorrow', sans-serif" }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        {turn.is_matched && (
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: C.teal, border: `2px solid ${C.bg}` }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: C.card, borderRadius: '16px 16px 16px 4px', border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: C.teal, fontFamily: "'Tomorrow', sans-serif" }}>
              {displayName}
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'Tomorrow', sans-serif", flexShrink: 0, marginLeft: 12 }}>
              {formatTime(turn.start_time)}
            </span>
          </div>
          <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.75, margin: 0, fontFamily: "'Tomorrow', sans-serif" }}>
            {turn.text}
          </p>
          {classifications.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {classifications.map(c => (
                <DimensionBadge key={c.id} classification={c} isExpanded={expandedBadge === c.id} onToggle={() => setExpandedBadge(prev => prev === c.id ? null : c.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Map API Meeting to PastRecording ───
const mapMeeting = (m: Meeting): PastRecording => ({
  id: String(m.meeting_id),
  name: m.title || 'Untitled',
  date: new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  duration: '\u2014',
  space: m.source_platform || 'Upload',
  spaceKey: (m.source_platform || 'company').toLowerCase(),
  status: m.processed_status === 'completed' ? 'analysed' as const : 'transcribed' as const,
  processedStatus: m.processed_status === 'completed' ? 'complete'
    : m.processed_status === 'failed' ? 'failed'
    : m.processed_status === 'processing' ? 'processing'
    : 'pending',
  orgId: m.org_id,
});

// ─── Studio Reprocess Controls ───
const StudioReprocessControls = ({ meetingId, onReprocess }: { meetingId: number; onReprocess: (id: number, scope: 'rescore' | 'full') => Promise<void> }) => {
  useThemeMode();
  const [rsState, setRsState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [fullConfirm, setFullConfirm] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowFullMenu(false);
        setFullConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
      <button
        onClick={() => {
          if (rsState === 'idle') {
            setRsState('confirming');
            confirmTimer.current = setTimeout(() => setRsState('idle'), 3000);
          } else if (rsState === 'confirming') {
            if (confirmTimer.current) clearTimeout(confirmTimer.current);
            setRsState('loading');
            onReprocess(meetingId, 'rescore').finally(() => setRsState('idle'));
          }
        }}
        disabled={rsState === 'loading'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
          padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: rsState === 'confirming' ? (C.amber || 'rgb(212,163,74)') : C.teal,
          color: '#fff', opacity: rsState === 'loading' ? 0.6 : 1,
        }}
      >
        {rsState === 'loading' ? 'Reprocessing...' : rsState === 'confirming' ? 'Confirm Re-score?' : <><RefreshCw size={14} /> Re-score</>}
      </button>
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowFullMenu(!showFullMenu)}
          aria-label="More actions"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'transparent', color: C.textDim,
          }}
        >
          <MoreVertical size={16} />
        </button>
        {showFullMenu && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 50,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 4, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            {!fullConfirm ? (
              <button
                onClick={() => setFullConfirm(true)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: 'transparent', color: C.text,
                }}
              >
                Full Reprocess
              </button>
            ) : (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>
                  This will reprocess the entire meeting from scratch.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setShowFullMenu(false);
                      setFullConfirm(false);
                      onReprocess(meetingId, 'full');
                    }}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 4, border: 'none',
                      cursor: 'pointer', background: C.red || 'rgb(239,68,68)', color: '#fff',
                    }}
                  >
                    Yes, reprocess
                  </button>
                  <button
                    onClick={() => { setFullConfirm(false); setShowFullMenu(false); }}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 4, border: 'none',
                      cursor: 'pointer', background: 'transparent', color: C.textDim,
                    }}
                  >
                    Keep Meeting
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── RecordStudio Component ───
export default function RecordStudio() {
  const { mode: themeMode } = useThemeMode(); // subscribe to theme changes so C.* inline styles re-render
  const { meetingId } = useParams<{ meetingId?: string }>();
  const [searchParams] = useSearchParams();
  const meetingIdFromQuery = searchParams.get('meeting_id');
  const effectiveMeetingId = meetingIdFromQuery || meetingId;
  const navigate = useNavigate();
  const { getApiToken, organization } = useSophiaAuth();
  const { user: clerkUser } = useUser();
  const currentUserName = clerkUser ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined : undefined;
  const { jobs, startPolling } = useProcessingJobs();
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });

  // Build org name lookup from Clerk memberships
  const orgNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    userMemberships?.data?.forEach(mem => {
      map[mem.organization.id] = mem.organization.name;
    });
    return map;
  }, [userMemberships?.data]);

  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [recState, setRecState] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [recTimer, setRecTimer] = useState(0);
  const [recBars, setRecBars] = useState(Array(50).fill(0.1));
  const [recordMode, setRecordMode] = useState<'mic' | 'meeting'>('mic');
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const autoClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allTerminal = (q: FileQueueItem[]) => q.length > 0 && q.every(i => i.status === 'done' || i.status === 'failed');

  // Auto-clear queue 5s after all items reach terminal state (sole timer source)
  useEffect(() => {
    if (allTerminal(queue)) {
      autoClearTimerRef.current = setTimeout(() => setQueue([]), 5000);
    } else {
      if (autoClearTimerRef.current) {
        clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = null;
      }
    }
    return () => {
      if (autoClearTimerRef.current) {
        clearTimeout(autoClearTimerRef.current);
        autoClearTimerRef.current = null;
      }
    };
  }, [queue]);

  const [pastRecordings, setPastRecordings] = useState<PastRecording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVpEnrolled, setIsVpEnrolled] = useState(true); // default true to hide banner while loading
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem('sophia-enrollment-banner-dismissed') === 'true';
    } catch { return false; }
  });
  const [entryMode, setEntryMode] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteState, setPasteState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [pasteDate, setPasteDate] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);

  // BUG-43: Cache last-known statuses to prevent flash on remount
  const statusCacheRef = useRef<Map<string, { status: string; processedStatus: string }>>(new Map());

  /** Merge incoming meetings with existing state, preserving completed/processing statuses.
   *  Uses statusCacheRef to survive component remounts (BUG-43). */
  const mergeMeetings = (prev: PastRecording[], incoming: PastRecording[]): PastRecording[] => {
    // Build lookup from both prev state AND the persistent cache
    const existingById = new Map(prev.map(r => [r.id, r]));

    const merged = incoming.map(m => {
      const existing = existingById.get(m.id);
      const cached = statusCacheRef.current.get(m.id);

      // Don't downgrade completed/processing to pending
      if (existing && (existing.status === 'analysed' || existing.processedStatus === 'complete')
          && m.processedStatus !== 'complete' && m.processedStatus !== 'failed') {
        return existing;
      }

      // On remount (prev is empty), use cached status to prevent flash
      if (!existing && cached
          && (cached.status === 'analysed' || cached.processedStatus === 'complete')
          && m.processedStatus !== 'complete' && m.processedStatus !== 'failed') {
        return { ...m, status: cached.status as PastRecording['status'], processedStatus: cached.processedStatus as PastRecording['processedStatus'] };
      }

      return m;
    });

    // Also keep prev-only entries (actively processing, not yet in API response)
    prev.forEach(r => {
      if (!incoming.some(m => m.id === r.id)) {
        merged.push(r);
      }
    });

    // Update the persistent cache with latest known-good statuses
    merged.forEach(r => {
      statusCacheRef.current.set(r.id, { status: r.status, processedStatus: r.processedStatus || '' });
    });

    return merged;
  };

  // Meeting detail enrichment state
  const [speakerTurns, setSpeakerTurns] = useState<SpeakerTurn[]>([]);
  const [detailClassifications, setDetailClassifications] = useState<Classification[]>([]);
  const [detailTeamScore, setDetailTeamScore] = useState<MeetingTeamScore | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const refetchMeetingDetail = useCallback(() => setDetailRefreshKey(k => k + 1), []);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Available orgs for team selector
  const orgs = userMemberships?.data ?? [];
  const showTeamSelector = orgs.length >= 2;

  const studioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const getApiTokenRef = useRef(getApiToken);
  getApiTokenRef.current = getApiToken;

  // ─── Meeting Mode: Tab Audio Capture Hook ───
  const {
    startCapture: startMeetingCapture,
    stopCapture: stopMeetingCapture,
    isCapturing: isMeetingCapturing,
    isSupported: isMeetingModeSupported,
    error: meetingCaptureError,
  } = useTabAudioCapture({
    onComplete: async (blob) => {
      const file = new File([blob], `meeting-capture-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      setRecState("processing");
      try {
        const token = await getApiToken();
        if (token) {
          await uploadMeeting(file, `Meeting Capture ${new Date().toLocaleString()}`, token, selectedTeamId);
          await refreshMeetings(token);
          startPolling();
        }
        setRecState("done");
        setTimeout(() => setRecState("idle"), 3000);
      } catch (err) {
        console.error('Meeting capture upload failed:', err);
        setRecState("idle");
      }
    },
    onError: (errorMsg) => {
      toast.error(errorMsg);
      setRecState("idle");
    },
  });

  // Show toast on meetingCaptureError change
  useEffect(() => {
    if (meetingCaptureError) {
      toast.error(meetingCaptureError);
    }
  }, [meetingCaptureError]);

  // Sync hook's isCapturing with recState
  useEffect(() => {
    if (isMeetingCapturing) {
      setRecState("recording");
      setRecTimer(0);
    }
  }, [isMeetingCapturing]);

  // Fetch past recordings from API (user-scoped, works without org)
  useEffect(() => {
    let cancelled = false;
    setRecordingsLoading(true);
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const apiMeetings = await getMeetings(token);
        if (cancelled) return;
        setPastRecordings(prev => mergeMeetings(prev, apiMeetings.map(mapMeeting)));
      } catch (err) {
        console.error('Failed to fetch past meetings:', err);
      } finally {
        if (!cancelled) setRecordingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // Check voiceprint status for enrollment banner
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        const status = await getVoiceprintStatus(token);
        if (!cancelled) setIsVpEnrolled(status.enrolled === true);
      } catch {
        // Silently ignore -- banner is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // Warn user and auto-upload if they navigate away while recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') || isMeetingCapturing) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isMeetingCapturing]);

  // On unmount: stop recording and fire-and-forget upload so audio isn't lost
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        // Detach the existing onstop (uses setState which won't work after unmount)
        // and replace with a fire-and-forget upload
        recorder.onstop = async () => {
          recorder.stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
          try {
            const token = await getApiTokenRef.current();
            if (token) await uploadMeeting(file, `Recording ${new Date().toLocaleString()}`, token, selectedTeamId, selectedMeetingDate || null);
          } catch (err) {
            console.error('Background upload after nav-away failed:', err);
          }
        };
        recorder.stop();
      }
    };
  }, []);

  // Recording timer
  useEffect(() => {
    if (recState === "recording") {
      const iv = setInterval(() => {
        setRecTimer(t => t + 1);
        setRecBars(Array(50).fill(0).map(() => 0.12 + Math.random() * 0.78));
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [recState]);

  const refreshMeetings = async (token: string) => {
    try {
      const apiMeetings = await getMeetings(token);
      const newMapped = apiMeetings.map(mapMeeting);
      setPastRecordings(prev => mergeMeetings(prev, newMapped));
    } catch (err) {
      console.error('Failed to refresh meetings:', err);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const token = await getApiToken();
      if (!token) return;
      await deleteMeetingApi(Number(meetingId), token);
      setPastRecordings(prev => prev.filter(r => r.id !== meetingId));
      setConfirmDeleteId(null);
      toast.success('Meeting deleted');
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      toast.error('Failed to delete meeting');
    }
  };

  const toggleSelectMeeting = (id: string) => {
    setSelectedMeetings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const token = await getApiToken();
      if (!token) return;
      const ids = [...selectedMeetings];
      await Promise.all(ids.map(id => deleteMeetingApi(Number(id), token)));
      setPastRecordings(prev => prev.filter(r => !selectedMeetings.has(r.id)));
      setSelectedMeetings(new Set());
      setConfirmBulkDelete(false);
      toast.success(`${ids.length} meeting${ids.length > 1 ? 's' : ''} deleted`);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Failed to delete some meetings');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleAssignTeam = async (meetingId: string, orgId: string) => {
    try {
      const token = await getApiToken();
      if (!token) return;
      await updateMeetingTeam(Number(meetingId), orgId, token);
      setAssignTeamId(null);
      toast.success('Team assigned');
      await refreshMeetings(token);
    } catch (err) {
      console.error('Failed to assign team:', err);
      toast.error('Failed to assign team');
    }
  };

  const startRenaming = (rec: PastRecording) => {
    setRenamingId(rec.id);
    setRenameValue(rec.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const saveRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    try {
      const token = await getApiToken();
      if (!token) return;
      await renameMeeting(Number(renamingId), renameValue.trim(), token);
      setPastRecordings(prev => prev.map(r => r.id === renamingId ? { ...r, name: renameValue.trim() } : r));
      toast.success('Meeting renamed');
    } catch (err) {
      console.error('Failed to rename meeting:', err);
      toast.error('Failed to rename');
    } finally {
      setRenamingId(null);
    }
  };

  // Merge real-time status from polling with static status from API
  const getRecordingStatus = (rec: PastRecording): string => {
    const activeJob = jobs.find(j => String(j.meeting_id) === rec.id);
    if (activeJob) return activeJob.status;
    return rec.processedStatus || 'complete';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecState("processing");
        try {
          const token = await getApiToken();
          if (token) {
            await uploadMeeting(file, `Recording ${new Date().toLocaleString()}`, token, selectedTeamId);
            await refreshMeetings(token);
            startPolling();
          }
          setRecState("done");
          setTimeout(() => setRecState("idle"), 3000);
        } catch (err) {
          console.error('Upload recording failed:', err);
          setRecState("idle");
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
      setRecTimer(0);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadOneFile = async (item: FileQueueItem, token: string) => {
    setQueue(prev => prev.map(q =>
      q.id === item.id ? { ...q, status: 'uploading' as const } : q
    ));
    try {
      const result = await uploadMeeting(item.file, item.name.replace(/\.[^.]+$/, ''), token, selectedTeamId, selectedMeetingDate || null);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'done' as const, meetingId: (result as any).meeting_id ?? undefined } : q
      ));
    } catch (err) {
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'failed' as const, error: err instanceof Error ? err.message : String(err) } : q
      ));
    }
  };

  const handleBatchUpload = async (files: File[]) => {
    const token = await getApiToken();
    if (!token) return;

    // Cancel any pending auto-clear timer before starting a new batch
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }

    const items: FileQueueItem[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      status: 'pending' as const,
    }));
    setQueue(items);

    await Promise.allSettled(
      items.map(item => uploadOneFile(item, token))
    );

    await refreshMeetings(token);
    startPolling();
  };

  const retryFile = async (itemId: string) => {
    const item = queue.find(q => q.id === itemId);
    if (!item) return;
    const token = await getApiToken();
    if (!token) return;

    // Cancel any pending auto-clear timer (user is actively retrying)
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }

    await uploadOneFile(item, token);
    await refreshMeetings(token);
    startPolling();
  };

  const handleReprocess = async (meetingId: number, scope: 'rescore' | 'full' = 'rescore') => {
    try {
      const token = await getApiToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/v1/meetings/${meetingId}/reprocess`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Reprocess failed');
      }
      // Update local state to show processing
      setPastRecordings(prev =>
        prev.map(r => r.id === String(meetingId) ? { ...r, processedStatus: 'processing' as const } : r)
      );
      startPolling();
      setReprocessingId(null);
      toast.success(scope === 'full' ? 'Full reprocess started' : 'Re-scoring started');
    } catch (err: any) {
      console.error('Failed to reprocess meeting:', err);
      toast.error(err.message || 'Reprocess failed');
      setReprocessingId(null);
    }
  };

  const removeFromQueue = (itemId: string) => {
    setQueue(prev => prev.filter(q => q.id !== itemId));
  };

  const handlePasteSubmit = async () => {
    if (pasteText.trim().length < 10) return;
    setPasteState('submitting');
    try {
      const token = await getApiToken();
      if (token) {
        await submitTranscript(pasteText, pasteTitle || 'Manual Transcript', token, pasteDate || null);
        await refreshMeetings(token);
        startPolling();
      }
      setPasteState('done');
      setTimeout(() => {
        setPasteState('idle');
        setPasteText('');
        setPasteTitle('');
        setPasteDate('');
      }, 3000);
    } catch (err) {
      console.error('Paste transcript submit failed:', err);
      setPasteState('idle');
    }
  };

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const getSpaceColor = (key: string) => SPACE_COLORS[key] || SPACE_COLORS.company;

  // Filter recordings by search and team
  const filteredBySearch = searchQuery
    ? pastRecordings.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : pastRecordings;
  const filteredRecordings = teamFilter === 'all'
    ? filteredBySearch
    : filteredBySearch.filter(r => r.orgId === teamFilter);

  // Find selected meeting for detail view
  const detailMeeting = effectiveMeetingId ? pastRecordings.find(r => r.id === effectiveMeetingId) : null;

  // Auto-scroll to top when a meeting is selected
  useEffect(() => {
    if (effectiveMeetingId) {
      requestAnimationFrame(() => {
        // AppLayout uses <main overflow="auto"> as the scroll container, not window
        const main = document.querySelector('main');
        if (main) main.scrollTo({ top: 0 });
        else window.scrollTo({ top: 0 });
      });
    }
  }, [effectiveMeetingId]);

  // Fetch enriched meeting data when a meeting is selected
  useEffect(() => {
    if (!effectiveMeetingId) {
      setSpeakerTurns([]);
      setDetailClassifications([]);
      setDetailTeamScore(null);
      return;
    }
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const token = await getApiToken();
        const [turnsRes, classRes, scoreRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/v1/meetings/${effectiveMeetingId}/speaker-turns`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/v1/meetings/${effectiveMeetingId}/classifications`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/v1/meetings/${effectiveMeetingId}/team-score`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (turnsRes.status === 'fulfilled' && turnsRes.value.ok) setSpeakerTurns(await turnsRes.value.json());
        else setSpeakerTurns([]);
        if (classRes.status === 'fulfilled' && classRes.value.ok) setDetailClassifications(await classRes.value.json());
        else setDetailClassifications([]);
        if (scoreRes.status === 'fulfilled') {
          console.log('[team-score] status:', scoreRes.value.status);
          if (scoreRes.value.ok) {
            const d = await scoreRes.value.json();
            console.log('[team-score] data:', d);
            setDetailTeamScore(d || null);
          } else {
            const errText = await scoreRes.value.text().catch(() => '');
            console.error('[team-score] error response:', scoreRes.value.status, errText);
            setDetailTeamScore(null);
          }
        } else {
          console.error('[team-score] fetch rejected:', (scoreRes as PromiseRejectedResult).reason);
          setDetailTeamScore(null);
        }
      } catch (err) {
        console.error('Failed to fetch meeting detail:', err);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [effectiveMeetingId, detailRefreshKey]);

  // Build classification lookup by speaker turn
  const classificationsByTurn = useMemo(() => {
    const map: Record<string, Classification[]> = {};
    detailClassifications.forEach(c => {
      if (!map[c.speaker_turn_id]) map[c.speaker_turn_id] = [];
      map[c.speaker_turn_id].push(c);
    });
    return map;
  }, [detailClassifications]);

  // Document upload detection
  const isDocumentUpload = useMemo(() => {
    if (speakerTurns.length === 0) return false;
    if (speakerTurns.every(t => t.speaker_label === 'Team')) return true;
    const allUnmatched = speakerTurns.every(t => !t.is_matched);
    const startsAtZero = speakerTurns[0]?.start_time === 0;
    const uniqueLabels = new Set(speakerTurns.map(t => t.speaker_label));
    return allUnmatched && startsAtZero && uniqueLabels.size === 1;
  }, [speakerTurns]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px", width: "100%", flex: 1 }}>

      {/* Voiceprint enrollment banner -- persistent dismiss via localStorage */}
      {!isVpEnrolled && !bannerDismissed && (
        <div style={{
          padding: '12px 16px',
          background: C.tealGlow,
          border: `1px solid ${C.tealBorder}`,
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
        }}>
          <MicIcon size={16} color={C.teal} />
          <span style={{ fontSize: 12, color: C.text, flex: 1, fontFamily: "'Tomorrow', sans-serif" }}>
            Activate VoicePrint for speaker identification
          </span>
          <Link
            to="/profile#voiceprint"
            style={{ fontSize: 12, color: C.teal, textDecoration: 'none', fontFamily: "'Tomorrow', sans-serif", flexShrink: 0 }}
          >
            Set up
          </Link>
          <button
            onClick={() => {
              setBannerDismissed(true);
              try { localStorage.setItem('sophia-enrollment-banner-dismissed', 'true'); } catch {}
            }}
            aria-label="Dismiss enrollment banner"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              position: 'absolute',
              top: 4,
              right: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Meeting Detail (when URL has :meetingId or ?meeting_id query param) */}
      {effectiveMeetingId && (
        <div style={{
          background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          borderRadius: 18, padding: "24px", marginBottom: 24,
          border: `1px solid ${C.border}`,
          marginLeft: -150, marginRight: -150,
        }}>
          <button onClick={() => navigate('/studio')} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            color: C.teal, fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: "'Tomorrow', sans-serif", marginBottom: 16,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Studio
          </button>
          {detailMeeting ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                {renamingId === detailMeeting.id ? (
                  <>
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      style={{
                        background: C.bg, color: C.text, border: `1px solid ${C.teal}`,
                        borderRadius: 8, padding: '4px 12px', fontSize: 'inherit',
                        fontFamily: 'inherit', fontWeight: 'inherit', outline: 'none',
                        flex: 1, maxWidth: 400,
                      }}
                    />
                    <button onClick={saveRename} style={{ color: C.teal, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                    <button onClick={() => setRenamingId(null)} style={{ color: C.textDim, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </>
                ) : (
                  <span onClick={() => startRenaming(detailMeeting)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} title="Click to rename">
                    {detailMeeting.name}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: C.textDim }}>{detailMeeting.date}</div>
                <div style={{ fontSize: 13, color: C.textDim }}>{detailMeeting.duration}</div>
                <div style={{
                  fontSize: 10, color: getSpaceColor(detailMeeting.spaceKey).text,
                  padding: "3px 10px", borderRadius: 6,
                  background: getSpaceColor(detailMeeting.spaceKey).bg,
                  border: `1px solid ${getSpaceColor(detailMeeting.spaceKey).border}`,
                }}>{detailMeeting.space}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                {detailMeeting.status === "analysed" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.tealBorder}`, borderTopColor: C.teal }} />
                )}
                <span style={{ fontSize: 12, color: detailMeeting.status === "analysed" ? C.teal : C.textDim, fontWeight: 500, textTransform: "capitalize" }}>
                  {detailMeeting.status}
                </span>
                {detailMeeting.status === 'analysed' && (
                  <StudioReprocessControls meetingId={Number(detailMeeting.id)} onReprocess={handleReprocess} />
                )}
              </div>

              {/* ─── Speaker Confirmation Banner ─── */}
              {detailMeeting.processedStatus === 'complete' && (
                <SpeakerConfirmation
                  meetingId={Number(detailMeeting.id)}
                  onSpeakersUpdated={refetchMeetingDetail}
                />
              )}

              {/* ─── Transcript + Dimension Analysis ─── */}
              {detailLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 12, fontFamily: "'Tomorrow', sans-serif" }}>
                  Loading transcript...
                </div>
              ) : speakerTurns.length > 0 ? (
                <div style={{ display: 'flex', gap: 24, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {/* Transcript column */}
                  <div style={{ flex: 1, minWidth: 0, maxHeight: 500, overflowY: 'auto' }}>
                    {isDocumentUpload ? (
                      speakerTurns.map(turn => (
                        <div key={turn.id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.75, margin: 0, fontFamily: "'Tomorrow', sans-serif" }}>
                            {turn.text}
                          </p>
                          {classificationsByTurn[turn.id]?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {classificationsByTurn[turn.id].map(c => (
                                <DimensionBadge key={c.id} classification={c} isExpanded={false} onToggle={() => {}} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      speakerTurns.map(turn => (
                        <TranscriptBubble key={turn.id} turn={turn} classifications={classificationsByTurn[turn.id] || []} currentUserName={currentUserName} />
                      ))
                    )}
                  </div>

                  {/* Dimension analysis column */}
                  {detailTeamScore && (detailTeamScore.dimension_weights?.length > 0 || detailTeamScore.qualitative_observations) && (
                    <div style={{
                      width: 280, flexShrink: 0,
                      borderLeft: `1px solid ${C.border}`,
                      paddingLeft: 16, paddingTop: 8,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                    }}>
                      {detailTeamScore.dimension_weights?.length > 0 && (
                        <MeetingDimensionWheel weights={detailTeamScore.dimension_weights} orbSize={65} />
                      )}
                      {detailTeamScore.qualitative_observations && (
                        <div style={{
                          fontSize: 12, color: C.teal, fontStyle: 'italic',
                          lineHeight: 1.6, fontFamily: "'Tomorrow', sans-serif",
                          padding: '12px 16px', borderRadius: 12,
                          background: `${C.teal}08`,
                          borderLeft: `3px solid ${C.teal}`,
                        }}>
                          {detailTeamScore.qualitative_observations}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : detailMeeting.status === 'analysed' ? (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, color: C.textDim, fontSize: 12, fontStyle: 'italic', fontFamily: "'Tomorrow', sans-serif" }}>
                  No transcript data available for this meeting.
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ fontSize: 14, color: C.textDim }}>Meeting not found</div>
          )}
        </div>
      )}

      {/* Meeting Context Indicator */}
      {effectiveMeetingId && !detailMeeting && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 10, marginBottom: 16,
          background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
        }}>
          <MicIcon size={14} color={C.teal} />
          <span style={{ fontSize: 12, color: C.teal, fontWeight: 500 }}>
            Recording for meeting {effectiveMeetingId}
          </span>
        </div>
      )}

      {/* Record + Upload Action Cards */}
      <div className="studio-action-cards" style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {/* Record Now Card */}
        <div style={{
          flex: 1, background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          borderRadius: 18, padding: "28px 24px",
          border: `1px solid ${recState === "recording" ? "rgba(212,90,90,0.2)" : "rgba(192,230,137,0.08)"}`,
          transition: "all 0.3s",
        }}>
          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: C.hoverBg, marginBottom: 16 }}>
            {(['mic', 'meeting'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => tab === 'meeting' && !isMeetingModeSupported ? undefined : setRecordMode(tab)}
                disabled={recState === 'recording' || recState === 'processing' || (tab === 'meeting' && !isMeetingModeSupported)}
                title={tab === 'meeting' && !isMeetingModeSupported ? 'Tab audio capture requires Chrome or Edge' : undefined}
                style={{
                  flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',
                  cursor: (recState === 'recording' || recState === 'processing' || (tab === 'meeting' && !isMeetingModeSupported)) ? 'not-allowed' : 'pointer',
                  background: recordMode === tab ? C.card : 'transparent',
                  color: recordMode === tab ? C.text : C.textDim,
                  opacity: tab === 'meeting' && !isMeetingModeSupported ? 0.4 : 1,
                  fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  transition: 'all 0.2s',
                }}
              >
                {tab === 'mic' ? 'Mic' : 'Meeting'}
              </button>
            ))}
          </div>

          {recState === "idle" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ margin: "0 auto 16px", width: 80, height: 80 }}>
                <CrystalStudioOrb size={80} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 6 }}>
                {recordMode === 'meeting' ? 'Capture Meeting Audio' : 'Record Meeting'}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: showTeamSelector ? 12 : 20 }}>
                {recordMode === 'meeting'
                  ? 'Record all participants from a browser tab (Zoom, Meet, Teams)'
                  : 'Capture a live meeting. SOPHIA will transcribe and analyse the conversation.'}
              </div>
              {/* Team dropdown (when user has 2+ orgs) */}
              {showTeamSelector && (
                <div style={{ marginBottom: 16 }}>
                  <select
                    value={selectedTeamId || ''}
                    onChange={e => setSelectedTeamId(e.target.value || null)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      background: C.card, border: `1px solid ${C.border}`,
                      color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                      outline: 'none', cursor: 'pointer', textAlign: 'left',
                      appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      paddingRight: 30,
                    }}
                  >
                    <option value="">{organization?.name || 'Select team'}</option>
                    {orgs.filter(mem => mem.organization.id !== organization?.id).map(mem => (
                      <option key={mem.organization.id} value={mem.organization.id}>
                        {mem.organization.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={recordMode === 'meeting' ? async () => { await startMeetingCapture(); } : startRecording} style={{
                width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                color: C.teal, fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {recordMode === 'meeting' ? <Monitor size={15} color={C.teal} /> : <MicIcon size={15} color={C.teal} />}
                Start Recording
              </button>
            </div>
          )}

          {recState === "recording" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: "rgba(212,90,90,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 30px rgba(212,90,90,0.15)",
              }}>
                {recordMode === 'meeting' ? <Monitor size={28} color={C.red} /> : <MicIcon size={28} color={C.red} />}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.text, fontFamily: "'Josefin Sans', sans-serif", marginBottom: 4 }}>{formatTimer(recTimer)}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.red, animation: "pulse 1.4s ease infinite", boxShadow: `0 0 8px ${C.red}` }} />
                <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>Recording</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: 44, marginBottom: 20 }}>
                {recBars.map((a, i) => (
                  <div key={i} style={{
                    width: 3, height: `${a * 40}px`, borderRadius: 2,
                    background: C.red, transition: "height 0.12s ease", opacity: 0.4 + a * 0.6,
                  }} />
                ))}
              </div>
              <button onClick={recordMode === 'meeting' ? stopMeetingCapture : stopRecording} style={{
                width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                background: "rgba(212,90,90,0.12)", border: "1px solid rgba(212,90,90,0.25)",
                color: C.red, fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
              }}>Stop Recording</button>
            </div>
          )}

          {recState === "processing" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
                border: `3px solid ${C.tealBorder}`, borderTopColor: C.teal, animation: "spin 0.9s linear infinite",
              }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>Processing transcript...</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Extracting meeting insights</div>
            </div>
          )}

          {recState === "done" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                background: C.tealGlow, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.teal, marginBottom: 4 }}>Transcript saved</div>
              <div style={{ fontSize: 12, color: C.textDim }}>SOPHIA will analyse this meeting</div>
            </div>
          )}
        </div>

        {/* Upload / Paste Transcript Card */}
        <div style={{
          flex: 1, background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          borderRadius: 18, padding: "28px 24px",
          border: `1px solid ${(queue.length > 0 && allTerminal(queue) && queue.every(q => q.status === 'done')) || pasteState === "done" ? C.tealBorder : C.border}`,
          transition: "all 0.3s",
        }}>
          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: C.hoverBg, marginBottom: 16 }}>
            {(['upload', 'paste'] as const).map(tab => (
              <button key={tab} onClick={() => setEntryMode(tab)} style={{
                flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: entryMode === tab ? C.card : 'transparent',
                color: entryMode === tab ? C.text : C.textDim,
                fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                transition: 'all 0.2s',
              }}>
                {tab === 'upload' ? 'Upload File' : 'Paste Transcript'}
              </button>
            ))}
          </div>

          {/* Upload Tab */}
          {entryMode === 'upload' && (
            <>
              {/* Hidden file input -- always in DOM so ref works for both empty and queue states */}
              <input
                ref={studioFileInputRef}
                type="file"
                multiple
                accept=".mp3,.mp4,.wav,.webm,.txt,.vtt,.pdf,.doc,.docx,.csv"
                style={{ display: 'none' }}
                onChange={e => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    // Snapshot into a plain array before clearing the input.
                    // FileList is a live reference -- e.target.value = '' empties it,
                    // which would race with the async handleBatchUpload.
                    const snapshot = Array.from(files);
                    e.target.value = '';
                    handleBatchUpload(snapshot);
                  } else {
                    e.target.value = '';
                  }
                }}
              />

              {queue.length === 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                    background: C.hoverBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `2px dashed ${C.border}`,
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 6 }}>Upload Files</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: showTeamSelector ? 12 : 20 }}>
                    Upload meeting recordings or transcript files for SOPHIA to analyse.
                  </div>
                  {showTeamSelector && (
                    <div style={{ marginBottom: 16 }}>
                      <select
                        value={selectedTeamId || ''}
                        onChange={e => setSelectedTeamId(e.target.value || null)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          background: C.card, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                          outline: 'none', cursor: 'pointer', textAlign: 'left',
                          appearance: 'none', WebkitAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                          paddingRight: 30,
                        }}
                      >
                        <option value="">{organization?.name || 'Select team'}</option>
                        {orgs.filter(mem => mem.organization.id !== organization?.id).map(mem => (
                          <option key={mem.organization.id} value={mem.organization.id}>
                            {mem.organization.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Meeting date picker */}
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="datetime-local"
                      value={selectedMeetingDate}
                      onChange={e => setSelectedMeetingDate(e.target.value)}
                      placeholder="Meeting date (optional)"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        background: C.card, border: `1px solid ${C.border}`,
                        color: selectedMeetingDate ? C.text : C.textDim, fontSize: 12,
                        fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
                      When did this meeting happen? (defaults to now)
                    </div>
                  </div>
                  <button onClick={() => studioFileInputRef.current?.click()} style={{
                    width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                    background: C.hoverBg, border: `1px solid ${C.border}`,
                    color: C.textDim, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Choose Files
                  </button>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 10 }}>Supports .mp3, .mp4, .wav, .webm, .txt, .vtt, .pdf, .doc, .csv</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 6, opacity: 0.7 }}>Raw audio is automatically deleted 24 hours after processing for privacy</div>
                </div>
              )}

              {queue.length > 0 && (
                <div>
                  {/* Queue header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Josefin Sans', sans-serif", color: C.text }}>
                      Upload Queue
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim }}>
                      {queue.filter(q => q.status === 'done').length}/{queue.length} complete
                    </div>
                  </div>

                  {/* Queue rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {queue.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: C.hoverBg, border: `1px solid ${C.border}`,
                      }}>
                        {/* Status icon */}
                        <div style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.status === 'pending' && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(156,163,175)' }} />
                          )}
                          {item.status === 'uploading' && (
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              border: `2px solid ${C.tealBorder}`, borderTopColor: C.teal,
                              animation: 'spin 0.9s linear infinite',
                            }} />
                          )}
                          {item.status === 'done' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(34,197,94)" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {item.status === 'failed' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                        </div>

                        {/* Filename */}
                        <div style={{
                          flex: 1, minWidth: 0, fontSize: 12, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: "'Tomorrow', sans-serif",
                        }}>
                          {item.name}
                        </div>

                        {/* Action buttons */}
                        {item.status === 'pending' && (
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            title="Remove"
                            style={{
                              width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                              background: 'transparent', border: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: C.textDim, flexShrink: 0,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryFile(item.id)}
                            style={{
                              fontSize: 10, fontWeight: 600, color: 'rgb(239,68,68)',
                              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                              fontFamily: "'Tomorrow', sans-serif", whiteSpace: 'nowrap', flexShrink: 0,
                            }}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary when all done */}
                  {allTerminal(queue) && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px', borderRadius: 10,
                      background: queue.every(q => q.status === 'done') ? C.tealGlow : 'rgba(245,158,11,0.08)',
                      border: `1px solid ${queue.every(q => q.status === 'done') ? C.tealBorder : 'rgba(245,158,11,0.2)'}`,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        color: queue.every(q => q.status === 'done') ? C.teal : 'rgb(245,158,11)',
                      }}>
                        {queue.filter(q => q.status === 'done').length} of {queue.length} files uploaded
                        {queue.some(q => q.status === 'failed') && ' -- click Retry on failed files'}
                      </div>
                    </div>
                  )}

                  {/* Add more files button when queue is visible */}
                  <button
                    onClick={() => studioFileInputRef.current?.click()}
                    style={{
                      width: '100%', marginTop: 10, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                      background: 'transparent', border: `1px dashed ${C.border}`,
                      color: C.textDim, fontSize: 11, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add More Files
                  </button>
                </div>
              )}
            </>
          )}

          {/* Paste Tab */}
          {entryMode === 'paste' && (
            <>
              {pasteState === 'idle' && (
                <div>
                  <input
                    type="text"
                    placeholder="Meeting title (optional)"
                    value={pasteTitle}
                    onChange={e => setPasteTitle(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      background: C.hoverBg, border: `1px solid ${C.border}`, color: C.text,
                      fontSize: 13, fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                      marginBottom: 12, boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="date"
                    value={pasteDate}
                    onChange={e => setPasteDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      background: C.hoverBg, border: `1px solid ${C.border}`, color: C.text,
                      fontSize: 13, fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                      marginBottom: 12, boxSizing: 'border-box',
                      colorScheme: themeMode === 'dark' ? 'dark' : 'light',
                    }}
                  />
                  <textarea
                    placeholder={"Paste your meeting transcript here...\n\nSupported formats:\n  Speaker A: Hello team...\n  John: Thanks for joining...\n\nOr just paste plain text for team-level analysis."}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    style={{
                      width: '100%', minHeight: 200, padding: '12px 14px', borderRadius: 10,
                      background: C.hoverBg, border: `1px solid ${C.border}`, color: C.text,
                      fontSize: 13, fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                      resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 6, marginBottom: showTeamSelector ? 8 : 14 }}>
                    {pasteText.length.toLocaleString()} characters
                  </div>
                  {showTeamSelector && (
                    <div style={{ marginBottom: 14 }}>
                      <select
                        value={selectedTeamId || ''}
                        onChange={e => setSelectedTeamId(e.target.value || null)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          background: C.card, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                          outline: 'none', cursor: 'pointer', textAlign: 'left',
                          appearance: 'none', WebkitAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                          paddingRight: 30,
                        }}
                      >
                        <option value="">{organization?.name || 'Select team'}</option>
                        {orgs.filter(mem => mem.organization.id !== organization?.id).map(mem => (
                          <option key={mem.organization.id} value={mem.organization.id}>
                            {mem.organization.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={handlePasteSubmit}
                    disabled={pasteText.trim().length < 10}
                    style={{
                      width: '100%', padding: '13px 24px', borderRadius: 10,
                      cursor: pasteText.trim().length < 10 ? 'not-allowed' : 'pointer',
                      background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                      color: C.teal, fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                      opacity: pasteText.trim().length < 10 ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    Analyse Transcript
                  </button>
                </div>
              )}

              {pasteState === 'submitting' && (
                <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
                    border: `3px solid ${C.tealBorder}`, borderTopColor: C.teal, animation: "spin 0.9s linear infinite",
                  }} />
                  <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>Submitting transcript...</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>Preparing for analysis</div>
                </div>
              )}

              {pasteState === 'done' && (
                <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                    background: C.tealGlow, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: C.teal, marginBottom: 4 }}>Transcript submitted</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>SOPHIA will analyse this meeting</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Past Recordings Header + Team Filter + Search */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>
          Recent Recordings
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Team filter dropdown */}
          {Object.keys(orgNameMap).length > 0 && (
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{
                background: C.card, color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '6px 12px', fontSize: 12,
                fontFamily: "'Tomorrow', sans-serif", outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">All teams</option>
              {Object.entries(orgNameMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          {/* Search input */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: C.hoverBg, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "6px 12px 6px 30px", color: C.text, fontSize: 12,
                fontFamily: "'Tomorrow', sans-serif", outline: "none", width: 180,
              }}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bulk delete action bar */}
      {selectedMeetings.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(212,90,90,0.08)', border: '1px solid rgba(212,90,90,0.2)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
              {selectedMeetings.size} selected
            </span>
            <button
              onClick={() => setSelectedMeetings(new Set())}
              style={{
                fontSize: 11, color: C.textDim, background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif", textDecoration: 'underline',
              }}
            >
              Clear
            </button>
          </div>
          {confirmBulkDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: bulkDeleting ? 'wait' : 'pointer',
                  background: 'rgba(212,90,90,0.15)', border: '1px solid rgba(212,90,90,0.3)',
                  color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  opacity: bulkDeleting ? 0.6 : 1,
                }}
              >
                {bulkDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setConfirmBulkDelete(false)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmBulkDelete(true)}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(212,90,90,0.15)', border: '1px solid rgba(212,90,90,0.3)',
                color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              Delete Selected
            </button>
          )}
        </div>
      )}

      {/* Past Recordings List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Skeleton loading */}
        {recordingsLoading && pastRecordings.length === 0 && (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 16,
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)",
                borderRadius: 12, padding: "14px 20px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: C.hoverBg, animation: 'shimmer 1.5s ease-in-out infinite',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ width: '60%', height: 14, borderRadius: 6, background: C.hoverBg, marginBottom: 6, animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  <div style={{ width: '35%', height: 10, borderRadius: 5, background: C.hoverBg, animation: 'shimmer 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ width: 60, height: 20, borderRadius: 6, background: C.hoverBg, flexShrink: 0, animation: 'shimmer 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </>
        )}

        {!recordingsLoading && filteredRecordings.map(r => {
          const sc = getSpaceColor(r.spaceKey);
          return (
            <div key={r.id} style={{ position: 'relative' }}>
              <div onClick={() => navigate(`/studio/${r.id}`)} style={{
                display: "flex", alignItems: "center", gap: 16,
                background: selectedMeetings.has(r.id) ? `${C.teal}10` : C.card, backdropFilter: "blur(20px) saturate(1.2)",
                borderRadius: 12, padding: "14px 20px",
                border: `1px solid ${selectedMeetings.has(r.id) ? C.tealBorder : effectiveMeetingId === r.id ? C.tealBorder : 'rgba(255,255,255,0.04)'}`,
                transition: "all 0.2s", cursor: "pointer",
              }}>
                {/* Select checkbox */}
                <div
                  onClick={(e) => { e.stopPropagation(); toggleSelectMeeting(r.id); }}
                  style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${selectedMeetings.has(r.id) ? C.teal : C.border}`,
                    background: selectedMeetings.has(r.id) ? C.teal : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {selectedMeetings.has(r.id) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                {/* Mic / Transcript icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: sc.bg, border: `1px solid ${sc.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <MicIcon size={16} color={sc.text} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{r.date} · {r.duration}</div>
                  {/* Team pill badge — below title for visibility */}
                  {r.orgId && orgNameMap[r.orgId] ? (() => {
                    const tc = getTeamColor(r.orgId!);
                    return (
                      <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: 12,
                        fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                        fontFamily: "'Tomorrow', sans-serif",
                        background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                      }}>
                        {orgNameMap[r.orgId!]}
                      </span>
                    );
                  })() : (
                    <span style={{
                      display: 'inline-block', fontSize: 11, color: sc.text,
                      padding: "3px 10px", borderRadius: 6,
                      background: sc.bg, border: `1px solid ${sc.border}`,
                    }}>{r.space}</span>
                  )}
                </div>
                {/* Status Badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <StatusBadge status={getRecordingStatus(r)} />
                  {getRecordingStatus(r) === 'failed' && (
                    reprocessingId === Number(r.id) ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleReprocess(Number(r.id))}
                          style={{
                            fontSize: 10, fontWeight: 600, color: 'rgb(239,68,68)',
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                            fontFamily: "'Tomorrow', sans-serif", whiteSpace: 'nowrap',
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setReprocessingId(null)}
                          style={{
                            fontSize: 10, fontWeight: 600, color: C.textDim,
                            background: 'transparent', border: '1px solid ' + C.border,
                            borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                            fontFamily: "'Tomorrow', sans-serif", whiteSpace: 'nowrap',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReprocessingId(Number(r.id)); }}
                        style={{
                          fontSize: 10, fontWeight: 600, color: 'rgb(239,68,68)',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                          fontFamily: "'Tomorrow', sans-serif", whiteSpace: 'nowrap',
                        }}
                      >
                        Retry
                      </button>
                    )
                  )}
                </div>
                {/* Assign team button (when user has 2+ orgs) */}
                {showTeamSelector && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAssignTeamId(assignTeamId === r.id ? null : r.id); }}
                    title="Assign team"
                    style={{
                      width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', flexShrink: 0, opacity: 0.4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${C.teal}15`; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  </button>
                )}
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
                  title="Delete meeting"
                  style={{
                    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0, opacity: 0.4,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(212,90,90,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>

              {/* Assign team popup */}
              {assignTeamId === r.id && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 20,
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '16px', marginTop: 4,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  minWidth: 220,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Assign to team</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {orgs.map(mem => (
                      <button
                        key={mem.organization.id}
                        onClick={(e) => { e.stopPropagation(); handleAssignTeam(r.id, mem.organization.id); }}
                        style={{
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          background: C.hoverBg, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 12, fontWeight: 500,
                          fontFamily: "'Tomorrow', sans-serif", textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
                      >
                        {mem.organization.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete confirmation dialog */}
              {confirmDeleteId === r.id && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 20,
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '16px', marginTop: 4,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  minWidth: 280,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Delete this meeting?</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 14 }}>
                    All associated data will be permanently removed.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDeleteMeeting(r.id)}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(212,90,90,0.15)', border: '1px solid rgba(212,90,90,0.3)',
                        color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!recordingsLoading && filteredRecordings.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim, fontSize: 13 }}>
            {searchQuery || teamFilter !== 'all' ? 'No meetings match your filters' : 'No recordings yet'}
          </div>
        )}
      </div>

      {/* Responsive + Status Pulse Styles */}
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @media (max-width: 768px) {
          .studio-action-cards { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}
