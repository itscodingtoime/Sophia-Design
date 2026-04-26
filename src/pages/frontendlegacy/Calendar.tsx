import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, ExternalLink, Plus, RefreshCw, Video } from 'lucide-react';
import {
    CalendarEventDTO,
    CalendarStatusResponse,
    getCalendarStatus,
    connectCalendar,
    syncCalendars,
    getCalendarEvents,
    disconnectCalendar,
} from '../services/api';

import Button from '../generic/Button';
import { C } from '../theme';
import { SophiaPageHeader, SectionCard, EmptyStateCard } from '../components/composition';
import { Skeleton } from '../components/ui/skeleton';
import GoogleCalendarIcon from '../assets/google-calendar-icon.png';
import OutlookCalendarIcon from '../assets/outlook-calendar-icon.png';

// Provider display configuration
const PROVIDER_CONFIG: Record<string, { name: string; icon: string; createUrl: string }> = {
    google_calendar: {
        name: 'Google Calendar',
        icon: GoogleCalendarIcon,
        createUrl: 'https://calendar.google.com/calendar/r/eventedit',
    },
    outlook_calendar: {
        name: 'Outlook Calendar',
        icon: OutlookCalendarIcon,
        createUrl: 'https://outlook.live.com/calendar/0/deeplink/compose',
    },
};

// Default fallback status
const FALLBACK_STATUS: CalendarStatusResponse = {
    providers: {
        google_calendar: { enabled: true, connected: false, last_sync: null, last_full_sync: null },
        outlook_calendar: { enabled: false, disabled_reason: 'feature_flag_disabled', connected: false, last_sync: null, last_full_sync: null },
    },
};

// Day names starting from Monday
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Validate meeting URL against known domains (strict allowlist - copied from Meetings.tsx)
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

