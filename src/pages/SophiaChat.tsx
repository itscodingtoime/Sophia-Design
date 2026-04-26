/**
 * SophiaChat -- AI Coach chat page (app landing page).
 *
 * Full chat interface with:
 * - Message area with markdown rendering (brief cards visually distinct)
 * - Voice input via Web Speech API
 * - DB-backed consent card (4 toggles, gates chat)
 * - Right rail: YOUR GOALS (up to 3 goal cards, Change Goals, Save Goals), WORKING ON (3 numbered items), Latest Insight (green dot + inline expand), Recent Insights (tabbed: Weeks/Months/Quarters)
 * - Persistent session auto-loaded (no session list)
 * - Notification badge for unread observations
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useOrganizationList } from '@clerk/clerk-react';
import { MessageCircle, TrendingUp, Target, Users, BarChart3, Calendar } from 'lucide-react';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import { SophiaWhiteOrb } from '../components/orbs';
import { SophiaGlowOrb } from '../components/SophiaGlowOrb';
import sophiaOrbMark from '../assets/sophia-orbmark.png';
import sophiaWordmarkWhite from '../assets/sophia-wordmark-white.png';
import sophiaWordmarkBlack from '../assets/sophia-wordmark-black.png';
import {
  getProfile,
  sendMessage,
  sendMessageStream,
  getSessionMessages,
  startSession,
  updatePreference,
  clearSessionHistory,
  getRailInsights,
  getConsentStatus,
  grantConsent,
  getCalibration,
  saveCalibration,
  type CoachProfile,
  type CoachMessage,
  type RailInsightCard,
  type ConsentStatus,
  type CalibrationSettings,
  type SSEEvent,
} from '../services/coach';
import { ConsentGate } from '../components/coaching/ConsentGate';
import { CalibrationFlow } from '../components/coaching/CalibrationFlow';
import {
  getUnreadNotifications,
  markNotificationRead,
} from '../services/api';
import { EmptyStateCard } from '../components/composition/EmptyStateCard';
import { CommitmentCard } from '../components/coaching/CommitmentCard';
import { InsightCard } from '../components/coaching/InsightCard';
import { CommitmentProposal } from '../components/coaching/CommitmentProposal';
import { InsightProposal } from '../components/coaching/InsightProposal';

// ─── Constants ───

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PROMPT_SUGGESTIONS = [
  { title: 'Debrief my last meeting', icon: MessageCircle },
  { title: 'What should I focus on?', icon: TrendingUp },
  { title: 'Work on my growth edge', icon: Target },
  { title: 'Team dynamics overview', icon: Users },
  { title: 'How am I progressing?', icon: BarChart3 },
  { title: 'Prepare for my next meeting', icon: Calendar },
];

type ConsentState = { recording: boolean; patterns: boolean; coaching: boolean; aggregation: boolean };

interface ChatMsg {
  from: 'user' | 'sophia';
  text: string;
  time: string;
  messageType?: 'regular' | 'brief' | 'proactive_opener';
  meetingId?: number | null;
}

// ─── Proposal parser (exported for testing) ───

export function parseProposals(content: string): {
  textContent: string;
  proposals: Array<{
    type: 'commitment' | 'insight';
    data: Record<string, unknown>;
  }>;
} {
  const proposals: Array<{ type: 'commitment' | 'insight'; data: Record<string, unknown> }> = [];
  let textContent = content;

  // Parse [COMMITMENT_PROPOSAL]{...JSON...}
  const commitmentRegex = /\[COMMITMENT_PROPOSAL\](\{[^}]+\})/g;
  let match;
  while ((match = commitmentRegex.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      proposals.push({ type: 'commitment', data });
      textContent = textContent.replace(match[0], '');
    } catch { /* skip malformed JSON */ }
  }

  // Parse [INSIGHT_PROPOSAL]{...JSON...}
  const insightRegex = /\[INSIGHT_PROPOSAL\](\{[^}]+\})/g;
  while ((match = insightRegex.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      proposals.push({ type: 'insight', data });
      textContent = textContent.replace(match[0], '');
    } catch { /* skip malformed JSON */ }
  }

  return { textContent: textContent.trim(), proposals };
}

// ─── Consent helpers ───

