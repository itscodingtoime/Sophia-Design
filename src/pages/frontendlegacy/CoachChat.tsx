/**
 * AI Coach Chat Page
 * 
 * Simplified experience - no upfront track selection.
 * Session auto-created on first message using profile defaults.
 * ChatWidget and CoachChat share the same session/history.
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Send, Loader2, History, X, Bot, User, Check, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { C } from '../theme';
import { SophiaPageHeader } from '../components/composition';
import { Skeleton } from '../components/ui/skeleton';
import {
    checkProfileExists,
    getProfile,
    startSession,
    sendMessage,
    listSessions,
    getSessionMessages,
    type CoachSession,
    type CoachProfile,
    type MessageResponse,
    type TrackType,
    type ModeType,
} from '../services/coach';

const CoachSettingsPanel = lazy(() => import('./CoachSettings'));

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export default function CoachChat() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<CoachProfile | null>(null);
    const [session, setSession] = useState<CoachSession | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sessions, setSessions] = useState<CoachSession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load session messages
    const loadSessionMessages = useCallback(async (sessionId: string) => {
        try {
            const data = await getSessionMessages(sessionId);
            setSession({
                id: data.session_id,
                track: data.track,
                mode: data.mode,
                started_at: '',
                message_count: data.messages.length,
            });
            setMessages(data.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                created_at: m.created_at,
            })));
        } catch (e) {
            console.error('Failed to load session messages:', e);
        }
    }, []);

    // Initialize: check profile, load sessions, handle session parameter
    useEffect(() => {
        async function init() {
            try {
                // Check profile exists
                const { has_completed_onboarding } = await checkProfileExists();
                if (!has_completed_onboarding) {
                    navigate('/chat/onboarding');
                    return;
                }

                // Load full profile for defaults
                const profileData = await getProfile();
                setProfile(profileData);

                // Load session history
                const sessionList = await listSessions();
                setSessions(sessionList);

                // Check for session_id in URL (shared from widget)
                const sessionIdParam = searchParams.get('session');
                if (sessionIdParam) {
                    await loadSessionMessages(sessionIdParam);
                } else if (sessionList.length > 0) {
                    // Resume most recent session if within 24h
                    const latest = sessionList[0];
                    const sessionAge = Date.now() - new Date(latest.started_at).getTime();
                    const twentyFourHours = 24 * 60 * 60 * 1000;

                    if (sessionAge < twentyFourHours) {
                        await loadSessionMessages(latest.id);
                    }
                }

                setLoading(false);
            } catch (e) {
                console.error('Init failed:', e);
                navigate('/chat/onboarding');
            }
        }
        init();
    }, [navigate, searchParams, loadSessionMessages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when ready
    useEffect(() => {
        if (!loading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [loading]);

    useEffect(() => {
        if (activeTab === 'settings') {
            setShowHistory(false);
        }
    }, [activeTab]);

    // Get default track/mode from profile
    const getDefaultTrackAndMode = (): { track: TrackType; mode: ModeType } => {
        // Use profile preferences if available
        const profileData = profile?.profile as Record<string, unknown> | undefined;
        const defaultTrack = (profileData?.default_track as TrackType) || 'performance';

        // Always start in support mode (user can change later)
        const defaultMode: ModeType = 'support';

        return { track: defaultTrack, mode: defaultMode };
    };

    const handleSend = async () => {
        if (!input.trim() || sending) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSending(true);

        try {
            let currentSession = session;

            // Auto-create session on first message using profile defaults
            if (!currentSession) {
                const { track, mode } = getDefaultTrackAndMode();
                currentSession = await startSession(track, mode);
                setSession(currentSession);

                // Add to sessions list
                setSessions(prev => [currentSession!, ...prev]);
            }

            const response: MessageResponse = await sendMessage(currentSession.id, userMessage.content);

            setMessages(prev => [...prev, {
                id: response.id,
                role: 'assistant',
                content: response.response,
                created_at: new Date().toISOString(),
            }]);

            // Update session mode if it changed
            if (response.mode !== currentSession.mode) {
                setSession(prev => prev ? { ...prev, mode: response.mode } : null);
            }

        } catch (e) {
            console.error('Failed to send message:', e);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                created_at: new Date().toISOString(),
            }]);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startNewSession = () => {
        setSession(null);
        setMessages([]);
        setShowHistory(false);
    };

    const loadSession = async (s: CoachSession) => {
        await loadSessionMessages(s.id);
        setShowHistory(false);
    };

    const toggleSessionExpanded = (sessionId: string) => {
        setExpandedSessions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sessionId)) {
                newSet.delete(sessionId);
            } else {
                newSet.add(sessionId);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="flex-1 space-y-8">
                <SophiaPageHeader title="AI Coach" />
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8">
            <div className="flex flex-col gap-4">
                <SophiaPageHeader title="AI Coach" />
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as 'chat' | 'settings')}
                >
                    <TabsList>
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="chat" className="mt-6 flex-1 flex flex-col min-h-0">
                        <div className="flex flex-col h-full min-h-0 rounded-lg overflow-hidden shadow-sm px-4 sm:px-6 py-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                            <div className="flex items-center justify-end pb-4">
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`flex items-center gap-2 p-2 rounded-lg transition ${
                                        showHistory
                                            ? ''
                                            : 'hover-bg'
                                    }`}
                                    style={showHistory ? { color: C.teal, background: C.tealDeep } : { color: C.textSec }}
                                    title="Session history"
                                >
                                    <History className="w-5 h-5" />
                                    <span className="font-medium">History</span>
                                </button>
                            </div>
                        {/* History Sidebar */}
                        <div
                            className={`fixed top-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
                                showHistory ? 'translate-x-0' : 'translate-x-full'
                            }`}
                            style={{ top: '8rem', height: 'calc(100vh - 8rem)' }}
                        >
                            <div className="flex flex-col h-full">
                                {/* Sidebar Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-900">Session History</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={startNewSession}
                                            className="text-xs px-3 py-1.5 rounded-md transition hover-teal"
                                            style={{ background: C.teal, color: C.white }}
                                        >
                                            + New
                                        </button>
                                        <button
                                            onClick={() => setShowHistory(false)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Sidebar Content */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {sessions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                            <History className="w-12 h-12 text-gray-300 mb-3" />
                                            <p className="text-sm text-gray-400">No previous sessions</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {sessions.map(s => {
                                                const isActive = session?.id === s.id;

                                                return (
                                                    <div
                                                        onClick={() => loadSession(s)}
                                                        key={s.id}
                                                        className={`rounded-lg border transition ${
                                                            isActive
                                                                ? 'bg-green-50 border-green-300'
                                                                : 'bg-white border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <button
                                                            onClick={() => toggleSessionExpanded(s.id)}
                                                            className="w-full text-left p-3 flex items-center justify-between hover:bg-gray-50 rounded-t-lg transition"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-sm font-medium text-gray-900 capitalize truncate">
                                                                        {s.track}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                                                        {s.message_count} msgs
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {new Date(s.started_at).toLocaleDateString()} · {s.mode} mode
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Overlay */}
                        {showHistory && (
                            <div
                                className="fixed z-40 transition-opacity duration-300"
                                style={{ top: '8rem', left: 0, right: 0, bottom: 0 }}
                                onClick={() => setShowHistory(false)}
                            />
                        )}

                        {/* Messages- scrollable */}
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                            <div className="space-y-6">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                        <Sparkles className="w-12 h-12 text-gray-400 mb-4" />
                                        <h2 className="text-xl font-medium text-gray-900 mb-2">What's on your mind?</h2>
                                        <p className="text-gray-500 max-w-md">
                                            I can help with meeting analysis, communication strategies,
                                            leadership challenges, or anything else you're working on.
                                        </p>
                                    </div>
                                )}

                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1" style={{ background: C.teal }}>
                                                <Bot className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                        <div className="flex flex-col max-w-[75%]">
                                            <div
                                                className={`rounded-xl px-4 py-3 ${msg.role === 'user'
                                                        ? 'rounded-br-sm'
                                                        : 'rounded-bl-sm'
                                                    }`}
                                                style={{
                                                    background: msg.role === 'user' ? C.chatBubbleUser : C.chatBubbleSophia,
                                                    color: msg.role === 'user' ? C.text : C.text,
                                                }}
                                            >
                                                <div className={`prose prose-sm max-w-none ${msg.role === 'user'
                                                        ? 'prose-p:text-gray-900 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-800'
                                                        : 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-green-100 prose-invert'
                                                    } prose-p:leading-relaxed`}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {msg.role === 'user' && (
                                                    <Check className="w-3 h-3 text-gray-400" />
                                                )}
                                            </div>
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                                                <User className="w-5 h-5 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Typing indicator */}
                                {sending && (
                                    <div className="flex items-end gap-2 justify-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1" style={{ background: C.teal }}>
                                            <Bot className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="rounded-xl rounded-bl-sm px-4 py-3" style={{ background: C.chatBubbleSophia }}>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input */}
                        <div className="flex-shrink-0 p-1 rounded-3xl" style={{ background: C.inputBg }}>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="What would you like to know?"
                                    className="flex-1 px-4 py-3 rounded-xl bg-gray-100 border-0 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending}
                                    className="w-12 h-12 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 hover-teal"
                                    style={{ background: C.teal, color: C.white }}
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                    <TabsContent value="settings" className="mt-6">
                        <Suspense fallback={<div className="py-20 text-center text-gray-500">Loading settings...</div>}>
                            <CoachSettingsPanel />
                        </Suspense>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
