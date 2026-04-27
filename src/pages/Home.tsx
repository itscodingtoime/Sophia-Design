/**
 * Home page — replaces Culture Health.
 *
 * Order (top → bottom):
 *   1. Latest insight banner (rolling pile-up summary)
 *   2. Coming up — Granola-style calendar
 *   3. Team Health graph (Monthly / Quarterly / Yearly toggle, smoothed)
 *      with team-colour swatch picker
 *   4. Team overview (member cards) + Switch Team button
 *   5. Overall team motivation (inline 7-driver radar)
 *   6. Meeting reflections (accordion, collapsed)
 *   7. Glowing orb at the bottom
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, MoreHorizontal, Mic, MicOff, Check, ArrowRight, Sparkles, Target, UserPlus, X, Plus } from 'lucide-react';
import { C, useThemeMode } from '../theme';
import {
  meetings as allMeetings,
  recordings as mockRecordings,
  teamMembers,
  teamTrends,
  calendarEvents,
  weeklyInsight,
  teamInsights,
  teamAverageDrivers,
  memberDrivers,
} from '../mock-data';
import { SophiaGlowOrb } from '../components/SophiaGlowOrb';
import MotivationPanel from '../components/MotivationPanel';
import MotivationRadar from '../components/MotivationRadar';
import { useActiveTeam } from '../context/ActiveTeamContext';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeRange = (startIso: string, endIso: string) => `${formatTime(startIso)} – ${formatTime(endIso)}`;

const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Local source label + colour mapping to match the Studio recordings UI
const sourceLabel: Record<string, string> = {
  mic: 'Recorded live',
  meeting: 'Live meeting capture',
  fireflies: 'Imported from API',
  otter: 'Imported from Otter',
  granola: 'Imported from Granola',
  teams: 'Imported from Teams',
  meet: 'Imported from Google Meet',
  zoom: 'Imported from Zoom',
  upload: 'Uploaded',
};

const sourceColour: Record<string, string> = {
  mic: '#C2F542',
  meeting: '#A0E0FF',
  fireflies: '#FF6F50',
  otter: '#1FB6FF',
  granola: '#9DBE6E',
  teams: '#5059C9',
  meet: '#34A853',
  zoom: '#2D8CFF',
  upload: '#D8B7FF',
};

interface DayBucket {
  day: number;
  month: string;
  weekday: string;
  iso: string;
  isToday: boolean;
  events: typeof calendarEvents;
}

// Monday-anchored start of week
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
}

function buildWeek(weekStart: Date, events: typeof calendarEvents): DayBucket[] {
  const todayKey = new Date().toDateString();
  const buckets: DayBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toDateString();
    buckets.push({
      day: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'long' }),
      weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      iso: d.toISOString(),
      isToday: key === todayKey,
      events: events.filter((e) => new Date(e.start).toDateString() === key),
    });
  }
  return buckets;
}

const formatWeekRange = (weekStart: Date) => {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const left = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const right = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${left} – ${right}`;
};

type Window = 'monthly' | 'quarterly' | 'yearly';

export default function Home() {
  useThemeMode();
  const navigate = useNavigate();
  const { teamId: routeTeamId } = useParams<{ teamId?: string }>();
  const { teams: teamsState, activeTeamId, activeTeam, isOverall, setActiveTeamId, addMemberToTeam } = useActiveTeam();

  // Route is the source of truth: /home → Mikey's Growth, /team/:teamId → that team.
  useEffect(() => {
    const target = routeTeamId ?? 'overall';
    if (target !== activeTeamId) setActiveTeamId(target);
  }, [routeTeamId, activeTeamId, setActiveTeamId]);

  const [window, setWindow] = useState<Window>('quarterly');
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);
  // Meeting cards on Mikey's Growth default to open; user can collapse with the chevron.
  const [closedMeetingIds, setClosedMeetingIds] = useState<Set<string>>(() => new Set());
  const [motivation, setMotivation] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null });
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const meetings = useMemo(
    () => isOverall
      ? allMeetings
      : allMeetings.filter((m) => m.team === activeTeam.team_name),
    [isOverall, activeTeam.team_name],
  );

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const days = useMemo(() => buildWeek(weekStart, calendarEvents), [weekStart]);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [eventOverrides, setEventOverrides] = useState<Record<string, { team?: string; sophia?: boolean }>>({});
  const [openEventMenu, setOpenEventMenu] = useState<string | null>(null);

  // Synced-with-Sophia state for items (meetings, growth sessions)
  const [syncedIds, setSyncedIds] = useState<Set<string>>(() => new Set<string>());
  const toggleSync = (id: string) => {
    setSyncedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setEventTeam = (eventId: string, teamName: string) => {
    setEventOverrides((prev) => ({ ...prev, [eventId]: { ...prev[eventId], team: teamName } }));
  };
  const toggleEventSophia = (eventId: string, current: boolean) => {
    setEventOverrides((prev) => ({ ...prev, [eventId]: { ...prev[eventId], sophia: !current } }));
  };
  const teamForEvent = (e: typeof calendarEvents[number]) => eventOverrides[e.id]?.team ?? e.team;
  const sophiaForEvent = (e: typeof calendarEvents[number]) => {
    const override = eventOverrides[e.id]?.sophia;
    if (override !== undefined) return override;
    return e.team !== '—'; // default: SOPHIA on for team meetings, off for personal/focus
  };

  const stepWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  // Team Trend state + data (hard-coded example)
  const [trendWindow, setTrendWindow] = useState<string>('Monthly');
  const trendLabels = ['W1', 'W2', 'W3', 'W4'];
  const trendSeries = [
    { name: 'Product', color: C.teal, values: [4, 5, 6, 8] },
    { name: 'Marketing', color: C.amber, values: [5, 5, 5, 5] },
    { name: 'Operations', color: C.red, values: [6, 5, 5, 4] },
    { name: 'InnerSystems', color: C.textSec, values: [2, 3, 5, 7] },
  ];
  // Overall Team Motivation state + hard-coded data
  const [motivationMember, setMotivationMember] = useState<string>('All members');
  const motivationDimensions = ['Achievement', 'Growth', 'Influence', 'Impact', 'Connection', 'Recognition', 'Autonomy'];
  const teamAverage = {
    Achievement: 80, Growth: 71, Influence: 58, Impact: 75, Connection: 77, Recognition: 58, Autonomy: 85,
  } as Record<string, number>;
  const individualScores: Record<string, Record<string, number>> = {
    'Mikey Ferraris': { Achievement: 85, Growth: 65, Influence: 70, Impact: 90, Connection: 60, Recognition: 55, Autonomy: 75 },
    'Sara Williams': { Achievement: 75, Growth: 80, Influence: 65, Impact: 70, Connection: 85, Recognition: 70, Autonomy: 90 },
    'Priya Shah': { Achievement: 80, Growth: 75, Influence: 80, Impact: 80, Connection: 75, Recognition: 65, Autonomy: 80 },
    'Ben Carter': { Achievement: 65, Growth: 60, Influence: 50, Impact: 65, Connection: 70, Recognition: 60, Autonomy: 70 },
    'Leo Park': { Achievement: 70, Growth: 70, Influence: 60, Impact: 75, Connection: 80, Recognition: 75, Autonomy: 85 },
  };
  const todayKey = new Date().toDateString();
  const isCurrentWeek = days.some((d) => new Date(d.iso).toDateString() === todayKey);

  const trend = useMemo(() => {
    const t = teamTrends[activeTeamId] || teamTrends.overall;
    return t[window];
  }, [activeTeamId, window]);

  const trendMin = Math.min(...trend.map((p) => p.value));
  const trendMax = Math.max(...trend.map((p) => p.value));
  const trendColour = activeTeam.default_colour;

  const memberOf = useMemo(() => activeTeam.member_ids.map((id) => teamMembers.find((m) => m.id === id)!), [activeTeam]);

  // Inline selection state for individual/team motivation (renders inside the right placeholder)
  const [sheetMemberId, setSheetMemberId] = useState<string | null>(null);
  const [sheetMemberName, setSheetMemberName] = useState<string>('');

  const openForMember = (name: string) => {
    const m = teamMembers.find((t) => t.name === name) || null;
    setSheetMemberId(m ? m.id : null);
    setSheetMemberName(name);
  };

  const openOverall = () => {
    setSheetMemberId(null);
    setSheetMemberName('Overall Team');
  };

  return (
    <div style={{
      padding: '32px 36px 80px',
      maxWidth: 1180,
      margin: '0 auto',
      fontFamily: "'Tomorrow', sans-serif",
    }}>

      {/* ─── Header ─── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>Home</div>
        <h1 style={{
          margin: '6px 0 4px',
          fontSize: 34,
          fontFamily: "'Futura', 'Tomorrow', sans-serif",
          color: C.text,
          letterSpacing: 0.5,
        }}>
          {isOverall ? "Mikey's Growth" : activeTeam.team_name}
        </h1>
        <div style={{ color: C.textSec, fontSize: 14 }}>
          {isOverall
            ? 'Personal patterns across every meeting and team'
            : `${activeTeam.description} · ${activeTeam.member_ids.length} members · health ${activeTeam.health}`}
        </div>
      </div>


      {/* ─── Team insight (per-team only) ─── */}
      {!isOverall && teamInsights[activeTeamId] && (
        <div style={{
          background: `linear-gradient(135deg, ${activeTeam.default_colour}1A, ${activeTeam.default_colour}05)`,
          border: `1px solid ${activeTeam.default_colour}40`,
          borderRadius: 18,
          padding: '22px 24px',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              fontSize: 11, letterSpacing: 1.6, color: activeTeam.default_colour,
              fontWeight: 700, textTransform: 'uppercase',
              fontFamily: "'Tomorrow', sans-serif",
            }}>
              Team insight
            </div>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: `${activeTeam.default_colour}1F`,
              color: activeTeam.default_colour, fontWeight: 600,
              border: `1px solid ${activeTeam.default_colour}40`,
            }}>
              This week
            </span>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => navigate('/chat')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 999, padding: '5px 12px',
                cursor: 'pointer', color: C.textSec, fontSize: 11,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              Talk it through <ArrowRight size={11} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} style={{ color: activeTeam.default_colour }} />
                <div style={{ fontSize: 12, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Pattern
                </div>
              </div>
              <div style={{
                fontSize: 17, color: C.text, fontWeight: 600, lineHeight: 1.35,
                fontFamily: "'Futura', 'Tomorrow', sans-serif", marginBottom: 10,
              }}>
                {teamInsights[activeTeamId].pattern_title}
              </div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                {teamInsights[activeTeamId].pattern_body}
              </div>
            </div>
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '16px 18px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={14} style={{ color: '#FFB28A' }} />
                <div style={{ fontSize: 12, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Growth edge
                </div>
              </div>
              <div style={{
                fontSize: 14.5, color: C.text, fontWeight: 600, lineHeight: 1.35,
                fontFamily: "'Futura', 'Tomorrow', sans-serif", marginBottom: 8,
              }}>
                {teamInsights[activeTeamId].growth_edge_title}
              </div>
              <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.55 }}>
                {teamInsights[activeTeamId].growth_edge_body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Weekly insight + growth edge (Mikey's Growth only) ─── */}
      {isOverall && !insightDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(194,245,66,0.10), rgba(160,224,255,0.06))',
          border: `1px solid ${C.tealBorder}`,
          borderRadius: 18,
          padding: '22px 24px',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              fontSize: 11, letterSpacing: 1.6, color: C.teal,
              fontWeight: 700, textTransform: 'uppercase',
              fontFamily: "'Tomorrow', sans-serif",
            }}>
              Weekly insight
            </div>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 999,
              background: C.tealGlow, color: C.teal, fontWeight: 600,
              border: `1px solid ${C.tealBorder}`,
            }}>
              {weeklyInsight.week_label}
            </span>
            <span style={{ flex: 1 }} />
            <button
              onClick={() => navigate('/chat')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 999, padding: '5px 12px',
                cursor: 'pointer', color: C.textSec, fontSize: 11,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              Talk it through <ArrowRight size={11} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
            {/* Pattern */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={14} style={{ color: C.teal }} />
                <div style={{ fontSize: 12, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Pattern
                </div>
              </div>
              <div style={{
                fontSize: 18, color: C.text, fontWeight: 600, lineHeight: 1.35,
                fontFamily: "'Futura', 'Tomorrow', sans-serif", marginBottom: 10,
              }}>
                {weeklyInsight.pattern_title}
              </div>
              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                {weeklyInsight.pattern_body}
              </div>
            </div>

            {/* Growth edge */}
            <div style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '16px 18px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={14} style={{ color: '#FFB28A' }} />
                <div style={{ fontSize: 12, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Growth edge
                </div>
              </div>
              <div style={{
                fontSize: 15, color: C.text, fontWeight: 600, lineHeight: 1.35,
                fontFamily: "'Futura', 'Tomorrow', sans-serif", marginBottom: 8,
              }}>
                {weeklyInsight.growth_edge_title}
              </div>
              <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.55 }}>
                {weeklyInsight.growth_edge_body}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              onClick={() => setInsightDismissed(true)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.textDim, fontSize: 11,
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Growth Sessions (moved meeting reflections here) ─── */}
      <Section title="Growth Sessions">

        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {meetings.map((m, i) => {
            const open = isOverall ? !closedMeetingIds.has(m.id) : openMeetingId === m.id;
            const toggleOpen = () => {
              if (isOverall) {
                setClosedMeetingIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(m.id)) next.delete(m.id);
                  else next.add(m.id);
                  return next;
                });
              } else {
                setOpenMeetingId(open ? null : m.id);
              }
            };
            return (
              <div key={m.id} style={{
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}>
                <button
                  onClick={toggleOpen}
                  onKeyDown={(e) => {
                    // Arrow keys collapse / expand the meeting analysis.
                    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && open) {
                      e.preventDefault();
                      toggleOpen();
                    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && !open) {
                      e.preventDefault();
                      toggleOpen();
                    }
                  }}
                  aria-expanded={open}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '18px 22px',
                    textAlign: 'left',
                    color: C.text,
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    {m.unread && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.teal, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontFamily: "'Futura', 'Tomorrow', sans-serif", color: C.text, marginBottom: 3 }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textDim }}>
                        {m.date_label} · {m.duration_min}m · {m.team} · {m.participants.length} attendees
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSync(m.id); }}
                      aria-pressed={syncedIds.has(m.id)}
                      title={syncedIds.has(m.id) ? 'Unsync from Sophia' : 'Sync with Sophia'}
                      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <SophiaGlowOrb size={28} showWordmark={false} glow={syncedIds.has(m.id)} />
                      <div style={{ fontSize: 11, color: syncedIds.has(m.id) ? C.text : C.textDim }}>{syncedIds.has(m.id) ? 'Synced' : 'Sync'}</div>
                    </button>
                    <ChevronDown size={16} style={{
                      color: C.textDim,
                      transition: 'transform 0.2s',
                      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }} />
                  </div>
                </button>

                {open && (
                  <div style={{ padding: '0 22px 22px' }}>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 14 }}>
                      {m.participants.map((p, idx) => (
                        <span key={p}>
                          <button
                            onClick={() => {
                              const member = teamMembers.find((tm) => tm.name === p);
                              if (member) setMotivation({ open: true, memberId: member.id });
                            }}
                            style={{
                              background: 'transparent', border: 'none', padding: 0,
                              color: C.text, cursor: 'pointer', fontSize: 11.5,
                              textDecoration: 'underline', textUnderlineOffset: 3,
                              textDecorationColor: C.border,
                              fontFamily: "'Tomorrow', sans-serif",
                            }}
                          >
                            {p}
                          </button>
                          {idx < m.participants.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
                      <ReflectionBlock label="What was good" colour="#C2F542" items={m.what_was_good} />
                      <ReflectionBlock label="Blind spots" colour="#FFB28A" items={m.blind_spots} />
                      <ReflectionBlock label="Insight" colour="#A0E0FF" items={[m.insight]} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ─── Calendar (Overall only) ─── */}
      {isOverall && (
      <>
      <Section
        title={calendarView === 'week' ? 'This week' : 'This month'}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 3, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 3 }}>
              {(['week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v)}
                  style={{
                    background: v === calendarView ? C.activeBg : 'transparent',
                    color: v === calendarView ? C.text : C.textDim,
                    border: 'none', cursor: 'pointer',
                    padding: '5px 14px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif", textTransform: 'capitalize',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {calendarView === 'week' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => stepWeek(-1)}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '4px 8px', color: C.text, cursor: 'pointer',
                    fontFamily: "'Tomorrow', sans-serif", fontSize: 12,
                  }}
                  aria-label="Previous week"
                >‹</button>
                <div style={{
                  fontFamily: "'Tomorrow', sans-serif", fontSize: 12, color: C.text,
                  padding: '0 6px', minWidth: 130, textAlign: 'center',
                }}>
                  {formatWeekRange(weekStart)}
                </div>
                <button
                  onClick={() => stepWeek(1)}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '4px 8px', color: C.text, cursor: 'pointer',
                    fontFamily: "'Tomorrow', sans-serif", fontSize: 12,
                  }}
                  aria-label="Next week"
                >›</button>
                {!isCurrentWeek && (
                  <button
                    onClick={() => setWeekStart(startOfWeek(new Date()))}
                    style={{
                      background: 'transparent', border: `1px solid ${C.border}`,
                      borderRadius: 999, padding: '4px 12px', color: C.textSec, cursor: 'pointer',
                      fontFamily: "'Tomorrow', sans-serif", fontSize: 11, marginLeft: 4,
                    }}
                  >
                    Today
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    const next = new Date(monthAnchor); next.setMonth(monthAnchor.getMonth() - 1); setMonthAnchor(next);
                  }}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '4px 8px', color: C.text, cursor: 'pointer',
                    fontFamily: "'Tomorrow', sans-serif", fontSize: 12,
                  }}
                >‹</button>
                <div style={{
                  fontFamily: "'Tomorrow', sans-serif", fontSize: 12, color: C.text,
                  padding: '0 6px', minWidth: 110, textAlign: 'center',
                }}>
                  {monthAnchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={() => {
                    const next = new Date(monthAnchor); next.setMonth(monthAnchor.getMonth() + 1); setMonthAnchor(next);
                  }}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: '4px 8px', color: C.text, cursor: 'pointer',
                    fontFamily: "'Tomorrow', sans-serif", fontSize: 12,
                  }}
                >›</button>
              </div>
            )}
          </div>
        }
      >
        {calendarView === 'month' ? (
          <MonthGrid
            anchor={monthAnchor}
            events={calendarEvents}
            teamColour={(teamName) => teamsState.find((t) => t.team_name === teamName)?.default_colour || C.textDim}
            teamForEvent={teamForEvent}
          />
        ) : null}
        {calendarView === 'week' ? (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '6px 0',
          overflow: 'hidden',
        }}>
          {days.map((day, di) => (
            <div key={day.iso} style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              borderTop: di === 0 ? 'none' : `1px solid ${C.border}`,
              padding: '16px 22px',
              gap: 16,
              alignItems: 'flex-start',
              background: day.isToday ? `${C.teal}08` : 'transparent',
            }}>
              {/* Date column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  fontSize: 38, fontFamily: "'Futura', 'Tomorrow', sans-serif",
                  color: day.isToday ? C.teal : C.text,
                  lineHeight: 1, fontWeight: 500,
                }}>
                  {day.day}
                </div>
                <div style={{ fontSize: 12, color: C.textSec, marginTop: 6 }}>{day.month}</div>
                <div style={{ fontSize: 12, color: day.isToday ? C.teal : C.textDim, fontWeight: day.isToday ? 600 : 400 }}>
                  {day.isToday ? 'Today' : day.weekday}
                </div>
              </div>

              {/* Events column */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {day.events.length === 0 && (
                  <div style={{ fontSize: 12, color: C.textDim, padding: '8px 12px', fontStyle: 'italic' }}>
                    No events
                  </div>
                )}
                {day.events.map((e, ei) => {
                  const team = teamForEvent(e);
                  const sophiaOn = sophiaForEvent(e);
                  const colour = (() => {
                    const t = teamsState.find((tm) => tm.team_name === team);
                    return t?.default_colour || C.textDim;
                  })();
                  const menuOpen = openEventMenu === e.id;
                  return (
                    <div key={e.id} style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: e.highlighted ? `${colour}1A` : 'transparent',
                      border: e.highlighted ? `1px solid ${colour}55` : '1px solid transparent',
                      marginBottom: ei < day.events.length - 1 ? 4 : 0,
                      cursor: 'default',
                    }}>
                      <div style={{
                        width: 3, alignSelf: 'stretch',
                        borderRadius: 3,
                        background: colour,
                        opacity: 0.85,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: C.text, fontWeight: 500, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>
                          {e.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{formatTimeRange(e.start, e.end)}</span>
                          {team !== '—' && <span>· {team}</span>}
                          {e.participants.length > 0 && <span>· {e.participants.join(', ')}</span>}
                          {sophiaOn && team !== '—' && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10, padding: '1px 7px', borderRadius: 999,
                              background: C.tealGlow, color: C.teal, marginLeft: 2,
                            }}>
                              <Mic size={9} />
                              SOPHIA on
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(ev) => { ev.stopPropagation(); setOpenEventMenu(menuOpen ? null : e.id); }}
                        aria-label="Event options"
                        style={{
                          background: 'transparent', border: 'none',
                          color: C.textDim, padding: 4, cursor: 'pointer', alignSelf: 'center',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                      >
                        <MoreHorizontal size={15} />
                      </button>

                      {menuOpen && (
                        <>
                          <div
                            onClick={() => setOpenEventMenu(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: 8, top: 'calc(100% + 4px)',
                              minWidth: 240,
                              background: C.card,
                              border: `1px solid ${C.border}`,
                              borderRadius: 12,
                              padding: 8,
                              zIndex: 61,
                              boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                            }}
                          >
                            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1.2, textTransform: 'uppercase', padding: '6px 8px 4px' }}>Add to team</div>
                            {teamsState.map((t) => (
                              <button
                                key={t.team_id}
                                onClick={() => { setEventTeam(e.id, t.team_name); setOpenEventMenu(null); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  width: '100%', padding: '8px 8px', borderRadius: 8,
                                  background: 'transparent', border: 'none',
                                  cursor: 'pointer', color: C.text, fontSize: 12,
                                  textAlign: 'left', fontFamily: "'Tomorrow', sans-serif",
                                }}
                                onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                              >
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.default_colour, flexShrink: 0 }} />
                                <span style={{ flex: 1 }}>{t.team_name}</span>
                                {team === t.team_name && <Check size={13} style={{ color: C.teal }} />}
                              </button>
                            ))}
                            <button
                              onClick={() => { setEventTeam(e.id, '—'); setOpenEventMenu(null); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: '8px 8px', borderRadius: 8,
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', color: C.textDim, fontSize: 12,
                                textAlign: 'left', fontFamily: "'Tomorrow', sans-serif",
                              }}
                              onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px dashed ${C.border}`, flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>None — personal</span>
                              {team === '—' && <Check size={13} style={{ color: C.teal }} />}
                            </button>

                            <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />

                            <button
                              onClick={() => { toggleEventSophia(e.id, sophiaOn); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: '8px 8px', borderRadius: 8,
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', color: C.text, fontSize: 12,
                                textAlign: 'left', fontFamily: "'Tomorrow', sans-serif",
                              }}
                              onMouseEnter={(ev) => { ev.currentTarget.style.background = C.hoverBg; }}
                              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                            >
                              {sophiaOn ? <Mic size={13} style={{ color: C.teal }} /> : <MicOff size={13} style={{ color: C.textDim }} />}
                              <span style={{ flex: 1 }}>{sophiaOn ? 'SOPHIA recording on' : 'SOPHIA recording off'}</span>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                width: 32, height: 18, borderRadius: 999, padding: 2,
                                background: sophiaOn ? C.teal : C.border,
                                transition: 'background 0.15s',
                              }}>
                                <span style={{
                                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                                  transform: sophiaOn ? 'translateX(14px)' : 'translateX(0)',
                                  transition: 'transform 0.15s',
                                }} />
                              </span>
                            </button>
                          </div>
                        </>
                      )}

                      {e.highlighted && !menuOpen && (
                        <ChevronRight size={16} style={{ color: C.textDim, alignSelf: 'center' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        ) : null}
      </Section>

      {/* Team Trend sub-section moved after calendar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: `0 8px 20px ${C.shadowColor}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>Team Trend</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {(['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Monthly', 'Quarterly', 'Yearly'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setTrendWindow(b)}
                  style={{
                    background: b === trendWindow ? C.activeBg : 'transparent',
                    color: b === trendWindow ? C.text : C.textDim,
                    border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  }}
                >{b}</button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', minHeight: 220 }}>
            <TeamTrendChart series={trendSeries} labels={trendLabels} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {trendSeries.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
                <div style={{ fontSize: 12, color: C.textDim }}>{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* ─── Team health graph (per-team only) ─── */}
      {!isOverall && (
      <Section title="Team health">
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: trendColour }} />
              <span style={{ fontSize: 13, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>
                {activeTeam.team_name}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: 3 }}>
              {(['monthly', 'quarterly', 'yearly'] as Window[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  style={{
                    background: w === window ? C.activeBg : 'transparent',
                    color: w === window ? C.text : C.textDim,
                    border: 'none', cursor: 'pointer',
                    padding: '5px 14px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif", textTransform: 'capitalize',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <SmoothLineChart
            data={trend}
            min={trendMin}
            max={trendMax}
            colour={trendColour}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim, marginTop: 8 }}>
            {trend.map((t) => <span key={t.label}>{t.label}</span>)}
          </div>
        </div>
      </Section>
      )}

      {/* ─── Team & motivations (per-team only) ─── */}
      {!isOverall && (
      <Section
        title="Team"
        right={
          <button
            onClick={() => setAddMemberOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 999, padding: '6px 12px',
              cursor: 'pointer', color: C.text, fontSize: 11.5,
              fontFamily: "'Tomorrow', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <UserPlus size={12} /> Add member
          </button>
        }
      >
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '20px 22px',
        }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 14, lineHeight: 1.5 }}>
            Click any active member to view their motivation profile. Use the button below for the team aggregate.
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 8,
            marginBottom: 18,
          }}>
            {memberOf.map((m) => (
              <TeamMemberRow
                key={m.id}
                member={m}
                onClick={() => m.active && setMotivation({ open: true, memberId: m.id })}
              />
            ))}
          </div>

          <div style={{
            display: 'flex', gap: 16,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 10.5, color: C.textDim, lineHeight: 1.5 }}>
              <div>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34D399', marginRight: 6 }} />
                Active — voiceprint enrolled
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'transparent', border: `1.5px dashed ${C.border}`, marginRight: 6 }} />
                Anonymous — not yet enrolled
              </div>
            </div>
            <button
              onClick={() => setMotivation({ open: true, memberId: null })}
              style={{
                background: trendColour,
                color: '#0A0A0C',
                border: 'none',
                borderRadius: 999,
                padding: '10px 20px',
                cursor: 'pointer',
                fontFamily: "'Futura', 'Tomorrow', sans-serif",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              View team motivations
            </button>
          </div>
        </div>
      </Section>
      )}

      {/* Overall Team Motivation (member list + placeholder) */}
      <div style={{ marginTop: 12, marginBottom: 14 }}>
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: `0 8px 20px ${C.shadowColor}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>Team Members</div>
          </div>

                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Mikey Ferraris', 'Ben Carter', 'Sara Williams', 'Priya Shah', 'Anonymous'].map((name) => {
                const m = teamMembers.find((t) => t.name === name) || null;
                const active = m ? m.active : false;
                return (
                  <button
                    key={name}
                    onClick={() => openForMember(name)}
                    style={{
                      textAlign: 'left',
                      background: active ? C.activeBg : C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: m?.colour ?? C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.bg, fontWeight: 700 }}>
                      {name.split(' ')[0].charAt(0)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ fontSize: 12, color: C.textDim }}>{m?.role ?? 'Anonymous'}</div>
                    </div>
                  </button>
                );
              })}
            </div>

              <div style={{ boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, width: '100%', minWidth: 420, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, overflow: 'hidden' }}>
                {sheetMemberId ? (
                  <MotivationRadar
                    size={380}
                    series={[
                      { label: (teamMembers.find((m) => m.id === sheetMemberId)?.name || 'Member').split(' ')[0], values: memberDrivers[sheetMemberId], colour: teamMembers.find((m) => m.id === sheetMemberId)?.colour || '#C2F542' },
                      { label: 'Team avg', values: teamAverageDrivers, colour: '#A0E0FF', fill: '#A0E0FF' },
                    ]}
                  />
                ) : sheetMemberName === 'Overall Team' ? (
                  <MotivationRadar size={380} series={[{ label: 'Team avg', values: teamAverageDrivers, colour: '#A0E0FF' }]} />
                ) : sheetMemberName ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 680, padding: '20px', borderRadius: 12, border: `1px dashed ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 22, fontWeight: 700, textAlign: 'center', fontFamily: "'Tomorrow', sans-serif" }}>
                      No data for this member.
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 680, padding: '20px', borderRadius: 12, background: 'transparent', color: C.textDim, fontSize: 22, fontWeight: 700, textAlign: 'center', fontFamily: "'Tomorrow', sans-serif" }}>
                      Select a team member to view motivation
                    </div>
                  </div>
                )}
              </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              onClick={() => openOverall()}
              style={{
                background: trendColour,
                color: '#0A0A0C',
                border: 'none',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontFamily: "'Futura', 'Tomorrow', sans-serif",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              Overall Team Motivation
            </button>
          </div>
        </div>
      </div>

      {/* ─── Glowing orb at the bottom (click → chat) ─── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, padding: '40px 0 8px', marginTop: 32,
      }}>
        <button
          onClick={() => navigate('/chat')}
          aria-label="Open Coach SOPHIA"
          style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer',
            transition: 'transform 0.18s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <SophiaGlowOrb size={180} />
        </button>
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.8, fontFamily: "'Tomorrow', sans-serif" }}>
          Click to chat with SOPHIA
        </div>
      </div>

      <MotivationPanel
        open={motivation.open}
        onClose={() => setMotivation({ open: false, memberId: null })}
        memberId={motivation.memberId}
      />

      {addMemberOpen && !isOverall && (
        <AddMemberModal
          teamName={activeTeam.team_name}
          existingIds={activeTeam.member_ids}
          onClose={() => setAddMemberOpen(false)}
          onAdd={(memberId) => {
            addMemberToTeam(activeTeam.team_id, memberId);
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  teamName,
  existingIds,
  onClose,
  onAdd,
}: {
  teamName: string;
  existingIds: string[];
  onClose: () => void;
  onAdd: (memberId: string) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const candidates = teamMembers.filter((m) => !existingIds.includes(m.id));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24,
          fontFamily: "'Tomorrow', sans-serif",
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 600, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>
            Add to {teamName}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 18 }}>
          Add an existing teammate or invite someone new by email.
        </div>

        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
          From your workspace
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
          {candidates.length === 0 && (
            <div style={{ fontSize: 12, color: C.textDim, fontStyle: 'italic', padding: '8px 0' }}>
              Everyone is already on this team.
            </div>
          )}
          {candidates.map((m) => {
            const initials = m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <button
                key={m.id}
                onClick={() => { onAdd(m.id); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px', borderRadius: 10,
                  background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer',
                  color: C.text, fontSize: 13, textAlign: 'left',
                  fontFamily: "'Tomorrow', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.name}
                    onError={(e) => {
                      (e.currentTarget.style.display = 'none');
                      const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.display = 'flex';
                    }}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : null}
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#3a3a3e',
                  display: m.avatar ? 'none' : 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0,
                }}>
                  {initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif" }}>{m.name}</div>
                  <div style={{ fontSize: 10.5, color: C.textDim }}>{m.role}</div>
                </div>
                <Plus size={13} style={{ color: C.textDim }} />
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
          Invite by email
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              background: C.inputBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13,
              fontFamily: "'Tomorrow', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => {
              if (!inviteEmail.trim()) return;
              alert(`Invite sent to ${inviteEmail.trim()} — design preview`);
              onClose();
            }}
            disabled={!inviteEmail.trim()}
            style={{
              background: inviteEmail.trim() ? C.teal : C.border,
              color: '#0A0A0C',
              border: 'none', borderRadius: 8, padding: '0 18px',
              cursor: inviteEmail.trim() ? 'pointer' : 'not-allowed',
              fontSize: 12, fontWeight: 600,
              fontFamily: "'Futura', 'Tomorrow', sans-serif",
              opacity: inviteEmail.trim() ? 1 : 0.5,
            }}
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      {title && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, color: C.textDim, letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 600,
            fontFamily: "'Tomorrow', sans-serif",
          }}>
            {title}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function ReflectionBlock({ label, colour, items }: { label: string; colour: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, letterSpacing: 1.2, color: colour, marginBottom: 10, fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            fontSize: 12.5,
            color: C.text,
            lineHeight: 1.6,
            fontFamily: "'Tomorrow', sans-serif",
          }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  events,
  teamColour,
  teamForEvent,
}: {
  anchor: Date;
  events: typeof calendarEvents;
  teamColour: (teamName: string) => string;
  teamForEvent: (e: typeof calendarEvents[number]) => string;
}) {
  // Build a 6-row grid (Mon-Sun) covering the month containing `anchor`
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const todayKey = new Date().toDateString();

  const cells: { day: number; iso: string; inMonth: boolean; isToday: boolean; events: typeof calendarEvents }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = d.toDateString();
    cells.push({
      day: d.getDate(),
      iso: d.toISOString(),
      inMonth: d.getMonth() === anchor.getMonth(),
      isToday: key === todayKey,
      events: events.filter((e) => new Date(e.start).toDateString() === key),
    });
  }

  // Trim trailing weeks with no in-month days (don't show 6th row if not needed)
  const usedRows: typeof cells[] = [];
  for (let r = 0; r < 6; r++) {
    const row = cells.slice(r * 7, (r + 1) * 7);
    if (r >= 4 && row.every((c) => !c.inMonth)) break;
    usedRows.push(row);
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: '14px 16px',
    }}>
      {/* Weekday header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 8,
        marginBottom: 8,
        fontFamily: "'Tomorrow', sans-serif",
      }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{
            fontSize: 10, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase',
            textAlign: 'left', padding: '0 6px',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {usedRows.map((row, ri) => (
          <div key={ri} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
          }}>
            {row.map((c) => (
              <div key={c.iso} style={{
                minHeight: 92,
                background: c.isToday ? `${C.teal}10` : 'transparent',
                border: `1px solid ${c.isToday ? C.tealBorder : C.border}`,
                borderRadius: 10,
                padding: '8px 8px',
                opacity: c.inMonth ? 1 : 0.35,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <div style={{
                  fontSize: 12,
                  color: c.isToday ? C.teal : C.text,
                  fontWeight: c.isToday ? 700 : 500,
                  fontFamily: "'Futura', 'Tomorrow', sans-serif",
                }}>
                  {c.day}
                </div>
                {c.events.slice(0, 3).map((e) => {
                  const team = teamForEvent(e);
                  const colour = teamColour(team);
                  return (
                    <div key={e.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 5px',
                      borderRadius: 5,
                      background: `${colour}20`,
                      fontSize: 10,
                      color: C.text,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: colour, flexShrink: 0,
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.title}
                      </span>
                    </div>
                  );
                })}
                {c.events.length > 3 && (
                  <div style={{ fontSize: 10, color: C.textDim, padding: '0 5px' }}>
                    +{c.events.length - 3} more
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamMemberRow({ member, onClick }: { member: typeof teamMembers[number]; onClick: () => void }) {
  const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  if (!member.active) {
    // Anonymous member — privacy-preserving placeholder
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 6px',
        borderRadius: 10,
        opacity: 0.7,
        cursor: 'default',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'transparent',
          border: `1.5px dashed ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.textDim,
          fontSize: 11,
          flexShrink: 0,
        }}>
          ?
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: "'Tomorrow', sans-serif", fontStyle: 'italic' }}>
            Anonymous member
          </div>
          <div style={{ fontSize: 10.5, color: C.textDim }}>
            Not yet enrolled
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 6px',
        borderRadius: 10,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Tomorrow', sans-serif",
        color: C.text,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Active green ring */}
        <span style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          border: '2px solid #34D399',
          boxShadow: '0 0 8px rgba(52,211,153,0.45)',
          pointerEvents: 'none',
        }} />
        {member.avatar ? (
          <>
            <img
              src={member.avatar}
              alt={member.name}
              onError={(e) => {
                (e.currentTarget.style.display = 'none');
                const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (sib) sib.style.display = 'flex';
              }}
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
            <span style={{
              width: 30, height: 30, borderRadius: '50%', background: '#3a3a3e',
              display: 'none', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#fff',
            }}>{initials}</span>
          </>
        ) : (
          <span style={{
            width: 30, height: 30, borderRadius: '50%', background: '#3a3a3e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: '#fff',
          }}>{initials}</span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: C.text, fontFamily: "'Futura', 'Tomorrow', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.name}
        </div>
        <div style={{ fontSize: 10.5, color: C.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.role}
        </div>
      </div>
    </button>
  );
}

function SmoothLineChart({ data, min, max, colour }: { data: { label: string; value: number }[]; min: number; max: number; colour: string }) {
  const W = 700;
  const H = 200;
  const PADDING = 16;
  const range = Math.max(1, max - min);
  const xFor = (i: number) => (i / Math.max(1, data.length - 1)) * (W - PADDING * 2) + PADDING;
  const yFor = (v: number) => H - PADDING - ((v - min) / range) * (H - PADDING * 2);

  // Catmull-Rom -> Bezier for smoothness
  const points = data.map((d, i) => [xFor(i), yFor(d.value)] as const);
  const path = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const p0 = arr[i - 2] || arr[i - 1];
    const p1 = arr[i - 1];
    const p2 = p;
    const p3 = arr[i + 1] || p;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    return `${acc} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }, '');

  const fillPath = `${path} L ${points[points.length - 1][0]} ${H - PADDING} L ${points[0][0]} ${H - PADDING} Z`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.32" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={PADDING} x2={W - PADDING} y1={(H - PADDING * 2) * g + PADDING} y2={(H - PADDING * 2) * g + PADDING} stroke="rgba(150,150,150,0.18)" strokeDasharray="3 4" />
      ))}
      <path d={fillPath} fill="url(#trendGrad)" />
      <path d={path} fill="none" stroke={colour} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={5} fill={colour} />
    </svg>
  );
}

function TeamTrendChart({ series, labels }: { series: { name: string; color: string; values: number[] }[]; labels: string[] }) {
  const W = 700;
  const H = 220;
  const P = 20;
  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 1);
  const xFor = (i: number) => (i / Math.max(1, labels.length - 1)) * (W - P * 2) + P;
  const yFor = (v: number) => H - P - ((v - min) / Math.max(1, max - min)) * (H - P * 2);

  const paths = series.map((s) => {
    return s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  });

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g, idx) => (
        <line key={idx} x1={P} x2={W - P} y1={(H - P * 2) * g + P} y2={(H - P * 2) * g + P} stroke="rgba(150,150,150,0.12)" strokeDasharray="3 4" />
      ))}
      {series.map((s, si) => (
        <g key={s.name}>
          <path d={paths[si]} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinecap="round" />
          {s.values.map((v, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(v)} r={3.5} fill={s.color} />
          ))}
        </g>
      ))}
      {/* X labels */}
      {labels.map((lab, i) => (
        <text key={lab} x={xFor(i)} y={H - 6} fontSize={10} fill={C.textDim} textAnchor="middle">{lab}</text>
      ))}
    </svg>
  );
}

function TeamMotivationChart({ dimensions, teamAverage, individualScores, selected }: {
  dimensions: string[];
  teamAverage: Record<string, number>;
  individualScores: Record<string, Record<string, number>>;
  selected: string;
}) {
  // Radar/spider chart version to match the provided design
  const W = 700;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const r = Math.min(W, H) * 0.32;
  const count = dimensions.length;

  const angleFor = (i: number) => -Math.PI / 2 + (i / count) * Math.PI * 2;
  const pointFor = (value: number, i: number) => {
    const angle = angleFor(i);
    const ratio = Math.max(0, Math.min(1, value / 100));
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio] as const;
  };

  const teamPoints = dimensions.map((d, i) => pointFor(teamAverage[d] ?? 0, i));
  const individualPoints = selected !== 'All members' ? dimensions.map((d, i) => pointFor(individualScores[selected]?.[d] ?? 0, i)) : null;

  const polygonPath = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* circular grid */}
      {[0.25, 0.5, 0.75, 1].map((g, gi) => (
        <circle key={gi} cx={cx} cy={cy} r={r * g} fill="none" stroke="rgba(150,150,150,0.08)" />
      ))}

      {/* axis lines */}
      {dimensions.map((dim, i) => {
        const ang = angleFor(i);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        return <line key={dim} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(150,150,150,0.06)" />;
      })}

      {/* team polygon (behind) */}
      <path d={polygonPath(teamPoints as any)} fill={C.tealGlow} stroke={C.tealMuted} strokeWidth={1.8} />

      {/* individual polygon if selected */}
      {individualPoints && (
        <path d={polygonPath(individualPoints as any)} fill={C.teal} fillOpacity={0.15} stroke={C.teal} strokeWidth={2.4} />
      )}

      {/* labels around */}
      {dimensions.map((dim, i) => {
        const ang = angleFor(i);
        const lx = cx + Math.cos(ang) * (r + 22);
        const ly = cy + Math.sin(ang) * (r + 22);
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.abs(Math.cos(ang)) > 0.3) anchor = Math.cos(ang) > 0 ? 'start' : 'end';
        return (
          <text key={dim} x={lx} y={ly} fontSize={12} fill={C.text} textAnchor={anchor} fontFamily="'Tomorrow', sans-serif">
            {dim}
          </text>
        );
      })}

      {/* numeric points (team / individual) */}
      {teamPoints.map((p, i) => (
        <circle key={`t-${i}`} cx={p[0]} cy={p[1]} r={4} fill={C.tealMuted} />
      ))}
      {individualPoints && individualPoints.map((p, i) => (
        <circle key={`i-${i}`} cx={p[0]} cy={p[1]} r={4} fill={C.teal} />
      ))}
    </svg>
  );
}
