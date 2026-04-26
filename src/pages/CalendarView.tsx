import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizationList } from '@clerk/clerk-react';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import {
  getCalendarStatus, connectCalendar, getCalendarEvents, disconnectCalendar, syncCalendars,
  type CalendarEventDTO,
} from '../services/api';
import { C, useThemeMode } from '../theme';
import { Avatar } from '../components/shared';

// ─── Types ───
interface CalendarMeeting {
  id: string; name: string; date: string; time: string; timeShort: string;
  day: string; hour: number; duration: number; space: string; spaceKey: string;
  participants: string[]; sophiaEnabled: boolean; hasTranscript: boolean;
  platform: string | null;
}

// ─── Space Colors ───
const SPACE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sales: { bg: "rgba(20, 180, 120, 0.08)", border: "rgba(20, 180, 120, 0.2)", text: "hsl(20, 75%, 68%)" },
  product: { bg: "rgba(80, 160, 220, 0.08)", border: "rgba(80, 160, 220, 0.2)", text: "hsl(210, 65%, 68%)" },
  creative: { bg: "rgba(180, 100, 220, 0.08)", border: "rgba(180, 100, 220, 0.2)", text: "hsl(270, 55%, 70%)" },
  company: { bg: "rgba(192, 230, 137, 0.06)", border: "rgba(192, 230, 137, 0.15)", text: C.teal },
};

// ─── Mic Icon ───
const MicIcon = ({ size = 14, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// ─── Platform Icons ───
const PLATFORM_ICONS: Record<string, JSX.Element> = {
  zoom: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#2D8CFF"/>
      <path d="M4 7.5a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0114 7.5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 014 16.5v-9z" fill="white"/>
      <path d="M16 9.5l4-2v9l-4-2v-5z" fill="white"/>
    </svg>
  ),
  teams: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#6264A7"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">T</text>
    </svg>
  ),
  meet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#00897B"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">M</text>
    </svg>
  ),
};

// ─── Provider Create URLs ───
const PROVIDER_CREATE_URLS: Record<string, string> = {
  google_calendar: 'https://calendar.google.com/calendar/r/eventedit',
  outlook_calendar: 'https://outlook.live.com/calendar/0/deeplink/compose',
};

// ─── Date Helpers ───
const getMonday = (d: Date) => {
  const dt = new Date(d); dt.setHours(0, 0, 0, 0);
  const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff); return dt;
};

const generateWeekDays = (monday: Date) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return days.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: label, label, date: d.getDate(), isToday: d.toDateString() === today.toDateString(), fullDate: d };
  });
};

// Map CalendarEventDTO -> CalendarMeeting
const mapCalendarEvent = (ev: CalendarEventDTO): CalendarMeeting => {
  const start = new Date(ev.start_time);
  const end = new Date(ev.end_time);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeStr = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return {
    id: ev.id,
    name: ev.title || 'Untitled',
    date: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: `${timeStr(start)} – ${timeStr(end)}`,
    timeShort: timeStr(start),
    day: days[start.getDay()],
    hour: start.getHours(),
    duration: Math.max(0.5, (end.getTime() - start.getTime()) / 3600000),
    space: ev.platform || 'Meeting',
    spaceKey: (ev.platform || 'company').toLowerCase(),
    participants: [],
    sophiaEnabled: ev.is_promoted,
    hasTranscript: ev.meeting_id !== null,
    platform: ev.platform,
  };
};

