import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Mic, Square, Download, Loader2, MessageSquare, User, Volume2, ShieldCheck, ShieldAlert, History, Monitor, CheckCircle2, Pencil, Trash2, X, Check, Info, FileText, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { API_BASE_URL } from '../services/api';
import { useMeeting } from '../context/MeetingContext';
import { useTeam } from '../context/TeamContext';
import { useAuth } from '@clerk/clerk-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
} from 'recharts';
import FileUpload from './files/FileUpload';
import { C, useThemeMode } from '../theme';

const SENTIMENT_SURFACE = {
    positive: { background: `${C.green}14`, borderColor: `${C.green}33`, color: C.green },
    negative: { background: `${C.red}14`, borderColor: `${C.red}33`, color: C.red },
    neutral: { background: C.bgSub, borderColor: C.border, color: C.textSec },
};

// Icon components for cards
const ParticipationIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const FlowIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

const EmotionIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

// Card styling
const CARD_WRAPPER = 'px-6 py-5 rounded-xl shadow-sm';

// Utility logic for Dynamic Styling (aligned with DashboardInteractionTab)
const getParticipationStatus = (score: number) => {
    if (score >= 75) return {
        label: "Inclusive / Balanced",
        insight: "Everyone is contributing"
    };
    if (score >= 50) return {
        label: "Conversational",
        insight: "Developing dynamic"
    };
    return {
        label: "Presentation Mode",
        insight: "Single speaker focus"
    };
};

const getSentimentStatus = (score: number) => {
    if (score >= 91) return { label: "Peak Synergy" };
    if (score >= 81) return { label: "Highly Collaborative" };
    if (score >= 71) return { label: "Constructive Flow" };
    if (score >= 61) return { label: "Receptive / Open" };
    if (score >= 51) return { label: "Neutral / Balanced" };
    if (score >= 41) return { label: "Reserved / Cautious" };
    if (score >= 31) return { label: "Guarded / Tense" };
    if (score >= 21) return { label: "High Friction" };
    if (score >= 11) return { label: "Hostile / Volatile" };
    return { label: "Critical Breakdown" };
};

// Sub-components for Dynamics Cards (styled like Dashboard Interaction Tab)
const ParticipationCard = ({ dynamics }: { dynamics: any }) => {
    const data = dynamics?.participation_dynamics;
    if (!data) return null;

    const status = getParticipationStatus(data.balance_score);

    return (
        <div className={`${CARD_WRAPPER} flex flex-col gap-4 aspect-[1.8/1]`} style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Participation Balance</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase" style={{ background: C.tealDeep, color: C.teal }}>
                    {status.label}
                </span>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="h-3 w-full rounded-full overflow-hidden shadow-inner mt-2 mb-1" style={{ background: C.bgSub }}>
                    <div
                        className="h-full transition-all duration-700 shadow-sm"
                        style={{ width: `${data.balance_score}%`, background: C.teal }}
                    />
                </div>
            </div>

            <div className="flex justify-between items-center mt-auto">
                <p className="text-[9px] font-bold uppercase tracking-tight" style={{ color: C.teal }}>
                    {status.insight}
                </p>
            </div>
        </div>
    );
};

const OverlapCard = ({ dynamics }: { dynamics: any }) => {
    const data = dynamics?.flow_dynamics;
    if (!data) return null;

    const velocity = typeof data.velocity_score === 'number' ? data.velocity_score : parseFloat(data.velocity_score) || 0;
    const pacing = typeof data.pacing_seconds === 'number' ? data.pacing_seconds : parseFloat(data.pacing_seconds) || 0;

    return (
        <div className={`${CARD_WRAPPER} flex flex-col gap-4 aspect-[1.8/1] sm:text-left`} style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Conversation Flow</h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="text-xl font-bold leading-tight tracking-tight" style={{ color: C.textSec }}>
                    {data.label || data.flow_label || "Standard Exchange"}
                </div>
            </div>

            <div className="mt-auto flex flex-row justify-between items-end pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>
                    <span className="text-3xl font-bold" style={{ color: C.teal }}>{velocity.toFixed(1)}</span> TURNS / MIN
                </div>
                <div className="text-[9px] font-medium tracking-widest italic" style={{ color: C.textSec }}>
                    {pacing ? `${pacing.toFixed(2)}s` : '—'} AVG PACING
                </div>
            </div>
        </div>
    );
};