// Utility functions
function formatTime(isoString: string, isAllDay: boolean): string {
    if (isAllDay) return 'All day';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateHeader(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function getGridDates(year: number, month: number): Date[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get the Monday before (or of) the first day
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 1, Sunday = 0
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Generate 42 days (6 weeks)
    const dates: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function getEventsForDate(events: CalendarEventDTO[], date: Date): CalendarEventDTO[] {
    return events.filter(event => {
        const eventDate = new Date(event.start_time);
        return isSameDay(eventDate, date);
    });
}

export default function Calendar() {
    const { getToken } = useAuth();
    const [searchParams] = useSearchParams();

    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarStatus, setCalendarStatus] = useState<CalendarStatusResponse | null>(null);
    const [events, setEvents] = useState<CalendarEventDTO[]>([]);
    const [allEvents, setAllEvents] = useState<CalendarEventDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
    const [allEventsEndDate, setAllEventsEndDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d;
    });
    const [loadingMore, setLoadingMore] = useState(false);

    // Computed values
    const gridDates = useMemo(() => getGridDates(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);
    const gridStartDate = gridDates[0];
    const gridEndDate = gridDates[gridDates.length - 1];
    const selectedDayEvents = useMemo(() => getEventsForDate(events, selectedDate), [events, selectedDate]);
    const today = useMemo(() => new Date(), []);

    const effectiveStatus = useMemo(() => ({
        providers: {
            ...FALLBACK_STATUS.providers,
            ...(calendarStatus?.providers ?? {}),
        },
    }), [calendarStatus]);

    const hasConnectedProvider = useMemo(
        () => Object.values(effectiveStatus.providers).some(p => p.connected),
        [effectiveStatus]
    );

    const connectedProvider = useMemo(
        () => Object.entries(effectiveStatus.providers).find(([_, p]) => p.connected)?.[0] ?? null,
        [effectiveStatus]
    );

    // Handle OAuth callback
    useEffect(() => {
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');
        if (connected) {
            toast.success(`Successfully connected ${PROVIDER_CONFIG[connected]?.name || connected}!`);
            window.history.replaceState({}, '', '/calendar');
        } else if (error) {
            toast.error(`Connection failed: ${error}`);
            window.history.replaceState({}, '', '/calendar');
        }
    }, [searchParams]);

    // Fetch calendar status
    const fetchStatus = useCallback(async () => {
        try {
            const token = await getToken();
            const data = await getCalendarStatus(token);
            setCalendarStatus(data);
        } catch (error) {
            console.error('Failed to fetch calendar status:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // getToken is stable from Clerk

    // Fetch events for grid
    const fetchGridEvents = useCallback(async () => {
        try {
            const token = await getToken();
            const data = await getCalendarEvents(
                token,
                gridStartDate.toISOString(),
                gridEndDate.toISOString()
            );
            setEvents(data.filter(e => !e.is_cancelled));
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gridStartDate.toISOString(), gridEndDate.toISOString()]); // getToken is stable

    // Fetch all events (for list below)
    const fetchAllEvents = useCallback(async (extendTo?: Date) => {
        const endDate = extendTo || allEventsEndDate;
        try {
            const token = await getToken();
            const data = await getCalendarEvents(
                token,
                new Date().toISOString(),
                endDate.toISOString()
            );
            setAllEvents(data.filter(e => !e.is_cancelled && !e.is_promoted));
            if (extendTo) setAllEventsEndDate(extendTo);
        } catch (error) {
            console.error('Failed to fetch all events:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allEventsEndDate.toISOString()]); // getToken is stable

    // Initial load - only run once on mount
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchStatus(), fetchGridEvents(), fetchAllEvents()]);
            setLoading(false);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only load on mount

    // Refetch grid events when month changes
    useEffect(() => {
        fetchGridEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate.getMonth(), currentDate.getFullYear()]); // Only when month/year changes

    // Handlers
    const handleConnect = async (provider: string) => {
        setConnectingProvider(provider);
        try {
            const token = await getToken();
            const data = await connectCalendar(provider, token);
            window.location.href = data.auth_url;
        } catch (error) {
            console.error('Failed to connect:', error);
            toast.error('Failed to connect calendar');
            setConnectingProvider(null);
        }
    };

    const handleDisconnect = async (provider: string) => {
        if (!confirm(`Disconnect ${PROVIDER_CONFIG[provider]?.name}? This will remove all synced events.`)) return;
        try {
            const token = await getToken();
            await disconnectCalendar(provider, token);
            toast.success(`Disconnected ${PROVIDER_CONFIG[provider]?.name}`);
            await Promise.all([fetchStatus(), fetchGridEvents(), fetchAllEvents()]);
        } catch (error) {
            console.error('Failed to disconnect:', error);
            toast.error('Failed to disconnect');
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = await getToken();
            const result = await syncCalendars(token);
            const totalUpserted = Object.values(result.providers).reduce((sum, p) => sum + (p.upserted || 0), 0);
            if (totalUpserted > 0) {
                toast.success(`Synced ${totalUpserted} events`);
            } else {
                toast.info('No new events to sync');
            }
            await Promise.all([fetchGridEvents(), fetchAllEvents(), fetchStatus()]);
        } catch (error) {
            console.error('Failed to sync:', error);
            toast.error('Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleLoadMore = async () => {
        setLoadingMore(true);
        const newEnd = new Date(allEventsEndDate);
        newEnd.setDate(newEnd.getDate() + 30);
        await fetchAllEvents(newEnd);
        setLoadingMore(false);
    };

    const handleCreateEvent = () => {
        if (!connectedProvider) {
            toast.info('Connect a calendar first to create events');
            return;
        }
        const config = PROVIDER_CONFIG[connectedProvider];
        if (config?.createUrl) {
            window.open(config.createUrl, '_blank', 'noopener,noreferrer');
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto">
                <SophiaPageHeader title="Calendar" />
                <div className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SectionCard><Skeleton className="h-16 w-full" /></SectionCard>
                        <SectionCard><Skeleton className="h-16 w-full" /></SectionCard>
                    </div>
                    <SectionCard><Skeleton className="h-64 w-full" /></SectionCard>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <SophiaPageHeader
                title="Calendar"
                actions={
                    <Button onClick={handleCreateEvent} variant="primary">
                        <Plus size={18} />
                        Create event
                    </Button>
                }
            />

            {/* Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-6">
                {Object.entries(effectiveStatus.providers).map(([provider, status]) => {
                    const config = PROVIDER_CONFIG[provider];
                    if (!config) return null;
                    return (
                        <SectionCard key={provider}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={config.icon} alt={config.name} className="w-10 h-10" />
                                    <span className="font-medium" style={{ color: C.text }}>{config.name}</span>
                                </div>
                                {status.enabled ? (
                                    status.connected ? (
                                        <Button
                                            onClick={() => handleDisconnect(provider)}
                                            variant="secondary"
                                        >
                                            Connected
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleConnect(provider)}
                                            disabled={connectingProvider === provider}
                                            variant="primary"
                                        >
                                            {connectingProvider === provider ? 'Connecting...' : 'Connect'}
                                        </Button>
                                    )
                                ) : (
                                    <span className="text-xs text-gray-500 italic">Coming soon</span>
                                )}
                            </div>
                        </SectionCard>
                    );
                })}
            </div>

            {/* Calendar + Selected Day Panel */}
            <div className="flex gap-6 mb-6">
                {/* Calendar Grid */}
                <SectionCard noPadding className="flex-1">
                    <div className="p-4">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1 rounded transition-colors hover-bg"
                                style={{ background: C.bgSub }}
                            >
                                <ChevronLeft size={20} className="text-gray-400" />
                            </button>
                            <span className="text-lg font-semibold min-w-[120px] text-center" style={{ color: C.text }}>
                                {formatMonthYear(currentDate)}
                            </span>
                            <button
                                onClick={handleNextMonth}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <ChevronRight size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={syncing || !hasConnectedProvider}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 disabled:opacity-50 rounded transition-colors hover-teal"
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync'}
                        </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAY_NAMES.map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {gridDates.map((date, idx) => {
                            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                            const isToday = isSameDay(date, today);
                            const isSelected = isSameDay(date, selectedDate);
                            const dayEvents = getEventsForDate(events, date);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(date)}
                                    className={`
                                    relative p-2 min-h-[80px] text-left rounded-lg transition-colors
                                    ${!isCurrentMonth && !isSelected ? 'opacity-50' : ''}
                                `}
                                    style={{
                                        background: isSelected ? C.teal : 'transparent',
                                        border: isToday && !isSelected ? `1px solid ${C.tealMuted}` : 'none',
                                    }}
                                >
                                    <span className="text-sm font-medium" style={{ color: isSelected ? C.white : C.text }}>
                                        {date.getDate()}
                                    </span>
                                    {/* Event indicators */}
                                    <div className="mt-1 space-y-0.5">
                                        {dayEvents.slice(0, 2).map(event => (
                                            <div
                                                key={event.id}
                                                className="text-[10px] px-1 py-0.5 rounded truncate"
                                                style={{ background: C.tealDeep, color: C.textSec }}
                                                title={event.title || 'Event'}
                                            >
                                                {event.title || 'Event'}
                                            </div>
                                        ))}
                                        {dayEvents.length > 2 && (
                                            <div className="text-[10px] text-gray-500">
                                                +{dayEvents.length - 2} more
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    </div>
                </SectionCard>

                {/* Selected Day Panel */}
                <SectionCard title={formatDateHeader(selectedDate)} className="w-72">
                    {selectedDayEvents.length === 0 ? (
                        <EmptyStateCard icon={<CalendarDays size={36} />} title="No events" description="No events on this day" />
                    ) : (
                        <div className="space-y-3">
                            {selectedDayEvents.map(event => (
                                <div
                                    key={event.id}
                                    className="rounded-lg p-3"
                                    style={{ background: C.bgSub, border: `1px solid ${C.border}` }}
                                >
                                    <h4 className="font-medium text-sm" style={{ color: C.text }}>
                                        {event.title || 'Untitled Event'}
                                    </h4>
                                    <p className="text-xs mt-1" style={{ color: C.textDim }}>
                                        {formatTime(event.start_time, event.is_all_day)} - {formatTime(event.end_time, event.is_all_day)}
                                    </p>
                                    {isValidMeetingUrl(event.meeting_url) && (
                                        <button
                                            onClick={() => window.open(event.meeting_url!, '_blank', 'noopener,noreferrer')}
                                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors hover-bg"
                                            style={{ background: C.bgSub, color: C.textDim }}
                                        >
                                            <Video size={14} />
                                            Join
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* All Events List */}
            <SectionCard title="All events">
                {!hasConnectedProvider ? (
                    <EmptyStateCard icon={<CalendarX2 size={48} />} title="Connect a calendar" description="Connect Google Calendar or Outlook to see your events" />
                ) : allEvents.length === 0 ? (
                    <EmptyStateCard icon={<CalendarDays size={48} />} title="No upcoming events" description="Your calendar is clear" />
                ) : (
                    <>
                        <div className="space-y-2">
                            {allEvents.map(event => {
                                const eventDate = new Date(event.start_time);
                                return (
                                    <div
                                        key={event.id}
                                        className="flex items-center gap-4 p-3 rounded-lg"
                                        style={{ background: C.bgSub, border: `1px solid ${C.border}` }}
                                    >
                                        {/* Date Badge */}
                                        <div className="flex-shrink-0 w-12 h-12 bg-teal-600/10 border border-teal-600/70 rounded-lg flex flex-col items-center justify-center">
                                            <span className="text-[10px] uppercase" style={{ color: C.text }}>
                                                {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-bold" style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
                                                {eventDate.getDate()}
                                            </span>
                                        </div>
                                        {/* Event Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm truncate" style={{ color: C.text }}>
                                                {event.title || 'Untitled Event'}
                                            </h4>
                                            <p className="text-xs text-gray-400">
                                                {formatTime(event.start_time, event.is_all_day)} - {formatTime(event.end_time, event.is_all_day)}
                                            </p>
                                        </div>
                                        {/* Source */}
                                        <div className="text-xs text-gray-500">
                                            {PROVIDER_CONFIG[event.provider]?.name || event.provider}
                                        </div>
                                        {/* Join Button for valid meeting URLs */}
                                        {isValidMeetingUrl(event.meeting_url) && (
                                            <button
                                                onClick={() => window.open(event.meeting_url!, '_blank', 'noopener,noreferrer')}
                                                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1.5"
                                            >
                                                <Video size={14} />
                                                Join
                                            </button>
                                        )}
                                        {/* External Link for non-meeting URLs */}
                                        {event.meeting_url && !isValidMeetingUrl(event.meeting_url) && (
                                            <a
                                                href={event.meeting_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                    </>
                )}
            </SectionCard>
        </div>
    );
}
