import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ArrowLeft, Calendar, FileText, User, AlertCircle, Pencil, Check, X, RefreshCw, MoreVertical, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, renameMeeting } from '../services/api';
import { SophiaPageHeader, SectionCard, EmptyStateCard, ContextRail } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { C, useThemeMode } from '../theme';
import { FEATURE_LABELS, DONUT_COLORS } from '../components/culture-health/constants';
import { MeetingDimensionWheel } from '../components/meetings/MeetingDimensionWheel';

// ─── Interfaces ───

interface Sentence {
    sentence_id: number;
    raw_text: string;
    speaker: string;
    start_time?: number;
    end_time?: number;
}

interface MeetingDetail {
    meeting_id: number;
    title: string | null;
    meeting_date: string;
    created_by: string;
    file_path: string | null;
    processed_status?: string;
    sentences: Sentence[];
}

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
    context_type: string | null;
    participation_balance: number | null;
    collective_inquiry: number | null;
    conflict_trajectory: number | null;
    decision_completion: number | null;
    qualitative_observations: string | null;
    dimension_weights: DimensionWeight[];
}

// ─── Dimension Mapping ───

const DIMENSION_MAP: Record<string, { short: string; color: string; index: number }> = {};
['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((dim, i) => {
    DIMENSION_MAP[dim] = { short: FEATURE_LABELS[i].short, color: DONUT_COLORS[i], index: i };
});

// ─── Status Colors ───

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string; pulse: boolean }> = {
    pending: { bg: 'rgba(156,163,175,0.15)', text: 'rgb(156,163,175)', label: 'Pending', pulse: false },
    processing: { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)', label: 'Processing', pulse: true },
    complete: { bg: 'rgba(34,197,94,0.15)', text: 'rgb(34,197,94)', label: 'Complete', pulse: false },
    failed: { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)', label: 'Failed', pulse: false },
    insufficient_content: { bg: 'rgba(212,163,74,0.15)', text: 'rgb(212,163,74)', label: 'Insufficient Content', pulse: false },
};

// ─── Helpers ───

const speakerColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 50%, 45%)`;
};

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ─── Inline Components ───

const StatusBadge = ({ status }: { status: string }) => {
    const style = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, color: style.text,
            padding: '3px 10px', borderRadius: 6,
            background: style.bg,
            animation: style.pulse ? 'statusPulse 2s ease-in-out infinite' : undefined,
            whiteSpace: 'nowrap',
            fontFamily: "'Tomorrow', sans-serif",
        }}>
            <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: style.text,
                animation: style.pulse ? 'statusPulse 2s ease-in-out infinite' : undefined,
            }} />
            {style.label}
        </span>
    );
};

const ProgressBar = ({ stepsCompleted, totalSteps, currentStep }: {
    stepsCompleted: number; totalSteps: number; currentStep: string | null;
}) => {
    const pct = totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0;
    const label = stepsCompleted === 0 ? 'Starting...'
        : stepsCompleted >= totalSteps ? 'Finalizing...'
        : currentStep || 'Processing...';
    return (
        <div style={{ width: '100%' }}>
            <div style={{
                width: '100%', height: 8, borderRadius: 4,
                background: C.border, overflow: 'hidden',
            }}>
                <div style={{
                    width: `${pct}%`, height: 8, borderRadius: 4,
                    background: C.teal, transition: 'width 0.4s ease',
                }} />
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: C.amber || 'rgb(245,158,11)',
                        display: 'inline-block',
                        animation: 'statusPulse 2s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: 12, fontFamily: "'Tomorrow', sans-serif", fontWeight: 400, color: C.textDim }}>
                        Processing
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "'Tomorrow', sans-serif", fontWeight: 400, color: C.textDim }}>
                        {label}
                    </span>
                </div>
                <span style={{ fontSize: 12, fontFamily: "'Tomorrow', sans-serif", fontWeight: 600, color: C.textSec }}>
                    {stepsCompleted}/{totalSteps}
                </span>
            </div>
        </div>
    );
};

const InsufficientContentBanner = () => (
    <div style={{
        width: '100%', background: (C.amber || 'rgb(212,163,74)') + '14',
        border: `1px solid ${(C.amber || 'rgb(212,163,74)')}30`,
        borderRadius: 12, padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
    }}>
        <AlertTriangle size={24} color={C.amber || 'rgb(212,163,74)'} style={{ flexShrink: 0 }} />
        <div>
            <div style={{ fontSize: 14, fontFamily: "'Tomorrow', sans-serif", fontWeight: 600, color: C.text }}>
                Scoring unavailable
            </div>
            <div style={{ fontSize: 13, fontFamily: "'Tomorrow', sans-serif", fontWeight: 400, color: C.textSec, lineHeight: 1.5, marginTop: 4 }}>
                This meeting does not have enough speech content for meaningful scoring. Transcript and speaker data are still available below.
            </div>
        </div>
    </div>
);

const NullScore = () => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <span style={{ fontSize: 14, fontFamily: "'Tomorrow', sans-serif", fontWeight: 400, color: C.textDim, cursor: 'help' }}>
                    --
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <p>Score unavailable -- processing incomplete</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

interface ReprocessControlsProps {
    meetingId: number;
    processedStatus: string;
    createdBy: string;
    currentUserId: string | undefined;
    onReprocessStarted: () => void;
    getToken: () => Promise<string | null>;
}

const ReprocessControls = ({ meetingId, processedStatus, createdBy, currentUserId, onReprocessStarted, getToken }: ReprocessControlsProps) => {
    useThemeMode();
    const [reprocessState, setReprocessState] = useState<'idle' | 'confirming' | 'loading'>('idle');
    const [fullReprocessConfirm, setFullReprocessConfirm] = useState(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [reprocessError, setReprocessError] = useState<string | null>(null);

    const canShow = ['completed', 'complete', 'failed', 'insufficient_content'].includes(processedStatus) && createdBy === currentUserId;
    if (!canShow) return null;

    const handleRescore = async () => {
        if (reprocessState === 'idle') {
            setReprocessState('confirming');
            setReprocessError(null);
            confirmTimeoutRef.current = setTimeout(() => setReprocessState('idle'), 3000);
            return;
        }
        if (reprocessState === 'confirming') {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
            setReprocessState('loading');
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/v1/meetings/${meetingId}/reprocess`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: 'rescore' }),
                });
                if (res.ok) {
                    onReprocessStarted();
                } else {
                    setReprocessError('Reprocess failed. Try again or contact support.');
                }
            } catch {
                setReprocessError('Reprocess failed. Try again or contact support.');
            } finally {
                setReprocessState('idle');
            }
        }
    };

    const handleFullReprocess = async () => {
        setFullReprocessConfirm(false);
        setReprocessState('loading');
        setReprocessError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/v1/meetings/${meetingId}/reprocess`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'full' }),
            });
            if (res.ok) {
                onReprocessStarted();
            } else {
                setReprocessError('Reprocess failed. Try again or contact support.');
            }
        } catch {
            setReprocessError('Reprocess failed. Try again or contact support.');
        } finally {
            setReprocessState('idle');
        }
    };

    const isDisabled = processedStatus === 'processing' || reprocessState === 'loading';

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    onClick={handleRescore}
                    disabled={isDisabled}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        height: 36, padding: '0 12px', borderRadius: 8, border: 'none',
                        background: reprocessState === 'confirming' ? (C.amber || 'rgb(212,163,74)') : C.teal,
                        color: C.bg, fontFamily: "'Tomorrow', sans-serif", fontWeight: 600, fontSize: 13,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'background 0.2s, opacity 0.2s',
                    }}
                >
                    {reprocessState === 'loading' ? (
                        <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Reprocessing...</>
                    ) : reprocessState === 'confirming' ? (
                        <>Confirm Re-score?</>
                    ) : (
                        <><RefreshCw size={16} /> Re-score</>
                    )}
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            disabled={isDisabled}
                            aria-label="More actions"
                            style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 36, height: 36, borderRadius: 8, border: 'none',
                                background: 'transparent', color: C.textDim,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                opacity: isDisabled ? 0.5 : 1,
                            }}
                        >
                            <MoreVertical size={16} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setFullReprocessConfirm(true)}>
                            <RotateCcw size={16} style={{ marginRight: 8 }} />
                            Full Reprocess
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {fullReprocessConfirm && (
                <div style={{
                    marginTop: 12, padding: '12px 16px', borderRadius: 8,
                    background: C.card, border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: 13, fontFamily: "'Tomorrow', sans-serif", color: C.text, flex: 1 }}>
                        This will reprocess the entire meeting from scratch. Confirm?
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleFullReprocess}
                            style={{
                                height: 32, padding: '0 12px', borderRadius: 6, border: 'none',
                                background: C.red, color: '#fff',
                                fontFamily: "'Tomorrow', sans-serif", fontWeight: 600, fontSize: 12,
                                cursor: 'pointer',
                            }}
                        >
                            Yes, reprocess
                        </button>
                        <button
                            onClick={() => setFullReprocessConfirm(false)}
                            style={{
                                height: 32, padding: '0 12px', borderRadius: 6, border: 'none',
                                background: 'transparent', color: C.textDim,
                                fontFamily: "'Tomorrow', sans-serif", fontWeight: 500, fontSize: 12,
                                cursor: 'pointer',
                            }}
                        >
                            Keep Meeting
                        </button>
                    </div>
                </div>
            )}

            {reprocessError && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.red, fontFamily: "'Tomorrow', sans-serif" }}>
                    {reprocessError}
                </div>
            )}
        </div>
    );
};

interface DimensionBadgeProps {
    classification: Classification;
    isExpanded: boolean;
    onToggle: () => void;
}

const DimensionBadge = ({ classification, isExpanded, onToggle }: DimensionBadgeProps) => {
    const dim = DIMENSION_MAP[classification.dimension];
    if (!dim) return null;

    const isNegative = classification.label.toLowerCase().includes('negative');
    const isNeutral = classification.label === 'Neutral';
    const arrow = isNeutral ? '' : isNegative ? ' \u2193' : ' \u2191';

    return (
        <div>
            <button
                onClick={onToggle}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: `${dim.color}20`,
                    color: dim.color,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif",
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'opacity 0.15s',
                }}
            >
                {dim.short}{arrow}
            </button>
            {isExpanded && (
                <div style={{
                    fontSize: 12,
                    color: C.textDim,
                    fontStyle: 'italic',
                    lineHeight: 1.55,
                    paddingLeft: 8,
                    marginTop: 4,
                    fontFamily: "'Tomorrow', sans-serif",
                }}>
                    {classification.evidence}
                </div>
            )}
        </div>
    );
};

interface TranscriptBubbleProps {
    turn: SpeakerTurn;
    classifications: Classification[];
}

const cleanSpeakerName = (raw: string): string => {
    if (/^UNKNOWN\s*/i.test(raw)) return raw.replace(/^UNKNOWN\s*/i, '').replace(/^SPEAKER\s*/i, 'Speaker ');
    if (raw.startsWith('user_')) return 'Speaker';
    return raw;
};

const TranscriptBubble = ({ turn, classifications }: TranscriptBubbleProps) => {
    const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
    const rawName = turn.speaker_name || turn.speaker_label;
    const displayName = cleanSpeakerName(rawName);
    const avatarColor = speakerColor(displayName);

    return (
        <div style={{
            display: 'flex',
            gap: 12,
            padding: '12px 0',
        }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'Tomorrow', sans-serif",
                }}>
                    {displayName.charAt(0).toUpperCase()}
                </div>
                {turn.is_matched && (
                    <div style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: C.teal,
                        border: `2px solid ${C.bg}`,
                    }} />
                )}
            </div>

            {/* Bubble */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    background: C.card,
                    borderRadius: '16px 16px 16px 4px',
                    border: `1px solid ${C.border}`,
                    padding: 16,
                }}>
                    {/* Header: speaker name + timestamp */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 6,
                    }}>
                        <span style={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            letterSpacing: 0.8,
                            color: C.teal,
                            fontFamily: "'Tomorrow', sans-serif",
                        }}>
                            {displayName}
                        </span>
                        <span style={{
                            fontSize: 11,
                            color: C.textDim,
                            fontFamily: "'Tomorrow', sans-serif",
                            flexShrink: 0,
                            marginLeft: 12,
                        }}>
                            {formatTime(turn.start_time)}
                        </span>
                    </div>

                    {/* Text */}
                    <p style={{
                        fontSize: 14.5,
                        color: C.text,
                        lineHeight: 1.75,
                        margin: 0,
                        fontFamily: "'Tomorrow', sans-serif",
                    }}>
                        {turn.text}
                    </p>

                    {/* Dimension Badges */}
                    {classifications.length > 0 && (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 8,
                        }}>
                            {classifications.map(c => (
                                <DimensionBadge
                                    key={c.id}
                                    classification={c}
                                    isExpanded={expandedBadge === c.id}
                                    onToggle={() => setExpandedBadge(prev => prev === c.id ? null : c.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───

const MeetingDetailPage = () => {
    useThemeMode();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { user: clerkUser } = useUser();
    const currentUserId = clerkUser?.id;
    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [railOpen, setRailOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // New state for enriched data
    const [speakerTurns, setSpeakerTurns] = useState<SpeakerTurn[]>([]);
    const [classifications, setClassifications] = useState<Classification[]>([]);
    const [teamScore, setTeamScore] = useState<MeetingTeamScore | null>(null);

    // Progress tracking state
    const [currentStep, setCurrentStep] = useState<string | null>(null);
    const [stepsCompleted, setStepsCompleted] = useState<number>(0);
    const [totalSteps, setTotalSteps] = useState<number>(0);

    // Auto-scroll to top on mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        const fetchMeeting = async () => {
            if (!id) return;
            try {
                const token = await getToken();
                const response = await fetch(`${API_BASE_URL}/v1/meetings/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setMeeting(data);

                    // Fetch enriched data in parallel
                    const [turnsRes, classRes, scoreRes] = await Promise.allSettled([
                        fetch(`${API_BASE_URL}/v1/meetings/${id}/speaker-turns`, { headers: { Authorization: `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/v1/meetings/${id}/classifications`, { headers: { Authorization: `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/v1/meetings/${id}/team-score`, { headers: { Authorization: `Bearer ${token}` } }),
                    ]);

                    if (turnsRes.status === 'fulfilled' && turnsRes.value.ok) {
                        setSpeakerTurns(await turnsRes.value.json());
                    }
                    if (classRes.status === 'fulfilled' && classRes.value.ok) {
                        setClassifications(await classRes.value.json());
                    }
                    if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
                        const scoreData = await scoreRes.value.json();
                        if (scoreData) setTeamScore(scoreData);
                    }
                } else {
                    setError("Meeting not found");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load meeting details");
            } finally {
                setLoading(false);
            }
        };

        fetchMeeting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]); // getToken is stable from Clerk

    // Full data refresh (used after reprocess starts or processing completes)
    const refreshMeetingData = useCallback(async () => {
        if (!id) return;
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/meetings/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setMeeting(data);
                // Fetch enriched data in parallel
                const [turnsRes, classRes, scoreRes] = await Promise.allSettled([
                    fetch(`${API_BASE_URL}/v1/meetings/${id}/speaker-turns`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/v1/meetings/${id}/classifications`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/v1/meetings/${id}/team-score`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (turnsRes.status === 'fulfilled' && turnsRes.value.ok) setSpeakerTurns(await turnsRes.value.json());
                if (classRes.status === 'fulfilled' && classRes.value.ok) setClassifications(await classRes.value.json());
                if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
                    const scoreData = await scoreRes.value.json();
                    if (scoreData) setTeamScore(scoreData);
                }
            }
        } catch (err) {
            console.error('Failed to refresh meeting data:', err);
        }
    }, [id, getToken]);

    // Status polling while processing
    const processedStatus = meeting?.processed_status || 'pending';

    useEffect(() => {
        if (processedStatus !== 'processing' || !id) return;

        const pollStatus = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/v1/meetings/${id}/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.current_step !== undefined) setCurrentStep(data.current_step);
                    if (data.steps_completed !== undefined) setStepsCompleted(data.steps_completed);
                    if (data.total_steps !== undefined) setTotalSteps(data.total_steps);

                    // Transition out of processing
                    if (data.status && data.status !== 'processing') {
                        refreshMeetingData();
                    }
                }
            } catch (err) {
                console.error('Status poll failed:', err);
            }
        };

        pollStatus(); // immediate first poll
        const interval = setInterval(pollStatus, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedStatus, id]);

    // Reprocess callback: transition to processing state
    const handleReprocessStarted = useCallback(() => {
        if (meeting) {
            setMeeting({ ...meeting, processed_status: 'processing' });
            setStepsCompleted(0);
            setTotalSteps(0);
            setCurrentStep(null);
        }
    }, [meeting]);

    // Build classification lookup map
    const classificationsByTurn = useMemo(() => {
        const map: Record<string, Classification[]> = {};
        classifications.forEach(c => {
            if (!map[c.speaker_turn_id]) map[c.speaker_turn_id] = [];
            map[c.speaker_turn_id].push(c);
        });
        return map;
    }, [classifications]);

    // Document upload detection
    const isDocumentUpload = useMemo(() => {
        if (speakerTurns.length === 0) return false;
        // Primary: all turns labeled "Team" (set by transcript_ingest.py for doc uploads)
        const allTeam = speakerTurns.every(t => t.speaker_label === 'Team');
        if (allTeam) return true;
        // Fallback: all unmatched with synthetic timestamps starting from 0
        const allUnmatched = speakerTurns.every(t => !t.is_matched);
        const startsAtZero = speakerTurns[0]?.start_time === 0;
        const uniqueLabels = new Set(speakerTurns.map(t => t.speaker_label));
        return allUnmatched && startsAtZero && uniqueLabels.size === 1;
    }, [speakerTurns]);

    // Speaker breakdown data (from speakerTurns if available, else from sentences)
    const speakerBreakdown = useMemo(() => {
        if (speakerTurns.length > 0) {
            const counts: Record<string, number> = {};
            speakerTurns.forEach(t => {
                const name = cleanSpeakerName(t.speaker_name || t.speaker_label);
                counts[name] = (counts[name] || 0) + 1;
            });
            const total = speakerTurns.length;
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([speaker, count]) => ({ speaker, count, pct: Math.round((count / total) * 100) }));
        }
        if (meeting?.sentences && meeting.sentences.length > 0) {
            const counts: Record<string, number> = {};
            meeting.sentences.forEach(s => {
                const speaker = s.speaker || 'Unknown';
                counts[speaker] = (counts[speaker] || 0) + 1;
            });
            const total = meeting.sentences.length;
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([speaker, count]) => ({ speaker, count, pct: Math.round((count / total) * 100) }));
        }
        return [];
    }, [speakerTurns, meeting]);

    const startEditing = () => {
        setEditTitle(meeting?.title || '');
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditTitle('');
    };

    const saveTitle = async () => {
        if (!meeting || !editTitle.trim() || editTitle.trim() === meeting.title) {
            cancelEditing();
            return;
        }
        setSaving(true);
        try {
            const token = await getToken();
            await renameMeeting(meeting.meeting_id, editTitle.trim(), token);
            setMeeting({ ...meeting, title: editTitle.trim() });
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to rename meeting:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div>
                <SophiaPageHeader title="Loading..." />
                <SectionCard><Skeleton className="h-48 w-full" /></SectionCard>
                <SectionCard><div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div></SectionCard>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div>
                <SophiaPageHeader title="Meeting Details" />
                <SectionCard>
                    <EmptyStateCard
                        icon={<AlertCircle size={48} />}
                        title={error || "Meeting not found"}
                        description="The meeting could not be loaded."
                        action={<button onClick={() => navigate('/transcripts')} className="px-4 py-2 rounded-lg transition hover-teal" style={{ background: C.teal, color: C.white }}>Back to Transcripts</button>}
                    />
                </SectionCard>
            </div>
        );
    }

    // Render transcript content
    const renderTranscript = () => {
        // New speaker turns data
        if (speakerTurns.length > 0) {
            if (isDocumentUpload) {
                // Document uploads: plain text blocks without speaker decoration
                return (
                    <div style={{ padding: 16 }}>
                        {speakerTurns.map(turn => (
                            <div key={turn.id} style={{
                                padding: '12px 0',
                                borderBottom: `1px solid ${C.border}`,
                            }}>
                                <p style={{
                                    fontSize: 14.5,
                                    color: C.text,
                                    lineHeight: 1.75,
                                    margin: 0,
                                    fontFamily: "'Tomorrow', sans-serif",
                                }}>
                                    {turn.text}
                                </p>
                                {/* Dimension badges for document turns */}
                                {classificationsByTurn[turn.id] && classificationsByTurn[turn.id].length > 0 && (
                                    <DocumentBadges
                                        classifications={classificationsByTurn[turn.id]}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                );
            }

            // Audio uploads: chat-style bubbles (filter out empty turns)
            return (
                <div style={{ padding: '8px 16px' }}>
                    {speakerTurns.filter(t => t.text && t.text.trim().length > 0).map(turn => (
                        <TranscriptBubble
                            key={turn.id}
                            turn={turn}
                            classifications={classificationsByTurn[turn.id] || []}
                        />
                    ))}
                </div>
            );
        }

        // Fallback: legacy sentences
        if (meeting.sentences && meeting.sentences.length > 0) {
            return meeting.sentences.map((sentence) => (
                <div key={sentence.sentence_id} className="p-6 hover:bg-white/5 transition">
                    <div className="flex items-baseline gap-4 mb-1">
                        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: C.teal, fontFamily: "'Tomorrow', sans-serif" }}>
                            {sentence.speaker || 'Speaker'}
                        </span>
                    </div>
                    <p className="leading-relaxed" style={{ color: C.textSec }}>
                        {sentence.raw_text}
                    </p>
                </div>
            ));
        }

        // Empty state
        return (
            <EmptyStateCard
                icon={<FileText size={48} />}
                title="No transcript available"
                description="This meeting hasn't been transcribed yet. Check back after processing completes."
            />
        );
    };

    return (
        <div style={{ display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="max-w-4xl mx-auto">
                    <SophiaPageHeader
                        title={
                            isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        ref={inputRef}
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveTitle();
                                            if (e.key === 'Escape') cancelEditing();
                                        }}
                                        disabled={saving}
                                        style={{
                                            background: C.bg,
                                            color: C.text,
                                            border: `1px solid ${C.teal}`,
                                            borderRadius: 8,
                                            padding: '4px 12px',
                                            fontSize: 'inherit',
                                            fontFamily: "'Josefin Sans', sans-serif",
                                            fontWeight: 'inherit',
                                            outline: 'none',
                                            width: '100%',
                                            maxWidth: 400,
                                        }}
                                    />
                                    <button onClick={saveTitle} disabled={saving} style={{ color: C.teal, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                                        <Check size={18} />
                                    </button>
                                    <button onClick={cancelEditing} style={{ color: C.textDim, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={startEditing}>
                                    <span>{meeting.title || "Untitled Transcript"}</span>
                                    <Pencil size={14} style={{ color: C.textDim, opacity: 0.6 }} />
                                </div>
                            )
                        }
                        actions={
                            <button
                                onClick={() => navigate('/transcripts')}
                                className="flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 transition hover-bg"
                                style={{ borderColor: C.border, background: C.card, color: C.text }}
                            >
                                <ArrowLeft size={18} />
                                Back
                            </button>
                        }
                    />

                    {/* Metadata Card with Status Badge */}
                    <SectionCard>
                        <div className="flex justify-between items-start mb-6">
                            <div style={{ flex: 1 }}>
                                <div className="flex items-center gap-4 text-sm" style={{ color: C.textDim }}>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} />
                                        {new Date(meeting.meeting_date).toLocaleDateString()}
                                    </div>
                                    {meeting.created_by && (
                                        <div className="flex items-center gap-2">
                                            <User size={14} />
                                            Created by user
                                        </div>
                                    )}
                                    {processedStatus !== 'processing' && <StatusBadge status={processedStatus} />}
                                </div>
                                {processedStatus === 'processing' && (
                                    <div style={{ marginTop: 12 }}>
                                        <ProgressBar stepsCompleted={stepsCompleted} totalSteps={totalSteps} currentStep={currentStep} />
                                    </div>
                                )}
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: C.tealDeep, color: C.teal }}>
                                <FileText size={24} />
                            </div>
                        </div>

                        {/* Reprocess Controls */}
                        <ReprocessControls
                            meetingId={meeting.meeting_id}
                            processedStatus={processedStatus}
                            createdBy={meeting.created_by}
                            currentUserId={currentUserId}
                            onReprocessStarted={handleReprocessStarted}
                            getToken={getToken}
                        />
                    </SectionCard>

                    {/* Insufficient Content Banner */}
                    {processedStatus === 'insufficient_content' && (
                        <div style={{ marginTop: 16 }}>
                            <InsufficientContentBanner />
                        </div>
                    )}

                    {/* Transcript */}
                    <div className="mt-6">
                        <SectionCard title="Transcript" noPadding>
                            {renderTranscript()}
                        </SectionCard>
                    </div>
                </div>
            </div>

            {/* Context Rail */}
            <ContextRail open={railOpen} onToggle={() => setRailOpen(o => !o)}>
                {/* Speaker Breakdown */}
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>
                    Speaker Breakdown
                </div>
                {speakerBreakdown.length > 0 ? (
                    speakerBreakdown.map(({ speaker, pct }) => (
                        <SectionCard key={speaker}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{speaker}</span>
                                <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.teal }}>
                                    {pct}%
                                </span>
                            </div>
                            <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: C.border }}>
                                <div style={{ height: '100%', borderRadius: 2, background: C.teal, width: `${pct}%`, transition: 'width 0.3s' }} />
                            </div>
                        </SectionCard>
                    ))
                ) : (
                    <div style={{ fontSize: 12, color: C.textDim }}>No speaker data available</div>
                )}

                {/* Dimension Analysis */}
                <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    marginTop: 8,
                    fontFamily: "'Tomorrow', sans-serif",
                }}>
                    Dimension Analysis
                </div>
                {teamScore && teamScore.dimension_weights && teamScore.dimension_weights.length > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <MeetingDimensionWheel weights={teamScore.dimension_weights} />
                    </div>
                ) : (
                    <div style={{
                        fontSize: 12,
                        color: C.textDim,
                        fontStyle: 'italic',
                        fontFamily: "'Tomorrow', sans-serif",
                    }}>
                        Analysis will appear after processing completes
                    </div>
                )}
            </ContextRail>
        </div>
    );
};

// ─── Document Badges (stateful wrapper for document upload mode) ───

const DocumentBadges = ({ classifications }: { classifications: Classification[] }) => {
    const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {classifications.map(c => (
                <DimensionBadge
                    key={c.id}
                    classification={c}
                    isExpanded={expandedBadge === c.id}
                    onToggle={() => setExpandedBadge(prev => prev === c.id ? null : c.id)}
                />
            ))}
        </div>
    );
};

export default MeetingDetailPage;