const ArousalCard = ({ data, historyTrend, score, label }: { data: any, historyTrend?: number[], score?: number, label?: string }) => {
    const history = historyTrend || data?.sentiment_history || [100, 100, 100];
    const sum = history.reduce((acc: number, val: number) => acc + val, 0);
    const calculatedAverage = history.length > 0 ? Math.round(sum / history.length) : 0;
    const realAverage = score !== undefined ? score : calculatedAverage;
    const scoreTextColor = realAverage > 60
        ? C.green
        : realAverage < 40
            ? C.teal
            : C.tealMuted;
    const chartData = history.map((val: number, i: number) => ({ time: i, value: val }));

    const getInsight = (s: number) => {
        if (s <= 10) return "Critical Breakdown";
        if (s <= 20) return "Hostile / Volatile";
        if (s <= 30) return "High Friction";
        if (s <= 40) return "Guarded / Tense";
        if (s <= 50) return "Reserved / Cautious";
        if (s <= 60) return "Neutral / Balanced";
        if (s <= 70) return "Receptive / Open";
        if (s <= 80) return "Constructive Flow";
        if (s <= 90) return "Highly Collaborative";
        return "Peak Synergy";
    };

    const displayLabel = label || getInsight(realAverage);

    return (
        <div className={`${CARD_WRAPPER} relative overflow-hidden group aspect-[1.8/1] flex flex-col gap-4`} style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Sentiment Trends</h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="w-full h-16 opacity-80 group-hover:opacity-100 transition-opacity relative">
                    <div className="absolute -top-3 left-0 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap" style={{ background: `${C.card}`, color: scoreTextColor }}>
                        {displayLabel}
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorSentimentMeeting" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={C.teal} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={C.tealMuted} stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={C.teal}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSentimentMeeting)"
                                isAnimationActive={true}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <XAxis hide />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="flex justify-between items-center mt-auto pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.teal }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>Team Evolution</span>
                </div>
            </div>
        </div>
    );
};

// Legacy TrendChart for single meeting view
const TrendChart = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) {
        return (
            <div className="p-6 rounded-xl shadow-sm text-center" style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textDim }}>
                No trend data available
            </div>
        );
    }

    const maxY = 100;
    const chartWidth = 100;
    const chartHeight = 50;

    const generatePath = (key: 'synergy' | 'tension') => {
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * chartWidth;
            const y = chartHeight - (d[key] / maxY) * chartHeight;
            return `${x},${y}`;
        });
        return `M ${points.join(' L ')}`;
    };

    return (
        <div className="p-6 rounded-xl shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: C.teal }}>
                Meeting Dynamics
            </h3>
            <div className="flex items-center gap-4 mb-4 text-xs justify-end">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: C.teal }} />
                    <span style={{ color: C.textSec }}>Synergy</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: C.amber }} />
                    <span style={{ color: C.textSec }}>Tension</span>
                </div>
            </div>
            <div className="relative h-32 w-full pl-6">
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[8px]" style={{ color: C.textDim }}>
                    <span>100</span>
                    <span>50</span>
                    <span>0</span>
                </div>
                <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio="none"
                    className="overflow-visible"
                >
                    {[0.25, 0.5, 0.75].map((ratio, i) => (
                        <line key={i} x1="0" y1={chartHeight * ratio} x2={chartWidth} y2={chartHeight * ratio} stroke={C.border} strokeWidth="0.5" strokeDasharray="2,2" />
                    ))}
                    <path d={generatePath('synergy')} fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="transition-all duration-700" />
                    <path d={generatePath('tension')} fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="transition-all duration-700" />
                </svg>
            </div>
            <div className="flex justify-between text-[10px] mt-2 pl-6" style={{ color: C.textDim }}>
                <span>0 min</span>
                <span>{data.length - 1} min</span>
            </div>
        </div>
    );
};

