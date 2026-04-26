/**
 * Performance Co-Pilot Chat Widget
 * 
 * Features:
 * - Floating Action Button (FAB) launcher
 * - Popover chat window
 * - Markdown Rendering (Aesthetic Mode)
 * - Optimistic UI updates
 * - Coach profile integration
 * - UNIFIED with CoachChat page (shares same backend sessions)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Sparkles, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    checkProfileExists,
    startSession,
    sendMessage,
    listSessions,
    getSessionMessages,
    type CoachSession,
    type TrackType,
} from '../../services/coach';

// ============================================================================
// Types
// ============================================================================

interface LocalMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isOptimistic?: boolean;
}

// Default track for quick-start from widget
const DEFAULT_TRACK: TrackType = 'performance';

// ============================================================================
// ChatWidget Component
// ============================================================================

export const ChatWidget = () => {
    const { isSignedIn } = useAuth();
    const navigate = useNavigate();

    // Widget state
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [currentTrack, setCurrentTrack] = useState<TrackType>(DEFAULT_TRACK);
    const [sessions, setSessions] = useState<CoachSession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Coach profile state
    const [hasCoachProfile, setHasCoachProfile] = useState<boolean | null>(null);
    const [checkingProfile, setCheckingProfile] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when widget opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Check for coach profile when widget opens
    useEffect(() => {
        if (isOpen && isSignedIn && hasCoachProfile === null && !checkingProfile) {
            checkCoachProfile();
        }
    }, [isOpen, isSignedIn, hasCoachProfile, checkingProfile]);

    // Load chat history when widget opens
    useEffect(() => {
        if (isOpen && isSignedIn && hasCoachProfile === true) {
            loadChatHistory();
        }
    }, [isOpen, isSignedIn, hasCoachProfile]);

    // ============================================================================
    // Coach Profile Check
    // ============================================================================

    const checkCoachProfile = async () => {
        setCheckingProfile(true);
        try {
            const result = await checkProfileExists();
            setHasCoachProfile(result.has_completed_onboarding);
        } catch (err) {
            console.error('Failed to check coach profile:', err);
            setHasCoachProfile(false);
        } finally {
            setCheckingProfile(false);
        }
    };

    // ============================================================================
    // API Handlers (now using coach.ts)
    // ============================================================================

    // Helper to load messages for a session - avoids code duplication
    const loadMessagesForSession = async (sessionId: string, sessionTrack: string) => {
        setIsLoadingMessages(true);
        try {
            const data = await getSessionMessages(sessionId);
            setMessages(data.messages?.map(m => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })) || []);
        } catch (error) {
            console.error('❌ Failed to load messages for session:', sessionId, error);
            // Fallback to welcome message
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: `Continuing your **${sessionTrack}** session. How can I help?`,
            }]);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const loadChatHistory = useCallback(async () => {
        try {
            const sessionList = await listSessions();
            setSessions(sessionList);

            if (sessionList.length > 0) {
                const latestSession = sessionList[0];

                // If we already have this session, just reload messages
                // (catches new messages from full page)
                if (currentSessionId === latestSession.id) {
                    await loadMessagesForSession(latestSession.id, latestSession.track);
                } else if (!currentSessionId) {
                    // No session yet, load the latest
                    setCurrentSessionId(latestSession.id);
                    setCurrentTrack(latestSession.track);
                    await loadMessagesForSession(latestSession.id, latestSession.track);
                }
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
        }
    }, [currentSessionId]);

    const loadSession = async (session: CoachSession) => {
        setCurrentSessionId(session.id);
        setCurrentTrack(session.track);
        setShowHistory(false);
        await loadMessagesForSession(session.id, session.track);
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        // Require profile for coach features
        if (hasCoachProfile === false) {
            setError('Please complete onboarding first.');
            return;
        }

        const userMessage = inputValue.trim();
        setInputValue('');
        setError(null);

        // Optimistic update
        const tempUserId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempUserId,
            role: 'user',
            content: userMessage,
            isOptimistic: true,
        }]);

        setIsLoading(true);

        try {
            let sessionId = currentSessionId;

            // Create new session if none exists
            if (!sessionId) {
                const newSession = await startSession(currentTrack, 'support');
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
            }

            // Send message to coach backend
            const response = await sendMessage(sessionId, userMessage);

            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== tempUserId);
                return [
                    ...filtered,
                    { id: `user-${Date.now()}`, role: 'user', content: userMessage },
                    { id: response.id, role: 'assistant', content: response.response },
                ];
            });

        } catch (err) {
            console.error('Failed to send message:', err);
            setError('Failed to send message. Please try again.');
            setMessages(prev => prev.filter(m => m.id !== tempUserId));
        } finally {
            setIsLoading(false);
        }
    };

    const startNewChat = async () => {
        setCurrentSessionId(null);
        setMessages([]);
        setShowHistory(false);
        setError(null);
        // Next message will create a new session
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isSignedIn) return null;

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <>
            {/* FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[600px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-teal-400" />
                            <span className="font-semibold text-white">Performance Coach</span>
                            {currentTrack && (
                                <span className="text-xs text-teal-400/70 capitalize">({currentTrack})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Expand button - opens full coach page with current session */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // Pass session ID so full page continues the same conversation
                                    const coachPath = hasCoachProfile === false
                                        ? '/chat/onboarding'
                                        : currentSessionId
                                            ? `/coach?session=${currentSessionId}`
                                            : '/coach';
                                    navigate(coachPath);
                                }}
                                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded hover:bg-white/10"
                                title={hasCoachProfile === false ? "Set up coach" : "Open full coach"}
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>{hasCoachProfile === false ? 'Set up' : 'Expand'}</span>
                            </button>
                            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">History</button>
                            <button onClick={startNewChat} className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">New</button>
                        </div>
                    </div>

                    {/* History Panel */}
                    {showHistory && sessions.length > 0 && (
                        <div className="absolute top-14 left-0 right-0 bg-[#252525] border-b border-white/10 max-h-48 overflow-y-auto z-10">
                            {sessions.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => loadSession(session)}
                                    className={`w-full text-left px-4 py-2 hover:bg-white/5 transition-colors border-b border-white/5 ${currentSessionId === session.id ? 'bg-teal-500/20' : ''}`}
                                >
                                    <div className="text-sm text-white truncate capitalize">{session.track} Session</div>
                                    <div className="text-xs text-white/40">{session.message_count} messages • {session.mode}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Onboarding prompt if no coach profile */}
                        {hasCoachProfile === false && (
                            <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-xl p-4 border border-teal-500/30 mb-4">
                                <h4 className="text-white font-medium mb-2">✨ Personalize Your Coach</h4>
                                <p className="text-sm text-white/70 mb-3">Complete a quick questionnaire to unlock personalized coaching tailored to your communication style and goals.</p>
                                <button
                                    onClick={() => { setIsOpen(false); navigate('/chat/onboarding'); }}
                                    className="w-full py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-400 transition"
                                >
                                    Start Personalization
                                </button>
                            </div>
                        )}

                        {/* Loading indicator */}
                        {isLoadingMessages && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                            </div>
                        )}

                        {messages.length === 0 && !isLoading && !isLoadingMessages && (
                            <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                <Sparkles className="w-12 h-12 text-teal-400/50 mb-4" />
                                <h3 className="text-white font-medium mb-2">Your Performance Coach</h3>
                                <p className="text-sm text-white/50">Ask me to analyze your meeting transcripts, identify communication patterns, or provide coaching feedback.</p>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-xl px-4 py-2 shadow-sm ${message.role === 'user'
                                        ? 'bg-teal-600 text-white rounded-br-sm'
                                        : 'bg-[#2a2a2a] text-gray-100 rounded-bl-sm border border-white/5'
                                        } ${message.isOptimistic ? 'opacity-70' : ''}`}
                                >
                                    <div className={`prose prose-sm max-w-none 
                                            prose-invert 
                                            prose-p:leading-relaxed 
                                            prose-headings:text-teal-400 prose-headings:font-bold prose-headings:text-base prose-headings:mb-2 prose-headings:mt-4
                                            prose-a:text-teal-400 prose-a:underline hover:prose-a:text-teal-300
                                            prose-blockquote:border-l-4 prose-blockquote:border-teal-500 prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                            prose-strong:text-white prose-code:text-teal-300 prose-code:bg-white/10 prose-code:px-1 prose-code:rounded
                                            prose-ul:my-2 prose-li:my-0.5
                                    `}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[#2a2a2a] rounded-xl rounded-bl-sm px-4 py-3 border border-white/5">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && <div className="text-center text-red-400 text-sm py-2">{error}</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-white/10 bg-[#1e1e1e]">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={hasCoachProfile === false ? "Complete onboarding to chat..." : "Ask your performance coach..."}
                                className="flex-1 bg-[#2a2a2a] text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-teal-500 focus:outline-none placeholder-white/30 transition-colors"
                                disabled={isLoading || hasCoachProfile === false}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || isLoading || hasCoachProfile === false}
                                className="w-10 h-10 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-white/10 disabled:text-white/30 text-white flex items-center justify-center transition-colors shadow-lg shadow-teal-500/20"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;