// ─── CalendarView Component ───
export default function CalendarView() {
  useThemeMode(); // subscribe to theme changes so C.* inline styles re-render
  const navigate = useNavigate();
  const { getApiToken } = useSophiaAuth();
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileDay, setMobileDay] = useState(new Date().getDay() - 1); // 0=Mon .. 4=Fri
  const [syncing, setSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);

  // Available orgs for team selector (only show if 2+ orgs)
  const orgs = userMemberships?.data ?? [];
  const showTeamSelector = orgs.length >= 2;

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const weekDays = generateWeekDays(monday);
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${friday.toLocaleDateString('en-US', { day: 'numeric' })}, ${friday.getFullYear()}`;

  // Check calendar status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const status = await getCalendarStatus(token);
        const connected = Object.entries(status.providers).find(([, v]) => v.connected);
        if (connected && !cancelled) {
          setCalendarConnected(true);
          setConnectedProvider(connected[0]);
        }
      } catch { /* no calendar connected */ }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // Fetch events when connected or week changes; auto-sync if empty on first load
  useEffect(() => {
    if (!calendarConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const startDate = monday.toISOString().split('T')[0];
        const endDate = new Date(friday.getTime() + 86400000).toISOString().split('T')[0];
        let events = await getCalendarEvents(token, startDate, endDate);
        // Auto-sync once if no events found (events may not have been synced yet)
        if (events.length === 0 && !hasSynced && !cancelled) {
          setHasSynced(true);
          setSyncing(true);
          try {
            await syncCalendars(token);
            if (!cancelled) {
              events = await getCalendarEvents(token, startDate, endDate);
            }
          } catch { /* sync failed, show empty */ }
          if (!cancelled) setSyncing(false);
        }
        if (!cancelled) setMeetings(events.map(mapCalendarEvent));
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [calendarConnected, weekOffset, getApiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async (provider: string) => {
    try {
      const token = await getApiToken();
      if (!token) return;
      const result = await connectCalendar(provider, token);
      if (result.auth_url) window.location.href = result.auth_url;
    } catch (err) {
      console.error('Calendar connect failed:', err);
      setCalendarConnected(true);
      setConnectedProvider(provider);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedProvider) { setCalendarConnected(false); return; }
    try {
      const token = await getApiToken();
      if (token) await disconnectCalendar(connectedProvider, token);
    } catch (err) { console.error('Disconnect failed:', err); }
    setCalendarConnected(false);
    setConnectedProvider(null);
    setMeetings([]);
  };

  const handleCreateEvent = () => {
    if (!connectedProvider) return;
    const url = PROVIDER_CREATE_URLS[connectedProvider];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const toggleSophia = (id: string) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, sophiaEnabled: !m.sophiaEnabled } : m));
    // Also update the selected meeting so the detail panel re-renders immediately
    setSelectedMeeting(prev => prev && prev.id === id ? { ...prev, sophiaEnabled: !prev.sophiaEnabled } : prev);
  };

  const deleteMeeting = (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  // Group meetings by day
  const dayMeetings = (dayKey: string) => meetings.filter(m => m.day === dayKey).sort((a, b) => a.hour - b.hour);

  const getSpaceColor = (key: string) => SPACE_COLORS[key] || SPACE_COLORS.company;

  // Clamp mobileDay to 0-4
  const clampedMobileDay = Math.max(0, Math.min(4, mobileDay));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", width: "100%", overflowY: "auto", flex: 1 }}>
      {/* Connect / Sync Section */}
      {!calendarConnected ? (
        <div style={{
          background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          border: "1px solid rgba(192,230,137,0.1)", borderRadius: 18, padding: "32px",
          textAlign: "center", marginBottom: 24,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 16 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 8 }}>Connect Your Calendar</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 24px" }}>
            Sync your calendar so SOPHIA can join your meetings and provide real-time coaching insights.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => handleConnect('google_calendar')} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, cursor: "pointer",
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google Calendar
            </button>
            <button onClick={() => handleConnect('outlook_calendar')} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, cursor: "pointer",
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#0078D4"/><text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">O</text></svg>
              Outlook
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header Bar: Status + Actions */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 20, flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 6px ${C.teal}` }} />
              <span style={{ fontSize: 13, color: C.teal, fontWeight: 500 }}>{syncing ? 'Syncing...' : `${connectedProvider === 'outlook_calendar' ? 'Outlook' : 'Google'} Calendar synced`}</span>
              <button onClick={async () => {
                setSyncing(true);
                try {
                  const token = await getApiToken();
                  if (token) {
                    await syncCalendars(token);
                    const startDate = monday.toISOString().split('T')[0];
                    const endDate = new Date(friday.getTime() + 86400000).toISOString().split('T')[0];
                    const events = await getCalendarEvents(token, startDate, endDate);
                    setMeetings(events.map(mapCalendarEvent));
                  }
                } catch (err) { console.error('Sync failed:', err); }
                setSyncing(false);
              }} style={{
                background: "none", border: "none", color: C.textDim, fontSize: 11, cursor: syncing ? "wait" : "pointer",
                textDecoration: "underline", padding: 0, opacity: syncing ? 0.5 : 1,
              }}>Refresh</button>
              <button onClick={handleDisconnect} style={{
                background: "none", border: "none", color: C.textDim, fontSize: 11, cursor: "pointer",
                fontFamily: "'Tomorrow', sans-serif", textDecoration: "underline", marginLeft: 6,
              }}>Disconnect</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={handleCreateEvent} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                color: C.teal, fontSize: 12, fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Event
              </button>
            </div>
          </div>

          {/* Week Navigation */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16,
          }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "4px 8px", fontFamily: "'Tomorrow', sans-serif" }}>&lsaquo;</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.text, letterSpacing: 0.5 }}>
                {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : ''}: {weekLabel}
              </span>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} style={{
                  background: C.tealGlow, border: `1px solid ${C.tealBorder}`, borderRadius: 6,
                  color: C.teal, fontSize: 11, fontWeight: 500, padding: "3px 10px", cursor: "pointer",
                  fontFamily: "'Tomorrow', sans-serif",
                }}>Today</button>
              )}
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "4px 8px", fontFamily: "'Tomorrow', sans-serif" }}>&rsaquo;</button>
          </div>

          {/* Mobile Day Selector (< 768px) */}
          <div className="calendar-mobile-tabs" style={{
            display: "none", gap: 4, marginBottom: 12, justifyContent: "center",
          }}>
            {weekDays.map((wd, i) => (
              <button key={wd.key} onClick={() => setMobileDay(i)} style={{
                padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                background: i === clampedMobileDay ? C.tealGlow : "transparent",
                border: `1px solid ${i === clampedMobileDay ? C.tealBorder : C.border}`,
                color: i === clampedMobileDay ? C.teal : C.textDim,
                fontSize: 12, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
              }}>
                {wd.label} {wd.date}
              </button>
            ))}
          </div>

          {/* Calendar Grid + Detail Panel */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* 5-Day Grid (desktop) */}
            <div className="calendar-week-grid" style={{
              flex: 1, display: "flex",
              background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
              borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              {weekDays.map((wd, di) => {
                const mts = dayMeetings(wd.key);
                return (
                  <div key={wd.key} className="calendar-day-column" style={{
                    flex: 1, minWidth: 0,
                    borderRight: di < 4 ? `1px solid ${C.border}` : "none",
                    background: wd.isToday ? C.tealGlow : "transparent",
                  }}>
                    {/* Day Header */}
                    <div style={{
                      padding: "14px 10px 10px", textAlign: "center",
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 11, color: wd.isToday ? C.teal : C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                        {wd.label}
                      </div>
                      <div style={{
                        fontSize: 20, fontWeight: 600, fontFamily: "'Josefin Sans', sans-serif",
                        color: wd.isToday ? C.teal : C.textSec,
                        ...(wd.isToday ? { width: 34, height: 34, lineHeight: "34px", borderRadius: "50%", background: C.tealGlow, margin: "0 auto" } : {}),
                      }}>
                        {wd.date}
                      </div>
                    </div>
                    {/* Meeting Blocks */}
                    <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 8, minHeight: 320 }}>
                      {mts.map(m => {
                        const sc = getSpaceColor(m.spaceKey);
                        const isSelected = selectedMeeting?.id === m.id;
                        return (
                          <div key={m.id} onClick={() => setSelectedMeeting(isSelected ? null : m)}
                            style={{
                              padding: "10px 10px", borderRadius: 10, cursor: "pointer",
                              background: isSelected ? sc.bg : C.hoverBg,
                              border: `1px solid ${isSelected ? sc.border : C.border}`,
                              borderLeft: `3px solid ${m.sophiaEnabled ? C.teal : sc.border}`,
                              transition: "all 0.2s",
                              minHeight: Math.max(m.duration * 56, 56),
                            }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>{m.timeShort}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {m.sophiaEnabled && (
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, boxShadow: `0 0 4px ${C.teal}`, flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: 9, color: C.textDim }}>{m.participants.length === 1 ? "1:1" : `${m.participants.length || ''}`}</span>
                              {m.hasTranscript && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 2 }}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/studio?meeting_id=${m.id}`); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                                color: C.teal, fontSize: 9, fontWeight: 600,
                                fontFamily: "'Tomorrow', sans-serif", marginTop: 6,
                                transition: "all 0.2s", width: "100%", justifyContent: "center",
                              }}
                            >
                              {m.platform && PLATFORM_ICONS[m.platform]
                                ? PLATFORM_ICONS[m.platform]
                                : <MicIcon size={10} color={C.teal} />
                              }
                              Record
                            </button>
                          </div>
                        );
                      })}
                      {mts.length === 0 && (
                        <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginTop: 40, fontStyle: "italic" }}>No meetings</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Single-Day View */}
            <div className="calendar-mobile-day" style={{ display: "none", flex: 1 }}>
              {weekDays[clampedMobileDay] && (() => {
                const wd = weekDays[clampedMobileDay];
                const mts = dayMeetings(wd.key);
                return (
                  <div style={{
                    background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
                    borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden",
                  }}>
                    <div style={{ padding: "14px 16px", textAlign: "center", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, color: wd.isToday ? C.teal : C.textSec, fontWeight: 600 }}>
                        {wd.label} {wd.date}
                      </div>
                    </div>
                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
                      {mts.map(m => {
                        const sc = getSpaceColor(m.spaceKey);
                        return (
                          <div key={m.id} onClick={() => setSelectedMeeting(m)} style={{
                            padding: "12px", borderRadius: 10, cursor: "pointer",
                            background: C.hoverBg, border: `1px solid ${C.border}`,
                            borderLeft: `3px solid ${m.sophiaEnabled ? C.teal : sc.border}`,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>{m.time}</div>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/studio?meeting_id=${m.id}`); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                                color: C.teal, fontSize: 9, fontWeight: 600,
                                fontFamily: "'Tomorrow', sans-serif",
                                transition: "all 0.2s", width: "fit-content",
                              }}
                            >
                              {m.platform && PLATFORM_ICONS[m.platform]
                                ? PLATFORM_ICONS[m.platform]
                                : <MicIcon size={10} color={C.teal} />
                              }
                              Record
                            </button>
                          </div>
                        );
                      })}
                      {mts.length === 0 && (
                        <div style={{ fontSize: 12, color: C.textDim, textAlign: "center", marginTop: 40, fontStyle: "italic" }}>No meetings</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Detail Panel */}
            {selectedMeeting && (
              <div style={{
                width: 280, flexShrink: 0,
                background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
                borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
                padding: "24px 20px", animation: "fadeSlide 0.3s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text, lineHeight: 1.3, flex: 1 }}>{selectedMeeting.name}</div>
                  <button onClick={() => setSelectedMeeting(null)} style={{
                    background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "0 0 0 8px", lineHeight: 1, fontFamily: "'Tomorrow', sans-serif",
                  }}>&times;</button>
                </div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>{selectedMeeting.date} · {selectedMeeting.time}</div>
                <div style={{
                  display: "inline-block", fontSize: 10, color: getSpaceColor(selectedMeeting.spaceKey).text,
                  padding: "3px 10px", borderRadius: 6,
                  background: getSpaceColor(selectedMeeting.spaceKey).bg,
                  border: `1px solid ${getSpaceColor(selectedMeeting.spaceKey).border}`,
                  marginBottom: 18,
                }}>{selectedMeeting.space}</div>

                {/* Participants */}
                {selectedMeeting.participants.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>Participants</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                      {selectedMeeting.participants.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={p} size={22} />
                          <span style={{ fontSize: 12, color: C.text }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* SOPHIA Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <div onClick={() => toggleSophia(selectedMeeting.id)} style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                    background: selectedMeeting.sophiaEnabled ? C.teal : C.card, position: "relative",
                    transition: "background 0.25s", border: `1px solid ${selectedMeeting.sophiaEnabled ? C.teal : C.border}`,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#E3DED8",
                      position: "absolute", top: 2, left: selectedMeeting.sophiaEnabled ? 23 : 3, transition: "left 0.25s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: selectedMeeting.sophiaEnabled ? C.teal : C.textDim, fontWeight: 500 }}>
                    {selectedMeeting.sophiaEnabled ? "SOPHIA will join" : "Bring SOPHIA"}
                  </span>
                </div>

                {/* Team Selector (shown only when user has 2+ orgs) */}
                {showTeamSelector && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Assign to Team</div>
                    <select
                      value={selectedTeamId || ''}
                      onChange={e => setSelectedTeamId(e.target.value || null)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        background: C.card, border: `1px solid ${C.border}`,
                        color: C.text, fontSize: 12, fontFamily: "'Tomorrow', sans-serif",
                        outline: 'none', cursor: 'pointer', appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                        paddingRight: 30,
                      }}
                    >
                      <option value="">Active org (default)</option>
                      {orgs.map(mem => (
                        <option key={mem.organization.id} value={mem.organization.id}>
                          {mem.organization.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Record with SOPHIA */}
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ meeting_id: selectedMeeting.id });
                    if (selectedTeamId) params.set('team_id', selectedTeamId);
                    navigate(`/studio?${params.toString()}`);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                    background: C.teal, border: "none",
                    color: "#fff", fontSize: 12, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif", width: "100%",
                    justifyContent: "center", marginBottom: 8,
                  }}
                >
                  {selectedMeeting.platform && PLATFORM_ICONS[selectedMeeting.platform]
                    ? PLATFORM_ICONS[selectedMeeting.platform]
                    : <MicIcon size={14} color="#fff" />
                  }
                  Record with SOPHIA
                </button>

                {/* Delete Meeting */}
                <button onClick={() => deleteMeeting(selectedMeeting.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", width: "100%", justifyContent: "center",
                  background: "transparent", border: "1px solid rgba(180,60,60,0.15)",
                  color: C.textDim, fontSize: 11, fontWeight: 500,
                  fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s", marginTop: 8,
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#d45a5a"; e.currentTarget.style.borderColor = "rgba(212,90,90,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = "rgba(180,60,60,0.15)"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Remove meeting
                </button>
              </div>
            )}
          </div>

        </>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .calendar-week-grid { display: none !important; }
          .calendar-mobile-tabs { display: flex !important; }
          .calendar-mobile-day { display: block !important; }
        }
      `}</style>
    </div>
  );
}