async function fetchConsent(token: string | null): Promise<ConsentState & { all_accepted: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/users/consent`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch consent');
  return res.json();
}

async function postConsent(token: string | null, body: ConsentState): Promise<ConsentState & { all_accepted: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/users/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update consent');
  return res.json();
}

// ─── Toggle component ───

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{
        width: 44, height: 24, borderRadius: 12, padding: 2,
        background: on ? C.teal : C.border,
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        transform: on ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ─── SophiaChat ───

export default function SophiaChat() {
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshSessions } = useOutletContext<{ refreshSessions: () => Promise<void> }>();
  const { getApiToken, organization } = useSophiaAuth();
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });
  // All orgs the user belongs to — IDs + names for cross-team queries
  const allOrgs = (userMemberships?.data || [])
    .map(m => ({ id: m.organization?.id, name: m.organization?.name }))
    .filter((o): o is { id: string; name: string } => !!o.id && !!o.name);

  // Session -- multi-session via URL params
  const sessionIdFromUrl = searchParams.get('session');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionIdFromUrl);

  // Chat state
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);

  // Plan 22-07 streaming state — identifies the currently-streaming assistant
  // message (so only that row shows the blinking cursor + tool chips).
  const [streamingIndex, setStreamingIndex] = useState<number | null>(null);
  const [activeTools, setActiveTools] = useState<Array<{ name: string; id: string; resolved: boolean }>>([]);
  const streamingTextRef = useRef('');

  // Voice state
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');

  // Right rail
  const [showPanel, setShowPanel] = useState(true);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // Rail insights (new)
  const [railInsights, setRailInsights] = useState<RailInsightCard[]>([]);
  const [railInsightsLoading, setRailInsightsLoading] = useState(true);
  const [insightPeriod, setInsightPeriod] = useState<'weeks' | 'months' | 'quarters'>('weeks');
  // Inline expansion for Latest Insight (replaces modal -- BUG-51 fix)
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [insightModalText, setInsightModalText] = useState<string | null>(null);

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);

  // Remember conversation history (auto-resync) — persisted to localStorage
  const [rememberHistory, setRememberHistory] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('sophia_remember_history');
    return stored === null ? true : stored === 'true';
  });

  // Editable fields
  const [pendingGoals, setPendingGoals] = useState<Array<{ title: string; description: string }> | null>(null);
  const [savingGoals, setSavingGoals] = useState(false);
  const [editingWorking, setEditingWorking] = useState(false);
  const [workingDraft, setWorkingDraft] = useState('');

  // Consent (legacy -- kept for backwards compat)
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({ recording: true, patterns: true, coaching: true, aggregation: true });
  const [consentLoading, setConsentLoading] = useState(false);

  // Coaching consent (Phase 20 -- new inline consent gate)
  const [coachingConsent, setCoachingConsent] = useState<ConsentStatus | null>(null);
  const [coachingConsentChecked, setCoachingConsentChecked] = useState(false);
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  // Commitment/Insight rail refresh
  const [railToken, setRailToken] = useState<string | null>(null);
  const [, setForceRender] = useState(0);
  const commitmentRefreshKey = useRef(0);
  const insightRefreshKey = useRef(0);
  const forceUpdate = () => setForceRender(n => n + 1);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSendRef = useRef(false);
  const skipMsgFetchRef = useRef(false);

  // ─── Fetch token for right rail components ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getApiToken();
        if (!cancelled && t) setRailToken(t);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // ─── Load consent on mount ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = localStorage.getItem('sophia_consent_accepted');
      if (cached === 'true') {
        setConsentAccepted(true);
      }

      try {
        const token = await getApiToken();
        const status = await fetchConsent(token);
        if (cancelled) return;
        if (status.all_accepted) {
          setConsentAccepted(true);
          localStorage.setItem('sophia_consent_accepted', 'true');
        } else {
          setConsentAccepted(false);
          localStorage.removeItem('sophia_consent_accepted');
          setConsent({
            recording: status.recording,
            patterns: status.patterns,
            coaching: status.coaching,
            aggregation: status.aggregation,
          });
        }
      } catch {
        if (!cancelled && cached !== 'true') {
          setConsentAccepted(false);
        }
      } finally {
        if (!cancelled) setConsentChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // ─── Load coaching consent + calibration (Phase 20) ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getConsentStatus();
        if (!cancelled) {
          setCoachingConsent(status);
          setCoachingConsentChecked(true);
        }
      } catch {
        if (!cancelled) {
          setCoachingConsentChecked(true);
          // If endpoint unavailable, assume no consent yet
          setCoachingConsent({ consented: false, granted_at: null, revoked_at: null });
        }
      }

      try {
        const cal = await getCalibration();
        if (!cancelled) setCalibrationDone(cal.calibration_completed);
      } catch {
        // Calibration endpoint may not exist yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load coach profile ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (!cancelled) setCoachProfile(profile);
      } catch {
        // Profile may not exist yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load rail insights when period changes ───
  useEffect(() => {
    let cancelled = false;
    setRailInsightsLoading(true);
    (async () => {
      try {
        const data = await getRailInsights(insightPeriod);
        if (!cancelled) setRailInsights(data.insights);
      } catch {
        // No data available
      } finally {
        if (!cancelled) setRailInsightsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [insightPeriod]);

  // ─── Sync activeSessionId with URL param changes ───
  useEffect(() => {
    setActiveSessionId(sessionIdFromUrl);
  }, [sessionIdFromUrl]);

  // ─── Poll unread notifications every 30s ───
  useEffect(() => {
    let cancelled = false;
    const fetchNotifications = async () => {
      try {
        const token = await getApiToken();
        const data = await getUnreadNotifications(token);
        if (!cancelled) setUnreadCount(data.count);
      } catch {
        // Silently fail
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    // Also poll on window focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [getApiToken]);

  // ─── Mark notifications as read when chat is opened ───
  useEffect(() => {
    if (!activeSessionId || unreadCount === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        const data = await getUnreadNotifications(token);
        if (cancelled) return;
        for (const n of data.notifications) {
          await markNotificationRead(n.id, token);
        }
        if (!cancelled) setUnreadCount(0);
      } catch {
        // Silently fail
      }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId, getApiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load messages when session changes ───
  useEffect(() => {
    if (!activeSessionId) {
      setMsgs([]);
      return;
    }
    if (skipMsgFetchRef.current) {
      skipMsgFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setMsgsLoading(true);
    (async () => {
      try {
        const data = await getSessionMessages(activeSessionId);
        if (cancelled) return;
        const mapped = data.messages.map((m: CoachMessage) => ({
          from: (m.role === 'assistant' ? 'sophia' : 'user') as 'sophia' | 'user',
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          messageType: (m.message_type || 'regular') as 'regular' | 'brief' | 'proactive_opener',
          meetingId: m.meeting_id,
        }));
        setMsgs(mapped);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        setMsgs([]);
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId]);

  // ─── Auto-scroll ───
  useEffect(() => {
    const t = setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [msgs, isTyping]);

  // ─── Plan 22-07: streaming message helper (used by both send paths) ───
  const streamToSophia = useCallback(async (sid: string, text: string) => {
    // Append placeholder assistant message that we'll update token-by-token.
    let placeholderIndex = -1;
    setMsgs(m => {
      placeholderIndex = m.length;
      return [...m, { from: 'sophia', text: '', time: 'now' }];
    });
    streamingTextRef.current = '';
    setStreamingIndex(placeholderIndex);
    setActiveTools([]);

    let streamOk = false;
    try {
      await sendMessageStream(
        sid,
        text,
        (event: SSEEvent) => {
          switch (event.type) {
            case 'status':
              // no-op — typing indicator already shown via streamingIndex
              break;
            case 'text_delta': {
              streamOk = true;
              streamingTextRef.current += String(event.payload);
              const next = streamingTextRef.current;
              setMsgs(m => {
                const copy = m.slice();
                if (placeholderIndex >= 0 && placeholderIndex < copy.length) {
                  copy[placeholderIndex] = { ...copy[placeholderIndex], text: next };
                }
                return copy;
              });
              // Auto-scroll into view
              endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              break;
            }
            case 'tool_use': {
              streamOk = true;
              const p = event.payload as { name: string; id: string };
              setActiveTools(prev => [...prev, { name: p.name, id: p.id, resolved: false }]);
              break;
            }
            case 'tool_result': {
              const p = event.payload as { tool_use_id: string; ok: boolean };
              setActiveTools(prev =>
                prev.map(t => (t.id === p.tool_use_id ? { ...t, resolved: true } : t)),
              );
              break;
            }
            case 'done':
              streamOk = true;
              break;
            case 'error': {
              const p = event.payload as { message: string };
              console.warn('Stream error event:', p.message);
              streamOk = true; // stream started OK, endpoint just failed mid-flight
              setMsgs(m => {
                const copy = m.slice();
                if (placeholderIndex >= 0 && placeholderIndex < copy.length) {
                  const priorText = copy[placeholderIndex].text;
                  copy[placeholderIndex] = {
                    ...copy[placeholderIndex],
                    text: priorText || "I hit an error mid-response. Please try again.",
                  };
                }
                return copy;
              });
              break;
            }
          }
        },
        organization?.name || undefined,
        allOrgs,
      );
    } catch (streamErr: any) {
      if (streamOk) {
        // Stream started then failed → keep whatever text we got
        console.warn('Stream aborted after start:', streamErr?.message || streamErr);
      } else {
        // Stream never started → fall back to non-streaming sendMessage
        try {
          const response = await sendMessage(sid, text, organization?.name || undefined, allOrgs);
          setMsgs(m => {
            const copy = m.slice();
            if (placeholderIndex >= 0 && placeholderIndex < copy.length) {
              copy[placeholderIndex] = { ...copy[placeholderIndex], text: response.response };
            }
            return copy;
          });
        } catch (fallbackErr: any) {
          const msg = fallbackErr?.message?.includes('Clerk session unavailable')
            ? 'Please sign in again to continue.'
            : fallbackErr?.message?.includes('Failed to get auth token')
              ? 'Authentication expired. Please refresh the page.'
              : "I'm having trouble connecting right now. Please try again.";
          setMsgs(m => {
            const copy = m.slice();
            if (placeholderIndex >= 0 && placeholderIndex < copy.length) {
              copy[placeholderIndex] = { ...copy[placeholderIndex], text: msg };
            }
            return copy;
          });
        }
      }
    } finally {
      setStreamingIndex(null);
      setActiveTools([]);
    }
  }, [organization, allOrgs]);

  // ─── Send message ───
  const send = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    setMsgs(m => [...m, { from: 'user', text, time: 'now' }]);
    setIsTyping(true);

    try {
      let sid = activeSessionId;

      // If no active session, create one
      if (!sid) {
        const newSession = await startSession('sophia', 'coaching');
        sid = newSession.id;
        setActiveSessionId(sid);
        // Update URL to include session ID (without full navigation)
        window.history.replaceState(null, '', `/chat?session=${sid}`);
        // Refresh sidebar sessions
        refreshSessions();
      }

      await streamToSophia(sid, text);

      // Refresh sessions to pick up title changes (after 3rd message)
      refreshSessions();
    } catch (err: any) {
      console.error('Coach API error:', err?.message || err);
      const errorMsg = err?.message?.includes('Clerk session unavailable')
        ? "Please sign in again to continue."
        : err?.message?.includes('Failed to get auth token')
        ? "Authentication expired. Please refresh the page."
        : "I'm having trouble connecting right now. Please try again.";
      setMsgs(m => [...m, { from: 'sophia', text: errorMsg, time: 'now' }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, activeSessionId, refreshSessions, streamToSophia]);

  // ─── Start with prompt suggestion ───
  const startWithPrompt = useCallback(async (prompt: string) => {
    setMsgs([{ from: 'user', text: prompt, time: 'now' }]);
    setIsTyping(true);
    try {
      let sid = activeSessionId;

      // If no active session, create one
      if (!sid) {
        const newSession = await startSession('sophia', 'coaching');
        sid = newSession.id;
        skipMsgFetchRef.current = true;
        setActiveSessionId(sid);
        window.history.replaceState(null, '', `/chat?session=${sid}`);
        refreshSessions();
      }

      await streamToSophia(sid, prompt);
      refreshSessions();
    } catch (err: any) {
      console.error('Coach API error (prompt):', err?.message || err);
      const errorMsg = err?.message?.includes('Clerk session unavailable')
        ? "Please sign in again to continue."
        : err?.message?.includes('Failed to get auth token')
        ? "Authentication expired. Please refresh the page."
        : "I'm having trouble connecting right now. Please try again.";
      setMsgs(m => [...m, { from: 'sophia', text: errorMsg, time: 'now' }]);
    } finally {
      setIsTyping(false);
    }
  }, [activeSessionId, refreshSessions]);

  // ─── Voice input ───
  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setVoiceMode(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let allFinals = '';
      let currentInterim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          allFinals += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }
      const base = baseTextRef.current;
      const separator = base && !base.endsWith(' ') ? ' ' : '';
      setInput(base + separator + allFinals + currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      setIsListening(false);
      setVoiceMode(false);
    };

    recognition.onend = () => {
      setInput(current => {
        baseTextRef.current = current;
        return current;
      });
      setIsListening(false);
      setVoiceMode(false);
    };

    recognitionRef.current = recognition;
    baseTextRef.current = input;
    recognition.start();
    setIsListening(true);
    setVoiceMode(true);
  }, [isListening]);

  // ─── Consent accept ───
  const handleAcceptConsent = useCallback(async () => {
    if (!consent.recording || !consent.patterns || !consent.coaching || !consent.aggregation) {
      toast.error('All consent toggles must be enabled to use SOPHIA.');
      return;
    }
    setConsentLoading(true);
    try {
      const token = await getApiToken();
      await postConsent(token, consent);
    } catch (err) {
      console.warn('Consent API unavailable, using local storage:', err);
    }
    setConsentAccepted(true);
    localStorage.setItem('sophia_consent_accepted', 'true');
    setConsentLoading(false);
  }, [consent, getApiToken]);

  // ─── Goal handlers ───

  // Auto-send effect: fires send() after setInput is committed when triggered programmatically
  useEffect(() => {
    if (autoSendRef.current && input.trim()) {
      autoSendRef.current = false;
      send();
    }
  }, [input, send]);

  // Trigger goal-setting conversation by injecting a message
  const handleSetGoals = useCallback(() => {
    autoSendRef.current = true;
    setInput("I'd like to set my coaching goals.");
  }, []);

  // Change Goals sends a revisit message in the current session
  const handleChangeGoals = useCallback(() => {
    autoSendRef.current = true;
    setInput("Let's revisit my goals. What's changed in my priorities.");
  }, []);

  // Save confirmed goals to profile via updatePreference
  const handleSaveGoals = useCallback(async () => {
    if (!pendingGoals) return;
    setSavingGoals(true);
    try {
      await updatePreference('goals', pendingGoals);
      const profile = await getProfile();
      setCoachProfile(profile);
      setPendingGoals(null);
      toast.success('Goals saved');
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setSavingGoals(false);
    }
  }, [pendingGoals]);

  const saveWorkingOn = useCallback(async () => {
    setEditingWorking(false);
    if (!workingDraft.trim()) return;
    try {
      await updatePreference('working_on', workingDraft.trim());
      setCoachProfile(prev => prev ? {
        ...prev,
        preferences: {
          ...prev.preferences,
          custom_preferences: {
            ...prev.preferences?.custom_preferences,
            working_on: workingDraft.trim(),
          },
        },
      } : prev);
    } catch (err) {
      console.error('Failed to save working on:', err);
    }
  }, [workingDraft]);

  // ─── Clear history ───
  const handleClearHistory = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await clearSessionHistory(activeSessionId);
      setMsgs([]);
      setConfirmClearHistory(false);
      toast.success('Conversation history cleared');
    } catch (err) {
      console.error('Failed to clear history:', err);
      toast.error('Failed to clear history');
    }
  }, [activeSessionId]);

  // ─── Derived values ───
  const goalText = (coachProfile?.motivation as Record<string, string>)?.goal || '';
  const goalDescription = (coachProfile?.motivation as Record<string, string>)?.goal_description || '';
  const workingOnText = (coachProfile?.preferences?.custom_preferences?.working_on as string) || '';
  const hasGoal = !!goalText;

  // Multi-goal support: reads motivation.goals array, falls back to single goal
  const goals: Array<{ title: string; description: string }> = (() => {
    const motivation = coachProfile?.motivation as Record<string, unknown> | undefined;
    if (!motivation) return [];
    const goalsList = motivation.goals;
    if (Array.isArray(goalsList) && goalsList.length > 0) {
      return (goalsList as Array<{ title: string; description: string }>).slice(0, 3);
    }
    if (goalText) {
      return [{ title: goalText, description: goalDescription }];
    }
    return [];
  })();
  const hasGoals = goals.length > 0;
  const isEmptyState = msgs.length === 0 && !msgsLoading;

  interface WorkingOnItem { title: string; description: string; }
  const workingOnItems: WorkingOnItem[] = (coachProfile?.motivation as Record<string, unknown>)?.working_on_items as WorkingOnItem[] || [];

  // Brief messages for Latest Insight
  const briefMessages = msgs
    .filter(m => m.messageType === 'brief' && m.from === 'sophia')
    .slice(-5)
    .reverse();
  const latestInsight = briefMessages[0] || null;

  // Unread tracking for Latest Insight green dot (localStorage per meeting_id)
  const INSIGHT_READ_KEY = 'sophia_insight_read';
  const isInsightUnread = latestInsight?.meetingId
    ? localStorage.getItem(INSIGHT_READ_KEY) !== String(latestInsight.meetingId)
    : false;

  // ─── Render ───
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* Centre -- Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: C.panelBg }}>

        {/* Top bar — Remember history toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '10px 22px', gap: 10,
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'Tomorrow', sans-serif" }}>
            Remember conversation history
          </span>
          <button
            role="switch"
            aria-checked={rememberHistory}
            aria-label="Toggle remember conversation history"
            onClick={() => {
              const next = !rememberHistory;
              setRememberHistory(next);
              if (typeof window !== 'undefined') localStorage.setItem('sophia_remember_history', String(next));
              toast(next ? 'History on — SOPHIA will keep re-syncing previous chats' : 'History off — this chat starts fresh');
            }}
            style={{
              display: 'inline-flex', alignItems: 'center',
              width: 36, height: 20, borderRadius: 999, padding: 2,
              background: rememberHistory ? C.teal : C.border,
              border: 'none', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transform: rememberHistory ? 'translateX(16px)' : 'translateX(0)',
              transition: 'transform 0.15s',
            }} />
          </button>
          <span style={{
            fontSize: 10, color: rememberHistory ? C.teal : C.textDim,
            fontFamily: "'Tomorrow', sans-serif", fontWeight: 600,
            letterSpacing: 0.6, textTransform: 'uppercase',
            minWidth: 24, textAlign: 'left',
          }}>
            {rememberHistory ? 'on' : 'off'}
          </span>
        </div>

        {/* Coaching consent gate (Phase 20 -- inline chat bubble, replaces old modal overlay) */}
        {coachingConsentChecked && coachingConsent && !coachingConsent.consented && !showCalibration && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
            <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
              <ConsentGate
                onAccept={async () => {
                  const result = await grantConsent();
                  setCoachingConsent(result);
                  setShowCalibration(true);
                  // Also accept legacy consent for backwards compat
                  setConsentAccepted(true);
                  localStorage.setItem('sophia_consent_accepted', 'true');
                }}
                onDecline={() => {
                  // Input stays disabled via coachingConsent.consented check
                }}
              />
              {/* Declined state message */}
              <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: C.textDim, marginTop: 16 }}>
                Enable coaching in Settings to start.
              </div>
            </div>
          </div>
        )}

        {/* Calibration flow (Phase 20 -- after consent acceptance) */}
        {showCalibration && !calibrationDone && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
            <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
              <CalibrationFlow
                onComplete={async (settings) => {
                  try {
                    await saveCalibration(settings as CalibrationSettings);
                    setCalibrationDone(true);
                    setShowCalibration(false);
                  } catch (err) {
                    console.error('Failed to save calibration:', err);
                    toast.error('Could not save coaching style. Try again in a moment.');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Empty state -- prompt suggestions (only when consent granted AND calibration not active) */}
        {isEmptyState && (coachingConsent?.consented || !coachingConsentChecked) && (!showCalibration || calibrationDone) && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            minHeight: 0,
            background: 'transparent',
          }}>
            <div style={{ textAlign: 'center', maxWidth: 720, width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                <SophiaGlowOrb size={220} />
              </div>

              <h1 style={{
                margin: '0 0 22px',
                fontFamily: "'Futura', 'Tomorrow', sans-serif",
                fontSize: 26,
                color: C.text,
                fontWeight: 500,
                letterSpacing: 0.5,
              }}>
                Let's get clarity on something.
              </h1>

              {/* Large input box */}
              <div style={{
                border: `1px solid ${C.border}`, borderRadius: 20,
                background: C.inputBg, padding: 0, marginTop: 0, marginBottom: 20,
                display: 'flex', flexDirection: 'column',
                transition: 'border-color 0.2s',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="What's on your mind?"
                  rows={3}
                  style={{
                    width: '100%', padding: '20px 24px 12px', borderRadius: '20px 20px 0 0',
                    border: 'none', background: 'transparent',
                    color: C.text, fontSize: 15, resize: 'none', outline: 'none',
                    lineHeight: 1.6, fontFamily: "'Tomorrow', sans-serif",
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 16px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={toggleVoice} style={{
                      width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                      background: isListening ? C.tealGlow : 'transparent',
                      border: isListening ? `1px solid ${C.tealBorder}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isListening ? C.teal : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    {input.trim() && (
                      <button onClick={send} style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: C.teal, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.25s',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0C" strokeWidth="2" strokeLinecap="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}>
                {PROMPT_SUGGESTIONS.map((p, i) => (
                  <button key={i} onClick={() => startWithPrompt(p.title)} style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: C.hoverBg,
                    border: `1px solid ${C.border}`,
                    color: C.textDim,
                    fontSize: 13,
                    fontWeight: 400,
                    transition: 'all 0.2s',
                    fontFamily: "'Tomorrow', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left' as const,
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = C.activeBg;
                      e.currentTarget.style.borderColor = C.tealBorder;
                      e.currentTarget.style.color = C.text;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = C.hoverBg;
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.color = C.textDim;
                    }}
                  >
                    <p.icon size={16} style={{ flexShrink: 0 }} />
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active chat -- messages + input */}
        {!isEmptyState && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

            {/* Notification badge banner */}
            {unreadCount > 0 && (
              <div style={{
                padding: '8px 24px',
                background: C.tealGlow,
                borderBottom: `1px solid ${C.tealBorder}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: C.teal, color: '#0A0A0C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {unreadCount}
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  New coaching observation{unreadCount > 1 ? 's' : ''} available
                </span>
              </div>
            )}

            {/* Messages */}
            <div ref={chatScrollRef} className="sophia-chat-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 24px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {msgsLoading && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <div style={{ color: C.textDim, fontSize: 14 }}>Loading messages...</div>
                  </div>
                )}

                {msgs.map((m, i) => {
                  const isBrief = m.messageType === 'brief' && m.from === 'sophia';
                  const isProactiveOpener = m.messageType === 'proactive_opener' && m.from === 'sophia';
                  // Parse proposals only from SOPHIA (assistant) messages
                  const parsed = m.from === 'sophia' ? parseProposals(m.text) : null;
                  const displayText = parsed ? parsed.textContent : m.text;
                  const proposals = parsed?.proposals || [];

                  return (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
                      animation: `fadeSlide 0.35s ease ${Math.min(i * 0.04, 0.3)}s both`,
                      marginBottom: 6,
                    }}>
                      {m.from === 'sophia' && (
                        <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
                          <SophiaWhiteOrb size={28} animate={false} />
                        </div>
                      )}
                      <div style={{
                        maxWidth: '82%',
                        padding:
                          m.from === 'user' ? '12px 18px'
                          : isBrief ? '14px 18px'
                          : isProactiveOpener ? '16px 20px'
                          : '2px 0',
                        borderRadius:
                          m.from === 'user' ? '20px 4px 20px 20px'
                          : isBrief ? 14
                          : isProactiveOpener ? 14
                          : 0,
                        background:
                          m.from === 'user' ? C.headerBg
                          : isBrief ? C.tealGlow
                          : isProactiveOpener ? C.tealGlow
                          : 'transparent',
                        border:
                          m.from === 'user' ? `1px solid ${C.border}`
                          : isBrief ? `1px solid ${C.tealBorder}`
                          : isProactiveOpener ? `1px solid ${C.tealBorder}`
                          : 'none',
                        borderLeft: (isBrief || isProactiveOpener) ? `3px solid ${C.teal}` : undefined,
                        color: C.text, fontSize: 14.5, lineHeight: 1.75,
                      }}>
                        {/* Brief card header */}
                        {isBrief && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginBottom: 8, paddingBottom: 6,
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: C.teal,
                              textTransform: 'uppercase', letterSpacing: 1,
                            }}>
                              Coaching Brief
                            </span>
                          </div>
                        )}
                        {isProactiveOpener && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginBottom: 8, paddingBottom: 6,
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
                            </svg>
                            <span style={{
                              fontSize: 12, fontWeight: 600, color: C.textSec,
                              textTransform: 'uppercase', letterSpacing: 1.5,
                              fontFamily: "'Tomorrow', sans-serif",
                            }}>
                              SOPHIA's thoughts between sessions
                            </span>
                          </div>
                        )}
                        {m.from === 'sophia' && streamingIndex === i && activeTools.length > 0 && (
                          <div style={{
                            display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8,
                          }}>
                            {activeTools.map(tool => (
                              <span
                                key={tool.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  background: C.card,
                                  color: C.textDim,
                                  border: `1px solid ${C.border}`,
                                  fontFamily: "'Tomorrow', sans-serif",
                                }}
                              >
                                <span style={{ color: tool.resolved ? C.teal : C.textDim }}>
                                  {tool.resolved ? '✓' : '⟳'}
                                </span>
                                {tool.name.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.from === 'sophia' ? (
                          <div className="sophia-markdown" style={{ fontSize: 14.5, lineHeight: 1.75, color: C.text }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                            {streamingIndex === i && (
                              <span
                                aria-hidden
                                style={{
                                  display: 'inline-block',
                                  width: 2,
                                  height: '1em',
                                  background: C.teal,
                                  marginLeft: 2,
                                  animation: 'sophiaStreamCursor 1s step-end infinite',
                                  verticalAlign: 'text-bottom',
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                        )}

                        {/* Inline proposal cards (SOPHIA messages only) */}
                        {proposals.map((p, pi) => {
                          if (p.type === 'commitment' && railToken) {
                            return (
                              <CommitmentProposal
                                key={`proposal-${i}-${pi}`}
                                action={String(p.data.action || '')}
                                doneWhen={String(p.data.done_when || '')}
                                dueDate={String(p.data.due_date || '')}
                                sessionId={activeSessionId || undefined}
                                token={railToken}
                                onSaved={() => { commitmentRefreshKey.current += 1; forceUpdate(); }}
                                evidenceQuote={p.data.evidence_quote ? String(p.data.evidence_quote) : undefined}
                                meetingDate={p.data.meeting_date ? String(p.data.meeting_date) : undefined}
                              />
                            );
                          }
                          if (p.type === 'insight' && railToken) {
                            return (
                              <InsightProposal
                                key={`proposal-${i}-${pi}`}
                                observation={String(p.data.observation || '')}
                                sessionId={activeSessionId || undefined}
                                token={railToken}
                                onApproved={() => { insightRefreshKey.current += 1; forceUpdate(); }}
                              />
                            );
                          }
                          return null;
                        })}

                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
                          gap: 4, marginTop: 6,
                        }}>
                          <span style={{ fontSize: 11, color: C.textDim, opacity: 0.6 }}>{m.time}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}>
                    <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
                      <SophiaWhiteOrb size={28} animate />
                    </div>
                    <div style={{ padding: '12px 18px', color: C.textDim, fontSize: 14.5 }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0s' }}>.</span>
                        <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }}>.</span>
                        <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }}>.</span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            {/* Input area */}
            <div style={{
              padding: '12px 24px 20px',
              ...(coachingConsentChecked && coachingConsent && !coachingConsent.consented
                ? { pointerEvents: 'none' as const, opacity: 0.5 }
                : {}),
            }}>
              <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-end',
                  border: `1px solid ${C.border}`, borderRadius: 26,
                  background: C.inputBg, padding: '10px 8px 10px 16px',
                  transition: 'border-color 0.2s',
                }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Talk to SOPHIA..."
                    rows={2}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 0,
                      border: 'none', background: 'transparent',
                      color: C.text, fontSize: 14.5, resize: 'none', outline: 'none',
                      lineHeight: 1.5, fontFamily: "'Tomorrow', sans-serif",
                      minHeight: 44,
                    }}
                  />
                  <button onClick={toggleVoice} style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isListening ? C.tealGlow : 'transparent',
                    border: isListening ? `1px solid ${C.tealBorder}` : 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isListening ? C.teal : C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                  <button onClick={send} disabled={!input.trim()} style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: input.trim() ? C.teal : 'transparent',
                    border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.25s', flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0A0A0C' : C.textDim} strokeWidth="2" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Voice listening indicator */}
                {voiceMode && isListening && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    marginTop: 8, padding: '6px 0',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: C.teal, animation: 'pulse 1.5s ease infinite',
                      boxShadow: `0 0 10px ${C.teal}`,
                    }} />
                    <span style={{ fontSize: 12, color: C.teal, fontWeight: 500 }}>Listening...</span>
                    <button onClick={toggleVoice} style={{
                      fontSize: 11, color: C.red, background: 'rgba(212,90,90,0.08)',
                      border: '1px solid rgba(212,90,90,0.2)', borderRadius: 8,
                      padding: '4px 10px', cursor: 'pointer', fontWeight: 600,
                    }}>
                      Stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel Toggle */}
      <button onClick={() => setShowPanel(!showPanel)} style={{
        position: 'absolute', right: showPanel ? 308 : 8, top: 12, zIndex: 10,
        width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
        background: showPanel ? C.tealGlow : C.card, border: `1px solid ${showPanel ? C.tealBorder : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showPanel ? C.teal : C.textDim} strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>

      {/* Right Panel -- Your Goals + Working On + Latest Insight + Recent Insights */}
      <div style={{
        width: showPanel ? 300 : 0, flexShrink: 0,
        borderLeft: showPanel ? `1px solid ${C.border}` : 'none',
        overflowY: showPanel ? 'auto' : 'hidden',
        background: C.panelBg, transition: 'all 0.35s ease',
        padding: showPanel ? '24px 20px' : '24px 0',
        opacity: showPanel ? 1 : 0,
      }}>
        {/* Clear History button */}
        {activeSessionId && msgs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {!confirmClearHistory ? (
              <button
                onClick={() => setConfirmClearHistory(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.textDim, fontSize: 11, fontWeight: 500,
                  fontFamily: "'Tomorrow', sans-serif", transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.tealBorder; e.currentTarget.style.color = C.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Clear History
              </button>
            ) : (
              <div style={{
                padding: '12px', borderRadius: 10,
                background: C.hoverBg, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 12, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>
                  Clear your conversation history? SOPHIA will start fresh but remember your preferences.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleClearHistory} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                    background: C.teal, border: 'none',
                    color: '#0A0A0C', fontSize: 11, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  }}>Clear</button>
                  <button onClick={() => setConfirmClearHistory(false)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.textDim, fontSize: 11, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Intentions — auto-derived from conversation history */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 18,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, color: C.textDim, textTransform: 'uppercase', marginBottom: 8, fontFamily: "'Tomorrow', sans-serif", fontWeight: 600 }}>
            Intentions
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginBottom: 14, fontFamily: "'Tomorrow', sans-serif" }}>
            These are your intentions from what I've picked up on conversation history.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {(goals && goals.length > 0 ? goals : [
              { title: 'Slow the proposal beat', description: 'One more breath before suggesting a solution.' },
              { title: 'Make recognition visible', description: 'Specific, named appreciation for Sara and Priya.' },
              { title: 'Return to parked threads', description: 'Revisit before closing the meeting.' },
            ]).map((g, i) => (
              <div key={i} style={{
                background: C.tealGlow,
                border: `1px solid ${C.tealBorder}`,
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.4, fontFamily: "'Tomorrow', sans-serif" }}>{g.title}</div>
                {g.description && (
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4, lineHeight: 1.5, fontFamily: "'Tomorrow', sans-serif" }}>
                    {g.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleChangeGoals}
            style={{
              width: '100%',
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.text,
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            Change intentions
          </button>
        </div>

      </div>

      {/* Insight Modal */}
      {insightModalText && (
        <div
          onClick={() => setInsightModalText(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: 560, maxHeight: '80vh',
              background: C.card, borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: '28px 24px', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: 1 }}>
                Coaching Insight
              </div>
              <div
                onClick={() => setInsightModalText(null)}
                style={{ fontSize: 13, fontWeight: 600, color: C.textDim, cursor: 'pointer' }}
              >
                Close
              </div>
            </div>
            <div className="sophia-markdown" style={{ fontSize: 14, color: C.text, lineHeight: 1.8 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insightModalText}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