const MeetingIntelligence = ({ initialMeetingId, onMeetingSelectedChange }: { initialMeetingId?: string | null; onMeetingSelectedChange?: (selected: boolean) => void }) => {
    useThemeMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    // Context State
    const {
        result, setResult,
        dynamics, setDynamics,
        isRecording, setIsRecording,
        isProcessing, setIsProcessing,
        audioUrl, setAudioUrl,
        setSelectedMeetingTitle,
        clearMeetingData
    } = useMeeting();

    const { activeTeam } = useTeam();
    const { getToken } = useAuth();

    // live meeting title logic- what it is named as for view page (default- Session <time>)
    const getMeetingLabel = (m: { title?: string | null; created_at?: string }) =>
        (m.title && m.title.trim()) || `Session ${m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`;

    // --------------------------------------------------------
    // STATE MANAGEMENT
    // --------------------------------------------------------
    const [mode, setMode] = useState<'mic' | 'desktop'>('mic');
    const [micStatus, setMicStatus] = useState<'inactive' | 'active' | 'error'>('inactive');
    const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [meetingListPage, setMeetingListPage] = useState(1);
    const meetingsPerPage = 5;

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const teamRef = useRef(activeTeam);

    // Auto-load meeting if ID provided
    useEffect(() => {
        if (initialMeetingId) {
            loadMeeting(initialMeetingId);
        }
    }, [initialMeetingId]);

    useEffect(() => {
        teamRef.current = activeTeam;
    }, [activeTeam]);

    useEffect(() => {
        onMeetingSelectedChange?.(!!result);
    }, [result, onMeetingSelectedChange]);

    // Cleanup audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    // Reset page when exiting meeting detail (navigate away from view page)
    const prevPathRef = useRef(location.pathname);
    useEffect(() => {
        const prev = prevPathRef.current;
        prevPathRef.current = location.pathname;
        if (prev.startsWith('/meetings/view/') && !location.pathname.startsWith('/meetings/view/')) {
            clearMeetingData();
        }
    }, [location.pathname, clearMeetingData]);

    // --------------------------------------------------------
    // HISTORY LOGIC
    // --------------------------------------------------------
    const fetchRecentMeetings = useCallback(async (teamId: string) => {
        if (!teamId) return;
        setLoadingHistory(true);
        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const res = await fetch(`${baseUrl}/meetings/${teamId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRecentMeetings(data);
            }
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoadingHistory(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // getToken is stable from Clerk, don't include to avoid infinite loop

    useEffect(() => {
        if (activeTeam) {
            fetchRecentMeetings(activeTeam.team_id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTeam?.team_id, refreshTrigger]); // fetchRecentMeetings is stable, only re-run on team/refresh change

    const handleRename = async (meetingId: string, newTitle: string) => {
        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const res = await fetch(`${baseUrl}/meetings/${meetingId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle })
            });

            if (res.ok) {
                toast.success("Meeting renamed");
                setEditingId(null);
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error("Rename failed");
            }
        } catch (e) {
            console.error("Rename error:", e);
            toast.error("Failed to rename meeting");
        }
    };

    // FUTURE TODO: handle delete meeting functionality
    const handleDelete = async (meetingId: string) => {
        toast.error("Delete meeting comming soon.");
        return;
    };

    const loadMeeting = async (meetingId: string) => {
        setIsProcessing(true);
        try {
            const token = await (activeTeam
                ? getToken({ organizationId: activeTeam.team_id })
                : getToken());
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const res = await fetch(`${baseUrl}/meetings/detail/${meetingId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const detail = (body as { detail?: string })?.detail ?? res.statusText;
                const msg = res.status === 404
                    ? "Meeting not found. If you opened this from the Files tab, try opening it from the Live meetings list instead."
                    : detail || "Could not load meeting details.";
                throw new Error(msg);
            }

            const data = await res.json();
            setResult(data);
            if (data.conversation_dynamics) {
                setDynamics(data.conversation_dynamics);
            }
            setAudioUrl(null);
            setIsSaved(true);
            setSelectedMeetingTitle(data.title || 'Meeting');
            // Only update URL when on list page; view page has /meetings/view/:id
            if (!location.pathname.startsWith('/meetings/view/')) {
                setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.set('tab', 'meetings');
                    next.set('meetingId', String(meetingId));
                    return next;
                }, { replace: true });
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Could not load meeting details.";
            console.error("Load meeting error:", e);
            toast.error(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAudioUpload = useCallback(async (blob: Blob | File) => {
        if (!teamRef.current) {
            alert("No Active Team Selected. Please select a team first.");
            return;
        }

        setIsProcessing(true);
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        formData.append('team_id', teamRef.current.team_id);

        try {
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const response = await fetch(`${baseUrl}/transcribe`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Transcription failed');
            }

            const data = await response.json();
            setResult(data);
            setDynamics(data.conversation_dynamics);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setSelectedMeetingTitle((data as any)?.title || 'New Recording');
        } catch (err: any) {
            console.error("Upload error:", err);
            alert(`Transcription Error: ${err.message}`);
        } finally {
            setIsProcessing(false);
            setIsSaved(false);
        }
    }, [setResult, setDynamics, setAudioUrl, setIsProcessing, setSelectedMeetingTitle, getToken, navigate]);

    const handleSaveMeeting = async () => {
        if (!teamRef.current || !result || !dynamics) return;

        try {
            const token = await getToken();
            const baseUrl = API_BASE_URL.replace(/\/api$/, '');
            const response = await fetch(`${baseUrl}/meetings/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    team_id: teamRef.current.team_id,
                    audio_url: audioUrl,
                    transcript: result,
                    dynamics: dynamics
                })
            });

            if (!response.ok) throw new Error("Failed to save meeting");

            const data = await response.json();

            // Update result with empowerment from classification
            if (data.empowerment) {
                setResult({ ...result, empowerment: data.empowerment });
            }

            setIsSaved(true);
            setRefreshTrigger(prev => prev + 1);
            toast.success(`Meeting analysis saved to ${teamRef.current.team_name} history.`);
            navigate(`/meetings/view/${data.id}`);
        } catch (error) {
            console.error("Save error:", error);
            toast.error("Failed to save meeting to history.");
        }
    };

    // --------------------------------------------------------
    // RECORDING LOGIC
    // --------------------------------------------------------
    const startRecording = async () => {
        // Step A: Check Team
        if (!teamRef.current) {
            alert("Please select a Team from the sidebar before recording.");
            return;
        }

        // Step B: Logic Split
        let stream: MediaStream;
        let fullStream: MediaStream | null = null;
        try {
            if (mode === 'mic') {
                console.log("Requesting Microphone Permissions...");
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
            } else {
                console.log("Requesting Screen Capture Access (Desktop)...");
                fullStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: "monitor",
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    },
                    systemAudio: "include"
                } as any);

                if (fullStream.getAudioTracks().length === 0) {
                    fullStream.getTracks().forEach(track => track.stop());
                    alert("To record desktop audio, you MUST check the 'Share System Audio' box in the screen selection popup.");
                    setIsRecording(false);
                    return;
                }

                stream = new MediaStream(fullStream.getAudioTracks());
            }
        } catch (err: any) {
            console.error("Stream Error:", err);
            alert("Could not start recording. Check device permissions.");
            setMicStatus('error');
            setIsRecording(false);
            return;
        }

        // Step C: Initialize MediaRecorder
        try {
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/mp4";

            console.log("Initialising MediaRecorder with type:", mimeType);
            const recorder = new MediaRecorder(stream, { mimeType });

            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstart = () => {
                console.log("Recorder started successfully");
                setIsRecording(true);
            };

            recorder.onstop = async () => {
                console.log("Recorder stopped. Processing...");
                const blob = new Blob(chunksRef.current, { type: mimeType });

                stream.getTracks().forEach(track => track.stop());
                if (fullStream) {
                    fullStream.getTracks().forEach(track => track.stop());
                }

                setMicStatus('inactive');
                setIsRecording(false);

                if (blob.size > 0) {
                    await handleAudioUpload(blob);
                } else {
                    alert("Recording failed: No audio data captured.");
                }
            };

            setIsRecording(true);
            recorder.start(1000);
            setMicStatus('active');
            clearMeetingData();
            if (audioUrl) URL.revokeObjectURL(audioUrl);

        } catch (err: any) {
            console.error("MediaRecorder Fail:", err);
            alert("Recorder could not be initialized.");
            stream.getTracks().forEach(t => t.stop());
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };

    // --------------------------------------------------------
    // UI RENDER HELPERS
    // --------------------------------------------------------
    const groupSentencesBySpeaker = (sentences: any[]) => {
        if (!sentences || sentences.length === 0) return [];
        const groups: { speaker: string; sentences: any[] }[] = [];
        let currentGroup: { speaker: string; sentences: any[] } | null = null;

        sentences.forEach((sentence) => {
            if (!currentGroup || currentGroup.speaker !== sentence.speaker) {
                currentGroup = { speaker: sentence.speaker, sentences: [sentence] };
                groups.push(currentGroup);
            } else {
                currentGroup.sentences.push(sentence);
            }
        });
        return groups;
    };

    const getSentimentStyles = (sentiment: string, lightBg = false) => {
        switch (sentiment) {
            case 'POSITIVE': return lightBg ? SENTIMENT_SURFACE.positive : { background: `${C.green}14`, color: C.green };
            case 'NEGATIVE': return lightBg ? SENTIMENT_SURFACE.negative : { background: `${C.red}14`, color: C.red };
            default: return lightBg ? SENTIMENT_SURFACE.neutral : { color: C.textSec };
        }
    };

    const handleExportPDF = () => {
        try {
            if (!result || !activeTeam) {
                return alert("No meeting data available for export.");
            }

            const doc = new jsPDF();
            const timestamp = new Date().toLocaleDateString();

            // 1. Header
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('Meeting Intelligence Report', 14, 20);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Team: ${activeTeam.team_name} | Date: ${timestamp}`, 14, 28);

            // 2. Transcript (Renumbered)
            const startY = 45;
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Transcript', 14, startY);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            let y = startY + 10;

            const speakerGroups = groupSentencesBySpeaker(result.sentences);

            speakerGroups.forEach((group) => {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(20, 184, 166);
                doc.text(`${group.speaker}:`, 14, y);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0);
                const fullText = group.sentences.map(s => s.text).join(' ');
                const splitText = doc.splitTextToSize(fullText, 180);

                doc.text(splitText, 14, y + 5);
                y += (splitText.length * 5) + 12;

                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });

            doc.save(`Meeting_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("PDF Report generated successfully.");
        } catch (err: any) {
            console.error("PDF Failed:", err);
            alert("PDF generation failed. Check console for details.");
        }
    };

    const speakerGroups = result ? groupSentencesBySpeaker(result.sentences) : [];
    const hasMeetingSelected = !!result;
    const onListPage = location.pathname.startsWith('/meetings') && !location.pathname.startsWith('/meetings/view/');
    const showMeetingDetail = hasMeetingSelected && (location.pathname.startsWith('/meetings/view/') || (onListPage && !isSaved));

    return (
        <div className="max-w-[1600px] mx-auto px-4 animate-in fade-in duration-700 pb-12 relative">
            <div className={`flex gap-8 ${showMeetingDetail ? 'flex-row' : 'flex-col'}`}>
                {showMeetingDetail ? (
                    <>
                        {/* LEFT SIDEBAR: Analytics cards (when meeting selected) */}
                        <div className="w-80 flex-shrink-0 space-y-4">
                            {dynamics && (
                                <>
                                    <ParticipationCard dynamics={dynamics} />
                                    <OverlapCard dynamics={dynamics} />
                                    <ArousalCard
                                        data={dynamics.arousal}
                                        score={dynamics.emotional_dynamics?.score}
                                        label={dynamics.sentiment_trends?.label}
                                    />
                                </>
                            )}
                            <button
                                onClick={handleSaveMeeting}
                                disabled={!dynamics || isSaved || isProcessing}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isSaved
                                    ? 'cursor-not-allowed opacity-75'
                                    : 'disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                                style={isSaved
                                    ? { background: C.bgSub, color: C.textDim, border: `1px solid ${C.border}` }
                                    : { background: C.teal, color: C.white }
                                }
                            >
                                <CheckCircle2 size={18} />
                                {isSaved ? 'Meeting Saved' : 'Save Meeting'}
                            </button>
                            {onListPage && !isSaved && (
                                <button
                                    type="button"
                                    onClick={clearMeetingData}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium hover-bg transition-colors"
                                    style={{ background: C.card, color: C.text, border: `1px solid ${C.border}` }}
                                >
                                    <ArrowLeft size={18} />
                                    Back to list
                                </button>
                            )}
                        </div>

                        {/* RIGHT: Transcript (when meeting selected) */}
                        <div className="flex-1 min-w-0">
                            {/* Transcript section */}
                            <div className="rounded-xl shadow-sm flex flex-col overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                                <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text }}>
                                        <MessageSquare size={18} style={{ color: C.teal }} />
                                        Transcript
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleExportPDF}
                                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg hover-bg transition-colors"
                                        style={{ border: `1px solid ${C.border}`, background: C.card, color: C.text }}
                                    >
                                        <Download size={14} className="mr-1.5" />
                                        Export PDF
                                    </button>
                                </div>
                                <div className="p-6 h-[600px] overflow-y-auto space-y-6" style={{ background: C.bgSub }}>
                                    {speakerGroups.map((group, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                                                <User size={20} style={{ color: C.textDim }} />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.teal }}>{group.speaker}</span>
                                                <p className="mt-1 leading-relaxed" style={{ color: C.text }}>
                                                    {group.sentences.map((s, i) => (
                                                        <span key={i} className="px-1 rounded-sm" style={getSentimentStyles(s.sentiment, true)}>{s.text} </span>
                                                    ))}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* DEFAULT: No meeting selected - clean light UI */}
                        <div className="flex-1 space-y-6 min-w-0">
                            {/* Start Live Recording card */}
                            <div className="rounded-xl shadow-sm p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    {activeTeam ? (
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: C.bgSub, border: `1px solid ${C.border}` }}>
                                            <span className="h-2 w-2 rounded-full" style={{ background: C.teal }} />
                                            <span className="text-sm" style={{ color: C.text }}>Active Team: {activeTeam.team_name}</span>
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={SENTIMENT_SURFACE.negative}>
                                            <ShieldAlert size={14} />
                                            <span className="text-sm font-medium">No Team Selected</span>
                                        </div>
                                    )}
                                    <div className="flex p-1 rounded-lg border" style={{ background: C.bgSub, borderColor: C.border }}>
                                        <button
                                            onClick={() => setMode('mic')}
                                            disabled={isRecording}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'mic' ? 'shadow-sm' : ''}`}
                                            style={mode === 'mic' ? { background: C.card, color: C.text, border: `1px solid ${C.border}` } : { color: C.textDim }}
                                        >
                                            <Mic size={14} /> Browser
                                        </button>
                                        <button
                                            onClick={() => setMode('desktop')}
                                            disabled={isRecording}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'desktop' ? 'shadow-sm' : ''}`}
                                            style={mode === 'desktop' ? { background: C.card, color: C.text, border: `1px solid ${C.border}` } : { color: C.textDim }}
                                        >
                                            <Monitor size={14} /> Desktop
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2" style={{ color: C.text }}>
                                    <Mic size={20} style={{ color: C.text }} />
                                    Start Live Recording
                                </h3>
                                <p className="text-sm mb-6" style={{ color: C.textDim }}>Capture a new meeting with real-time dynamics and sentiment analysis.</p>
                                <div className="flex justify-center w-full">
                                    <div className="flex flex-col items-center gap-2">
                                        {!isRecording ? (
                                            <button
                                                onClick={startRecording}
                                                disabled={isProcessing || !activeTeam}
                                                className="h-16 w-16 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                style={{ background: C.teal, color: C.white }}
                                            >
                                                <Mic size={28} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={stopRecording}
                                                className="h-16 w-16 rounded-full flex items-center justify-center animate-pulse transition-all"
                                                style={{ background: C.red, color: C.white, boxShadow: `0 0 20px ${C.red}4d` }}
                                            >
                                                <Square size={28} />
                                            </button>
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.text }}>
                                            {isRecording ? 'STOP RECORDING' : 'START RECORDING'}
                                        </span>
                                    </div>
                                </div>
                                {mode === 'desktop' && activeTeam && (
                                    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                                        <div className="flex gap-3 text-sm" style={{ color: C.textDim }}>
                                            <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: C.teal }} />
                                            <p>To record external apps like Zoom or Teams, select <strong>Entire Screen</strong> in the popup and check <strong>Share System Audio</strong>.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isProcessing && (
                                <div className="flex flex-col items-center justify-center py-24 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                                    <Loader2 className="animate-spin mb-4" size={56} style={{ color: C.teal }} />
                                    <p className="text-xl font-semibold mt-4" style={{ color: C.text }}>Processing Analysis...</p>
                                    <p className="mt-2" style={{ color: C.textDim }}>Diving deep into your conversation dynamics</p>
                                </div>
                            )}

                            {/* Live Meetings list - below recording section */}
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: C.text }}>
                                    <History size={18} style={{ color: C.text }} />
                                    Live Meetings
                                </h3>

                                <div className="space-y-3">
                                    {loadingHistory ? (
                                        <div className="p-12 flex flex-col items-center gap-3" style={{ color: C.textDim }}>
                                            <Loader2 className="animate-spin" size={24} style={{ color: C.teal }} />
                                            <span className="text-xs font-medium">Fetching History...</span>
                                        </div>
                                    ) : recentMeetings.length > 0 ? (
                                        (() => {
                                            const totalPages = Math.ceil(recentMeetings.length / meetingsPerPage);
                                            const startIdx = (meetingListPage - 1) * meetingsPerPage;
                                            const paginatedMeetings = recentMeetings.slice(startIdx, startIdx + meetingsPerPage);
                                            return (
                                                <>
                                                    {paginatedMeetings.map((m) => (
                                                        <div
                                                            key={m.id}
                                                            className={`flex items-center gap-4 p-4 rounded-xl hover-bg transition-all group relative`}
                                                            style={{ border: `1px solid ${C.border}`, background: result && (result as any).id === m.id ? C.tealDeep : C.bgSub, ...(result && (result as any).id === m.id ? { boxShadow: `inset 0 0 0 1px ${C.teal}` } : {}) }}
                                                        >
                                                            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: C.tealDeep, color: C.teal }}>
                                                                <FileText size={20} />
                                                            </div>
                                                            <div className="flex-1 min-w-0" onClick={() => loadMeeting(m.id)}>
                                                                {editingId === m.id ? (
                                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                        <input
                                                                            autoFocus
                                                                            className="rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1"
                                                                            style={{ border: `1px solid ${C.border}`, color: C.text, background: C.input }}
                                                                            value={editingTitle}
                                                                            onChange={(e) => setEditingTitle(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleRename(m.id, editingTitle);
                                                                                if (e.key === 'Escape') setEditingId(null);
                                                                            }}
                                                                        />
                                                                        <button onClick={() => handleRename(m.id, editingTitle)} style={{ color: C.teal }}><Check size={16} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <h4 className="text-sm font-semibold transition-colors line-clamp-1 cursor-pointer" style={{ color: C.text }}>
                                                                            {m.title || `Session ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                                        </h4>
                                                                        <span className="text-xs mt-0.5 block" style={{ color: C.textDim }}>
                                                                            {new Date(m.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span
                                                                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                                                                    style={m.dominant_tone?.includes('Positive')
                                                                        ? SENTIMENT_SURFACE.positive
                                                                        : m.dominant_tone?.includes('Negative')
                                                                            ? SENTIMENT_SURFACE.negative
                                                                            : SENTIMENT_SURFACE.neutral}
                                                                >
                                                                    {m.dominant_tone?.replace('Mostly ', '') || 'NEUTRAL'}
                                                                </span>
                                                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1" style={{ background: C.tealDeep, color: C.teal }}>
                                                                    <Check size={12} /> SAVED
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingId(m.id); setEditingTitle(m.title || "Meeting"); }} className="p-1.5 hover-bg rounded" style={{ color: C.textDim }}><Pencil size={14} /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-1.5 rounded transition-colors" style={{ color: C.textDim, background: 'transparent' }}><Trash2 size={14} style={{ color: C.red }} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {totalPages > 1 && (
                                                        <div className="flex items-center justify-between pt-4 text-sm" style={{ color: C.textDim }}>
                                                            <span>Showing {startIdx + 1} to {Math.min(startIdx + meetingsPerPage, recentMeetings.length)} of {recentMeetings.length} meetings</span>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => setMeetingListPage(p => Math.max(1, p - 1))} disabled={meetingListPage === 1} className="px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover-bg" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.textSec }}>Previous</button>
                                                                <span className="px-3 py-1.5" style={{ color: C.textSec }}>Page {meetingListPage} of {totalPages}</span>
                                                                <button onClick={() => setMeetingListPage(p => Math.min(totalPages, p + 1))} disabled={meetingListPage === totalPages} className="px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover-bg" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.textSec }}>Next</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <div className="p-12 text-center space-y-3 rounded-xl" style={{ border: `1px solid ${C.border}`, background: C.bgSub }}>
                                            <FileText size={40} className="mx-auto" style={{ color: C.textDim }} />
                                            <p className="text-sm font-medium" style={{ color: C.textDim }}>No meeting history for this team yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowUploadModal(false)}
                            className="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors hover-bg"
                            style={{ background: C.bgSub, color: C.text }}
                        >
                        </button>
                        <FileUpload />
                    </div>
                </div>
            )}
        </div >
    );
};

export default MeetingIntelligence;
