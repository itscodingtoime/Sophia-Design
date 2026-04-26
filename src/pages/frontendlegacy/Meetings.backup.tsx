import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { API_BASE_URL } from '../services/api';

// Types
interface CalendarEvent {
    id: string;
    provider: string;
    title: string | null;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    is_cancelled: boolean;
    meeting_url: string | null;
    platform: string | null;
    meeting_id: number | null;
    is_promoted: boolean;
}

interface Meeting {
    meeting_id: number;
    org_id: string;
    created_by: string;
    meeting_date: string;
    source_platform: string;
    title: string | null;
    file_path: string | null;
    processed_status: string;
}

interface MeetingCard {
    meeting_id: number;
    org_id: string;
    origin: string;
    title: string | null;
    calendar_event_id: string | null;
    calendar_title: string | null;
    calendar_url: string | null;
    calendar_start_time: string | null;
    calendar_end_time: string | null;
    last_uploaded_at: string | null;
    computed_state: 'NEEDS_TRANSCRIPT' | 'PROCESSING' | 'READY' | 'FAILED';
    last_error_summary: string | null;
    created_at: string;
}

interface PaginatedMeetings {
    items: MeetingCard[];
    next_cursor: string | null;
    has_more: boolean;
}

interface ProviderStatus {
    enabled: boolean;
    disabled_reason?: string | null;
    connected: boolean;
    last_sync: string | null;
    last_full_sync: string | null;
}

interface CalendarStatus {
    providers: Record<string, ProviderStatus>;
}

// Platform icons
const platformIcons: Record<string, string> = {
    zoom: '📹',
    teams: '👥',
    meet: '📅',
    other: '🎥',
};

const providerDisplayNames: Record<string, string> = {
    google_calendar: 'Google Calendar',
    outlook_calendar: 'Outlook Calendar',
};

const providerIcons: Record<string, string> = {
    google_calendar: '📅',
    outlook_calendar: '📧',
};

// Default fallback status - ensures provider cards always render
const FALLBACK_CALENDAR_STATUS: CalendarStatus = {
    providers: {
        google_calendar: { enabled: true, connected: false, last_sync: null, last_full_sync: null },
        outlook_calendar: { enabled: false, disabled_reason: 'feature_flag_disabled', connected: false, last_sync: null, last_full_sync: null },
    }
};

// Utility function to format relative time
function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

// Utility function to group events by date
function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
    const groups: Record<string, CalendarEvent[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const event of events) {
        const eventDate = new Date(event.start_time);
        eventDate.setHours(0, 0, 0, 0);

        let label: string;
        if (eventDate.getTime() === today.getTime()) {
            label = 'Today';
        } else if (eventDate.getTime() === tomorrow.getTime()) {
            label = 'Tomorrow';
        } else {
            label = eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });
        }

        if (!groups[label]) {
            groups[label] = [];
        }
        groups[label].push(event);
    }

    return groups;
}

// Format time for display
function formatEventTime(isoString: string, isAllDay: boolean): string {
    if (isAllDay) return 'All day';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Validate meeting URL against known domains (strict allowlist)
function isValidMeetingUrl(url: string | null): boolean {
    if (!url) return false;
    const knownPatterns = [
        /meet\.google\.com\//i,
        /teams\.microsoft\.com\/l\/meetup-join/i,
        /teams\.live\.com\/meet\//i,
        /zoom\.us\/j\//i,
        /zoom\.us\/wc\/join\//i,
    ];
    return knownPatterns.some(pattern => pattern.test(url));
}

export default function Meetings() {
    const { getToken } = useAuth();
    const { organization } = useOrganization();
    const [searchParams] = useSearchParams();

    // State
    const [activeTab, setActiveTab] = useState<'upcoming' | 'needs-transcript' | 'recently-uploaded' | 'all'>('upcoming');
    const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
    const [promotingEventId, setPromotingEventId] = useState<string | null>(null);
    const [calendarStatusError, setCalendarStatusError] = useState<string | null>(null);
    const [calendarEventsError, setCalendarEventsError] = useState<string | null>(null);

    // New state for needs-transcript and recently-uploaded
    const [needsTranscript, setNeedsTranscript] = useState<MeetingCard[]>([]);
    const [recentlyUploaded, setRecentlyUploaded] = useState<MeetingCard[]>([]);
    const [ntCursor, setNtCursor] = useState<string | null>(null);
    const [ruCursor, setRuCursor] = useState<string | null>(null);
    const [ntHasMore, setNtHasMore] = useState(false);
    const [ruHasMore, setRuHasMore] = useState(false);
    const [ntLoading, setNtLoading] = useState(false);
    const [ruLoading, setRuLoading] = useState(false);

    // Upload modal state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [attachToMeetingId, setAttachToMeetingId] = useState<number | null>(null);
    const [attachToMeetingTitle, setAttachToMeetingTitle] = useState<string>('');

    // Handle OAuth callback params
    useEffect(() => {
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');

        if (connected) {
            toast.success(`Successfully connected ${providerDisplayNames[connected] || connected}!`);
            // Clear the URL params
            window.history.replaceState({}, '', '/meetings');
        } else if (error) {
            toast.error(`Connection failed: ${error}`);
            window.history.replaceState({}, '', '/meetings');
        }
    }, [searchParams]);

    // Fetch calendar status
    const fetchCalendarStatus = useCallback(async () => {
        setCalendarStatusError(null);
        try {
            const token = await getToken();
            const url = `${API_BASE_URL}/v1/calendar/status`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data: CalendarStatus = await response.json();
                setCalendarStatus(data);
            } else {
                const errorText = await response.text().catch(() => 'Unknown error');
                setCalendarStatusError(`Failed to load calendar status (${response.status}). URL: ${url}`);
                console.error('Calendar status error:', response.status, errorText);
            }
        } catch (error) {
            setCalendarStatusError(`Network error loading calendar status. Check VITE_API_BASE_URL. URL: ${API_BASE_URL}/v1/calendar/status`);
            console.error('Failed to fetch calendar status:', error);
        }
    }, [getToken]);

    // Fetch calendar events
    const fetchCalendarEvents = useCallback(async () => {
        setCalendarEventsError(null);
        try {
            const token = await getToken();
            const url = `${API_BASE_URL}/v1/calendar/events`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data: CalendarEvent[] = await response.json();
                setCalendarEvents(data);
            } else {
                setCalendarEventsError(`Failed to load calendar events (${response.status}).`);
                console.error('Calendar events error:', response.status);
            }
        } catch (error) {
            setCalendarEventsError(`Network error loading calendar events.`);
            console.error('Failed to fetch calendar events:', error);
        }
    }, [getToken]);

    // Fetch meetings
    const fetchMeetings = useCallback(async () => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/meetings`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setMeetings(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
        }
    }, [getToken]);

    // Fetch needs-transcript meetings
    const fetchNeedsTranscript = useCallback(async (cursor?: string) => {
        setNtLoading(true);
        try {
            const token = await getToken();
            const url = new URL(`${API_BASE_URL}/v1/meetings/needs-transcript`);
            url.searchParams.set('limit', '20');
            if (cursor) url.searchParams.set('cursor', cursor);

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data: PaginatedMeetings = await response.json();
                if (cursor) {
                    setNeedsTranscript(prev => [...prev, ...data.items]);
                } else {
                    setNeedsTranscript(data.items);
                }
                setNtCursor(data.next_cursor);
                setNtHasMore(data.has_more);
            }
        } catch (error) {
            console.error('Failed to fetch needs-transcript:', error);
        } finally {
            setNtLoading(false);
        }
    }, [getToken]);

    // Fetch recently-uploaded meetings
    const fetchRecentlyUploaded = useCallback(async (cursor?: string) => {
        setRuLoading(true);
        try {
            const token = await getToken();
            const url = new URL(`${API_BASE_URL}/v1/meetings/recently-uploaded`);
            url.searchParams.set('limit', '20');
            if (cursor) url.searchParams.set('cursor', cursor);

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data: PaginatedMeetings = await response.json();
                if (cursor) {
                    setRecentlyUploaded(prev => [...prev, ...data.items]);
                } else {
                    setRecentlyUploaded(data.items);
                }
                setRuCursor(data.next_cursor);
                setRuHasMore(data.has_more);
            }
        } catch (error) {
            console.error('Failed to fetch recently-uploaded:', error);
        } finally {
            setRuLoading(false);
        }
    }, [getToken]);

    // Handle upload (or attach transcript to existing meeting)
    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', uploadFile);
            if (uploadTitle && !attachToMeetingId) formData.append('title', uploadTitle);

            // Use different endpoint based on whether attaching to existing meeting
            const url = attachToMeetingId
                ? `${API_BASE_URL}/v1/meetings/${attachToMeetingId}/transcript`
                : `${API_BASE_URL}/v1/meetings/upload`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (response.ok) {
                toast.success(attachToMeetingId ? 'Transcript attached! Processing started.' : 'Meeting uploaded! Processing started.');
                setShowUploadModal(false);
                setUploadTitle('');
                setUploadFile(null);
                setAttachToMeetingId(null);
                setAttachToMeetingTitle('');
                // Refresh lists
                await Promise.all([fetchMeetings(), fetchRecentlyUploaded(), fetchNeedsTranscript()]);
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            await Promise.all([
                fetchCalendarStatus(),
                fetchCalendarEvents(),
                fetchMeetings(),
                fetchNeedsTranscript(),
                fetchRecentlyUploaded(),
            ]);
            setLoading(false);
        };
        fetchAll();
    }, [fetchCalendarStatus, fetchCalendarEvents, fetchMeetings, fetchNeedsTranscript, fetchRecentlyUploaded, organization?.id]);

    // Connect calendar
    const handleConnect = async (provider: string) => {
        setConnectingProvider(provider);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/calendar/${provider}/connect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                window.location.href = data.auth_url;
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to connect');
            }
        } catch (error) {
            console.error('Failed to connect calendar:', error);
            toast.error('Failed to connect calendar');
        } finally {
            setConnectingProvider(null);
        }
    };

    // Disconnect calendar
    const handleDisconnect = async (provider: string) => {
        if (!confirm(`Disconnect ${providerDisplayNames[provider]}? This will remove all synced events.`)) {
            return;
        }

        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/calendar/${provider}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                toast.success(`Disconnected ${providerDisplayNames[provider]}`);
                await fetchCalendarStatus();
                await fetchCalendarEvents();
            } else {
                toast.error('Failed to disconnect');
            }
        } catch (error) {
            console.error('Failed to disconnect calendar:', error);
            toast.error('Failed to disconnect');
        }
    };

    // Sync calendars
    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/calendar/sync`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                // New format: { success: bool, providers: { google_calendar: { ok, fetched, upserted }, ... } }
                const providers = data.providers || data.results || {};
                let totalSynced = 0;
                let errors: string[] = [];
                for (const [providerName, result] of Object.entries(providers) as [string, any][]) {
                    if (result.ok || result.success) {
                        totalSynced += result.upserted || result.events_synced || 0;
                    } else if (result.error) {
                        errors.push(`${providerDisplayNames[providerName] || providerName}: ${result.error}`);
                    }
                }
                if (totalSynced > 0) {
                    toast.success(`Synced ${totalSynced} events`);
                } else if (errors.length > 0) {
                    toast.error(errors.join(', '));
                } else {
                    toast.info('No new events to sync');
                }
                await fetchCalendarEvents();
                await fetchCalendarStatus();
            } else {
                toast.error('Sync failed');
            }
        } catch (error) {
            console.error('Failed to sync calendars:', error);
            toast.error('Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    // Promote event to meeting
    const handlePromote = async (eventId: string) => {
        setPromotingEventId(eventId);
        try {
            const token = await getToken();
            const response = await fetch(`${API_BASE_URL}/v1/meetings/promote`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ calendar_event_id: eventId }),
            });

            if (response.ok) {
                const data = await response.json();
                if (!data.created) {
                    toast.info('Using existing meeting');
                } else {
                    toast.success('Meeting created');
                }

                // Get the event title from calendarEvents state
                const event = calendarEvents.find(e => e.id === eventId);
                const meetingTitle = event?.title || `Meeting #${data.meeting_id}`;

                // Refresh the needs-transcript list and switch to that tab
                await fetchNeedsTranscript();
                setActiveTab('needs-transcript');

                // Auto-open upload modal with the promoted meeting's details
                setAttachToMeetingId(data.meeting_id);
                setAttachToMeetingTitle(meetingTitle);
                setShowUploadModal(true);
            } else {
                toast.error('Failed to promote event');
            }
        } catch (error) {
            console.error('Failed to promote event:', error);
            toast.error('Failed to promote event');
        } finally {
            setPromotingEventId(null);
        }
    };

    // Merge fetched status with fallback to ensure all providers are present
    const effectiveCalendarStatus = useMemo(() => ({
        providers: {
            ...FALLBACK_CALENDAR_STATUS.providers,
            ...(calendarStatus?.providers ?? {}),
        }
    }), [calendarStatus]);

    // Retry handler for error recovery
    const handleRetry = async () => {
        await Promise.all([fetchCalendarStatus(), fetchCalendarEvents()]);
    };

    // Filter upcoming events (not promoted, not cancelled)
    const upcomingEvents = calendarEvents.filter(e => !e.is_promoted && !e.is_cancelled);
    const groupedEvents = groupEventsByDate(upcomingEvents);

    // Check if any provider is connected
    const hasConnectedProvider =
        Object.values(effectiveCalendarStatus.providers).some(p => p.connected);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Meetings</h1>
                <button
                    onClick={handleSync}
                    disabled={syncing || !hasConnectedProvider}
                    title={!hasConnectedProvider ? 'Connect a calendar first' : undefined}
                    className={`flex items-center gap-2 px-4 py-2 ${hasConnectedProvider
                        ? 'bg-teal-600 hover:bg-teal-700'
                        : 'bg-gray-600 cursor-not-allowed'
                        } disabled:opacity-50 text-white rounded-lg transition-colors`}
                >
                    <span className={syncing ? 'animate-spin' : ''}>↻</span>
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
            </div>

            {/* Calendar Sync Section */}
            <div className="bg-[#262626] rounded-xl p-5 mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Calendar Sync</h2>

                {/* Error display with Retry */}
                {calendarStatusError && (
                    <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-red-400">
                                <span>⚠️</span>
                                <span className="text-sm">{calendarStatusError}</span>
                            </div>
                            <button
                                onClick={handleRetry}
                                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(effectiveCalendarStatus.providers).map(([provider, status]) => (
                        <div
                            key={provider}
                            className="bg-[#1e1e1e] rounded-lg p-4 border border-white/10"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{providerIcons[provider]}</span>
                                    <div>
                                        <h3 className="font-medium text-white">
                                            {providerDisplayNames[provider]}
                                        </h3>
                                        {status.connected ? (
                                            <div className="flex items-center gap-2 text-sm text-green-400">
                                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                                Connected
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                                                Not connected
                                            </div>
                                        )}
                                        {status.connected && status.last_sync && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Last sync: {formatRelativeTime(status.last_sync)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    {status.enabled ? (
                                        status.connected ? (
                                            <button
                                                onClick={() => handleDisconnect(provider)}
                                                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                            >
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(provider)}
                                                disabled={connectingProvider === provider}
                                                className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded transition-colors"
                                            >
                                                {connectingProvider === provider ? 'Connecting...' : 'Connect'}
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-xs text-gray-500 italic">
                                            {status.disabled_reason === 'org_not_allowed'
                                                ? 'Not enabled for your org'
                                                : 'Coming soon'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 mb-6 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'upcoming'
                        ? 'text-teal-400 border-b-2 border-teal-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Upcoming Events
                </button>
                <button
                    onClick={() => setActiveTab('needs-transcript')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'needs-transcript'
                        ? 'text-teal-400 border-b-2 border-teal-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Needs Transcript {needsTranscript.length > 0 && `(${needsTranscript.length})`}
                </button>
                <button
                    onClick={() => setActiveTab('recently-uploaded')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'recently-uploaded'
                        ? 'text-teal-400 border-b-2 border-teal-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Recently Uploaded
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === 'all'
                        ? 'text-teal-400 border-b-2 border-teal-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    All Meetings
                </button>
                <div className="flex-1"></div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded transition-colors"
                >
                    + Upload Meeting
                </button>
            </div>


            {/* Events error display */}
            {calendarEventsError && (
                <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400">
                            <span>⚠️</span>
                            <span className="text-sm">{calendarEventsError}</span>
                        </div>
                        <button
                            onClick={handleRetry}
                            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {activeTab === 'upcoming' ? (
                <div className="space-y-6">
                    {!hasConnectedProvider ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>Connect a calendar to see your upcoming events</p>
                        </div>
                    ) : upcomingEvents.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No upcoming events. Click "Sync Now" to fetch events.</p>
                        </div>
                    ) : (
                        Object.entries(groupedEvents).map(([dateLabel, events]) => (
                            <div key={dateLabel}>
                                <h3 className="text-sm font-medium text-gray-400 mb-3">{dateLabel}</h3>
                                <div className="space-y-2">
                                    {events.map(event => (
                                        <div
                                            key={event.id}
                                            className={`bg-[#262626] rounded-lg p-4 border border-white/10 ${event.is_cancelled ? 'opacity-50' : ''
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-sm text-gray-400 w-20">
                                                        {formatEventTime(event.start_time, event.is_all_day)}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-medium ${event.is_cancelled ? 'line-through text-gray-500' : 'text-white'
                                                            }`}>
                                                            {event.title || 'Untitled Event'}
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                                            {event.platform && (
                                                                <span className="flex items-center gap-1">
                                                                    {platformIcons[event.platform] || '🎥'}
                                                                    <span className="capitalize">{event.platform}</span>
                                                                </span>
                                                            )}
                                                            {event.location && !event.platform && (
                                                                <span className="truncate max-w-[200px]">{event.location}</span>
                                                            )}
                                                            {event.is_cancelled && (
                                                                <span className="text-red-400">(Cancelled)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isValidMeetingUrl(event.meeting_url) && (
                                                        <button
                                                            onClick={() => window.open(event.meeting_url!, '_blank', 'noopener,noreferrer')}
                                                            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                        >
                                                            Join
                                                        </button>
                                                    )}
                                                    {!event.is_cancelled && (
                                                        <button
                                                            onClick={() => handlePromote(event.id)}
                                                            disabled={promotingEventId === event.id}
                                                            className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded transition-colors flex items-center gap-1"
                                                        >
                                                            {promotingEventId === event.id ? (
                                                                'Promoting...'
                                                            ) : (
                                                                <>
                                                                    Promote <span className="text-xs">→</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : activeTab === 'needs-transcript' ? (
                <div className="space-y-2">
                    {ntLoading && needsTranscript.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>Loading...</p>
                        </div>
                    ) : needsTranscript.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No meetings need transcripts. Promote a calendar event to get started.</p>
                        </div>
                    ) : (
                        <>
                            {needsTranscript.map(meeting => (
                                <div
                                    key={meeting.meeting_id}
                                    className="bg-[#262626] rounded-lg p-4 border border-white/10"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meeting.origin === 'CALENDAR_PROMOTED'
                                                    ? 'bg-purple-900/50 text-purple-300'
                                                    : 'bg-blue-900/50 text-blue-300'
                                                    }`}>
                                                    {meeting.origin === 'CALENDAR_PROMOTED' ? '📅 Calendar' : '📤 Upload'}
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-white">
                                                    {meeting.title || meeting.calendar_title || `Meeting #${meeting.meeting_id}`}
                                                </h4>
                                                <p className="text-sm text-gray-400">
                                                    {new Date(meeting.created_at).toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300">
                                                Needs Transcript
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setAttachToMeetingId(meeting.meeting_id);
                                                    setAttachToMeetingTitle(meeting.title || meeting.calendar_title || `Meeting #${meeting.meeting_id}`);
                                                    setShowUploadModal(true);
                                                }}
                                                className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors"
                                            >
                                                Attach Transcript
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {ntHasMore && (
                                <div className="text-center py-4">
                                    <button
                                        onClick={() => fetchNeedsTranscript(ntCursor || undefined)}
                                        disabled={ntLoading}
                                        className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors"
                                    >
                                        {ntLoading ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : activeTab === 'recently-uploaded' ? (
                <div className="space-y-2">
                    {ruLoading && recentlyUploaded.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>Loading...</p>
                        </div>
                    ) : recentlyUploaded.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No recently uploaded meetings. Click "Upload Meeting" to add one.</p>
                        </div>
                    ) : (
                        <>
                            {recentlyUploaded.map(meeting => (
                                <div
                                    key={meeting.meeting_id}
                                    className="bg-[#262626] rounded-lg p-4 border border-white/10"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meeting.origin === 'CALENDAR_PROMOTED'
                                                    ? 'bg-purple-900/50 text-purple-300'
                                                    : 'bg-blue-900/50 text-blue-300'
                                                    }`}>
                                                    {meeting.origin === 'CALENDAR_PROMOTED' ? '📅 Calendar' : '📤 Upload'}
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-white">
                                                    {meeting.title || meeting.calendar_title || `Meeting #${meeting.meeting_id}`}
                                                </h4>
                                                <p className="text-sm text-gray-400">
                                                    Uploaded {meeting.last_uploaded_at ? formatRelativeTime(meeting.last_uploaded_at) : 'recently'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meeting.computed_state === 'READY'
                                                ? 'bg-green-900/50 text-green-300'
                                                : meeting.computed_state === 'PROCESSING'
                                                    ? 'bg-blue-900/50 text-blue-300'
                                                    : meeting.computed_state === 'FAILED'
                                                        ? 'bg-red-900/50 text-red-300'
                                                        : 'bg-yellow-900/50 text-yellow-300'
                                                }`}>
                                                {meeting.computed_state === 'READY' ? '✓ Ready' :
                                                    meeting.computed_state === 'PROCESSING' ? '⏳ Processing' :
                                                        meeting.computed_state === 'FAILED' ? '✗ Failed' : 'Pending'}
                                            </span>
                                            <Link
                                                to={`/dashboard?meeting=${meeting.meeting_id}`}
                                                className="px-3 py-1.5 text-sm text-teal-400 hover:text-teal-300 transition-colors"
                                            >
                                                View →
                                            </Link>
                                        </div>
                                    </div>
                                    {meeting.last_error_summary && (
                                        <div className="mt-2 text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">
                                            {meeting.last_error_summary}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {ruHasMore && (
                                <div className="text-center py-4">
                                    <button
                                        onClick={() => fetchRecentlyUploaded(ruCursor || undefined)}
                                        disabled={ruLoading}
                                        className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors"
                                    >
                                        {ruLoading ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {meetings.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>No meetings yet. Upload a transcript or promote a calendar event.</p>
                        </div>
                    ) : (
                        meetings.map(meeting => (
                            <div
                                key={meeting.meeting_id}
                                className="bg-[#262626] rounded-lg p-4 border border-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meeting.source_platform === 'calendar'
                                                ? 'bg-purple-900/50 text-purple-300'
                                                : meeting.source_platform === 'upload'
                                                    ? 'bg-blue-900/50 text-blue-300'
                                                    : 'bg-gray-700 text-gray-300'
                                                }`}>
                                                {meeting.source_platform === 'calendar' ? '📅 Calendar' :
                                                    meeting.source_platform === 'upload' ? '📤 Upload' :
                                                        meeting.source_platform}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-white">
                                                {meeting.title || `Meeting #${meeting.meeting_id}`}
                                            </h4>
                                            <p className="text-sm text-gray-400">
                                                {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meeting.processed_status === 'processed'
                                            ? 'bg-green-900/50 text-green-300'
                                            : meeting.processed_status === 'pending'
                                                ? 'bg-yellow-900/50 text-yellow-300'
                                                : 'bg-red-900/50 text-red-300'
                                            }`}>
                                            {meeting.processed_status}
                                        </span>
                                        <Link
                                            to={`/dashboard?meeting=${meeting.meeting_id}`}
                                            className="px-3 py-1.5 text-sm text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            View →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#1a1a1a] rounded-lg p-6 w-full max-w-md border border-white/10">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            {attachToMeetingId ? 'Attach Transcript' : 'Upload Meeting'}
                        </h2>
                        {attachToMeetingId && (
                            <p className="text-sm text-gray-400 mb-4">
                                Attaching transcript to: <span className="text-white">{attachToMeetingTitle}</span>
                            </p>
                        )}
                        <div className="space-y-4">
                            {!attachToMeetingId && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
                                    <input
                                        type="text"
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                        placeholder="Meeting title"
                                        className="w-full px-3 py-2 bg-[#262626] border border-white/10 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Transcript File</label>
                                <input
                                    type="file"
                                    accept=".txt,.vtt,.srt,.doc,.docx,.pdf"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="w-full px-3 py-2 bg-[#262626] border border-white/10 rounded text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-teal-600 file:text-white hover:file:bg-teal-700"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadTitle('');
                                    setUploadFile(null);
                                    setAttachToMeetingId(null);
                                    setAttachToMeetingTitle('');
                                }}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!uploadFile || uploading}
                                className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded transition-colors"
                            >
                                {uploading ? 'Uploading...' : attachToMeetingId ? 'Attach' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

