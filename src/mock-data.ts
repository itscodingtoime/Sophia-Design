/**
 * Rich mock data for the design preview.
 * Realistic-looking content so every screen has something to render.
 */

// ─── Identity ──────────────────────────────────────────────────────────
export const me = {
  id: 'mikey-1',
  name: 'Mikey Ferraris',
  first_name: 'Mikey',
  last_name: 'Ferraris',
  email: 'mikey@innersystems.ai',
  role_title: 'Founder & CEO',
  role_description: 'Building InnerSystems. Leading product, design, and team culture.',
  avatar: '/mikey.jpg',
};

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  colour: string;
  /** Has the member set up SOPHIA + enrolled their voiceprint? */
  active: boolean;
}

export const teamMembers: TeamMember[] = [
  { id: 'mikey-1',  name: 'Mikey Ferraris', role: 'Founder & CEO',          avatar: '/mikey.jpg', colour: '#C2F542', active: true },
  { id: 'ben-1',    name: 'Ben Carter',     role: 'Co-founder & COO',       avatar: '', colour: '#FFB28A', active: true },
  { id: 'sara-1',   name: 'Sara Williams',  role: 'Head of Product',        avatar: '', colour: '#A0E0FF', active: true },
  { id: 'leo-1',    name: 'Leo Park',       role: 'Head of Marketing',      avatar: '', colour: '#D8B7FF', active: false },
  { id: 'priya-1',  name: 'Priya Shah',     role: 'Product Manager',        avatar: '', colour: '#FF9CB6', active: true },
  { id: 'tom-1',    name: 'Tom Davis',      role: 'Operations Manager',     avatar: '', colour: '#FFD988', active: false },
];

export type TeamIcon = 'rocket' | 'sparkles' | 'megaphone' | 'cog' | 'briefcase' | 'compass' | 'flame' | 'leaf' | 'star' | 'target';

export interface Team {
  team_id: string;
  team_name: string;
  description: string;
  member_ids: string[];
  health: number;
  direction: 'rising' | 'steady' | 'declining';
  default_colour: string;
  icon: TeamIcon;
  created_at: string;
}

export const TEAM_SWATCHES = ['#C2F542', '#A0E0FF', '#FFB28A', '#D8B7FF', '#FF9CB6', '#FFD988', '#9DBE6E'];
export const TEAM_ICONS: TeamIcon[] = ['rocket', 'sparkles', 'megaphone', 'cog', 'briefcase', 'compass', 'flame', 'leaf', 'star', 'target'];

export const teams: Team[] = [
  {
    team_id: 'product',
    team_name: 'Product',
    description: 'Product & design',
    member_ids: ['mikey-1', 'sara-1', 'priya-1'],
    health: 82,
    direction: 'rising',
    default_colour: '#A0E0FF',
    icon: 'rocket',
    created_at: '2025-10-15T00:00:00Z',
  },
  {
    team_id: 'marketing',
    team_name: 'Marketing',
    description: 'Brand, growth, content',
    member_ids: ['mikey-1', 'leo-1'],
    health: 74,
    direction: 'rising',
    default_colour: '#FF9CB6',
    icon: 'megaphone',
    created_at: '2025-10-15T00:00:00Z',
  },
  {
    team_id: 'operations',
    team_name: 'Operations',
    description: 'Hiring, finance, infrastructure',
    member_ids: ['mikey-1', 'ben-1', 'tom-1'],
    health: 71,
    direction: 'steady',
    default_colour: '#FFB28A',
    icon: 'cog',
    created_at: '2025-10-15T00:00:00Z',
  },
];

// ─── 7 Motivation Drivers ─────────────────────────────────────────────
export const driverNames = [
  'Achievement',
  'Influence',
  'Connection',
  'Autonomy',
  'Recognition',
  'Purpose',
  'Growth',
] as const;
export type DriverName = (typeof driverNames)[number];

export const myDrivers: Record<DriverName, number> = {
  Achievement: 84,
  Influence: 62,
  Connection: 71,
  Autonomy: 88,
  Recognition: 38,
  Purpose: 92,
  Growth: 80,
};

export const teamAverageDrivers: Record<DriverName, number> = {
  Achievement: 70,
  Influence: 55,
  Connection: 78,
  Autonomy: 64,
  Recognition: 60,
  Purpose: 74,
  Growth: 68,
};

export const memberDrivers: Record<string, Record<DriverName, number>> = {
  'mikey-1': myDrivers,
  'ben-1':   { Achievement: 76, Influence: 58, Connection: 80, Autonomy: 72, Recognition: 50, Purpose: 78, Growth: 70 },
  'sara-1':  { Achievement: 65, Influence: 52, Connection: 86, Autonomy: 60, Recognition: 72, Purpose: 80, Growth: 74 },
  'leo-1':   { Achievement: 62, Influence: 48, Connection: 70, Autonomy: 58, Recognition: 64, Purpose: 60, Growth: 76 },
  'priya-1': { Achievement: 78, Influence: 70, Connection: 82, Autonomy: 56, Recognition: 66, Purpose: 78, Growth: 70 },
  'tom-1':   { Achievement: 60, Influence: 45, Connection: 72, Autonomy: 62, Recognition: 55, Purpose: 64, Growth: 58 },
};

export const blindSpots: Record<string, string[]> = {
  'mikey-1': [
    'Recognition is your lowest driver (38). High-purpose leaders often forget that team members with strong recognition needs experience silence as criticism. Audit: when did you last name a specific contribution publicly?',
    'Your Autonomy (88) is well above the team average (64). You assume people want to be left alone to figure it out — Sara and Priya both score lower and are likely starved of the structured check-ins you find suffocating.',
    'High Purpose can compress short-term Achievement wins. The team has shipped three meaningful pieces this month and the framing has been "we still need to…" instead of "we landed it."',
  ],
  'ben-1': ['High Connection driver — risk of avoiding the harder cofounder conversations. The runway disagreement two weeks ago ended in a polite truce; it hasn\'t actually been resolved.'],
  'sara-1': ['High Recognition (72). Direct, frequent, specific feedback lands as care. Generic "great work" can read as dismissive.'],
  'leo-1': ['Lower Purpose (60). Reconnect his work to the product outcome — he\'s closer to the engineering reps than the user.'],
  'priya-1': ['Lower Autonomy (56). She wants more agency than the current process allows. Where can you give her ownership of a vertical?'],
  'tom-1': ['Growth is the lowest driver (58). A clear development plan with named next-skill milestones would unlock momentum.'],
};

// ─── Team-specific health trends ──────────────────────────────────────
// Smoothed (3-point moving average baked in) and broken into M / Q / Y windows.
// Each team has its own arc so the picker actually shows differences.
export interface TrendPoint {
  label: string;
  value: number;
}
export interface TeamTrend {
  monthly: TrendPoint[];   // last 30 days, weekly buckets x 4
  quarterly: TrendPoint[]; // last 12 months, monthly buckets x 12 — but rendered for the active 3 months
  yearly: TrendPoint[];    // last 12 months, monthly buckets x 12
}

const smooth = (raw: number[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(raw.length - 1, i + 1)];
    out.push(Math.round((a + b + c) / 3));
  }
  return out;
};

// Dynamic labels relative to today
const formatDateLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const formatMonthYearLabel = (d: Date) => {
  const yy = d.getFullYear().toString().slice(-2);
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${mon} ${yy}`;
};

// Monthly: last 5 weekly buckets (weeks ending each Sunday going back), labels = "1 Apr"
const buildMonthly = (raw: number[]): TrendPoint[] => {
  const today_ = new Date();
  const smoothed = smooth(raw);
  return smoothed.map((v, i) => {
    const d = new Date(today_);
    d.setDate(today_.getDate() - (smoothed.length - 1 - i) * 7);
    return { label: formatDateLabel(d), value: v };
  });
};

// Quarterly: last 3 months (monthly buckets), labels = "Feb 26"
const buildQuarterly = (raw: number[]): TrendPoint[] => {
  const today_ = new Date();
  const smoothed = smooth(raw);
  return smoothed.map((v, i) => {
    const d = new Date(today_.getFullYear(), today_.getMonth() - (smoothed.length - 1 - i), 1);
    return { label: formatMonthYearLabel(d), value: v };
  });
};

// Yearly: last 12 months (monthly buckets), labels = "Apr 25"
const buildYearly = (raw: number[]): TrendPoint[] => {
  const today_ = new Date();
  const smoothed = smooth(raw);
  return smoothed.map((v, i) => {
    const d = new Date(today_.getFullYear(), today_.getMonth() - (smoothed.length - 1 - i), 1);
    return { label: formatMonthYearLabel(d), value: v };
  });
};

// Curves are calibrated so:
//   monthly   → very flat (week-level noise, ±1 pt only)
//   quarterly → noticeable curve (month-level swings)
//   yearly    → biggest arc (full annual trajectory)
export const teamTrends: Record<string, TeamTrend> = {
  overall: {
    monthly:   buildMonthly([77, 77, 78, 77, 78]),
    quarterly: buildQuarterly([70, 75, 78]),
    yearly:    buildYearly([48, 52, 56, 60, 64, 68, 71, 73, 75, 76, 77, 78]),
  },
  product: {
    monthly:   buildMonthly([81, 82, 82, 81, 82]),
    quarterly: buildQuarterly([72, 78, 82]),
    yearly:    buildYearly([52, 58, 63, 67, 70, 73, 75, 77, 79, 80, 81, 82]),
  },
  marketing: {
    monthly:   buildMonthly([74, 74, 73, 75, 74]),
    quarterly: buildQuarterly([66, 71, 74]),
    yearly:    buildYearly([45, 50, 54, 57, 60, 62, 65, 67, 69, 71, 73, 74]),
  },
  operations: {
    monthly:   buildMonthly([71, 71, 72, 71, 71]),
    quarterly: buildQuarterly([76, 73, 71]),
    yearly:    buildYearly([85, 80, 76, 72, 68, 65, 64, 65, 67, 69, 70, 71]),
  },
};

// ─── Team direction signal (used in sidebar trend bar) ──────────────
export interface TeamHealthSignal {
  current: number;
  delta30d: number;
  direction: 'up' | 'flat' | 'down';
}
const signalFor = (raw: number[]): TeamHealthSignal => {
  const current = raw[raw.length - 1];
  const prior = raw[Math.max(0, raw.length - 4)];
  const delta30d = current - prior;
  const direction = delta30d > 1 ? 'up' : delta30d < -1 ? 'down' : 'flat';
  return { current, delta30d, direction };
};
export const teamHealthSignals: Record<string, TeamHealthSignal> = {
  overall:    signalFor([48, 52, 56, 60, 64, 68, 71, 73, 75, 76, 77, 78]),
  product:    signalFor([52, 58, 63, 67, 70, 73, 75, 77, 79, 80, 81, 82]),
  marketing:  signalFor([45, 50, 54, 57, 60, 62, 65, 67, 69, 71, 73, 74]),
  operations: signalFor([85, 80, 76, 72, 68, 65, 64, 65, 67, 69, 70, 71]),
};

// ─── Meetings + Insights (executive-coaching grade) ───────────────────
export interface MeetingReflection {
  id: string;
  title: string;
  team: string;
  date: string;
  date_label: string;
  duration_min: number;
  participants: string[];
  what_was_good: string[];
  blind_spots: string[];
  insight: string;
  unread: boolean;
}

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(today.getDate() - n);
  return d.toISOString();
};

export const meetings: MeetingReflection[] = [
  {
    id: 'mtg-1',
    title: 'Weekly product sync',
    team: 'Product',
    date: daysAgo(0),
    date_label: 'Today',
    duration_min: 42,
    participants: ['Mikey Ferraris', 'Sara Williams', 'Priya Shah'],
    what_was_good: [
      'You opened the meeting with three open questions before stating any direction. That gave Sara and Priya space to bring their context first — visible drop in tension within the first six minutes.',
      'When Sara raised the auth-flow concern (12:34), you slowed the cadence, asked what would make her confident, and didn\'t default to your usual "let\'s park it." She named the real worry: design debt compounding before launch.',
      'Decisions closed cleanly with named owners and dates. Three commits, three names — no ambiguity carried out of the room.',
    ],
    blind_spots: [
      'Priya started a thread on hiring at 28:10 that didn\'t get returned to. She brought it back twice; both times deflected to roadmap. Her energy noticeably dropped in the second half.',
      'You used "we\'ll come back to it" three times. None of those have a return point on a calendar. This is the second week the same parking-lot phrase has appeared.',
      'You finished Sara\'s sentence twice when she was building toward a recommendation. Both times your version was directionally right but lost her line of thought. Effect: she stopped finishing the third recommendation entirely.',
    ],
    insight:
      'Your inquiry stance is becoming a strength. The leverage move this week: notice the 1–2 second beat where you switch from listening to executing. Add a single deliberate breath there. It will let Priya finish, surface what she\'s actually carrying, and stop you from collapsing complex thinking into your own frame too early.',
    unread: true,
  },
  {
    id: 'mtg-2',
    title: 'Founders 1:1 with Ben',
    team: 'Operations',
    date: daysAgo(1),
    date_label: 'Yesterday',
    duration_min: 55,
    participants: ['Mikey Ferraris', 'Ben Carter'],
    what_was_good: [
      'You named the runway worry directly — "I\'m carrying anxiety about the burn and I want us to look at it together" — instead of lawyering it through with data. That is a meaningful shift from how you opened the same conversation in March.',
      'You acknowledged Ben\'s perspective on hiring twice before disagreeing. Each acknowledgement was specific, not a token "I hear you." Ben\'s posture relaxed.',
      'You held silence for 8 seconds after Ben said "I think we\'re moving too fast." That silence created room for him to finish his actual thought rather than reacting to the headline.',
    ],
    blind_spots: [
      'Tone shifted noticeably firmer at 38:00 when discussing Q3 roadmap. Ben\'s pace dropped immediately and stayed dropped. You made three statements before asking another question.',
      'You proposed three solutions for the senior-engineer hire before asking what Ben thought the right path was. With a co-founder, this compresses peer-thinking into employee-thinking.',
      'The conversation ended with you summarising the takeaways. Ben didn\'t add a single one. Watch for that pattern — when you summarise alone, alignment looks complete on the surface and isn\'t.',
    ],
    insight:
      'You lead with conviction, which is what gets things moving. With peers — especially a co-founder — that same conviction can quietly compress their thinking before it forms. The single highest-leverage move: in your next 1:1 with Ben, after you state your view, ask "what am I missing in how I\'m seeing this?" and wait. Treat the silence as data, not absence.',
    unread: true,
  },
  {
    id: 'mtg-3',
    title: 'Operations standup',
    team: 'Operations',
    date: daysAgo(2),
    date_label: 'Mon',
    duration_min: 18,
    participants: ['Ben Carter', 'Leo Park', 'Tom Davis'],
    what_was_good: [
      'Concise — three updates, two unblocks, one decision. Ben kept the room tight without it feeling rushed.',
      'Tom flagged a blocker early ("the Inngest retry config is biting us again") and Leo offered help unprompted within 30 seconds. That\'s the pattern you\'ve been encouraging in 1:1s.',
    ],
    blind_spots: [
      'Leo\'s frustration about review latency surfaced briefly at 11:00 and was glossed by the schedule. Third week running the same signal has been raised and not addressed at the meeting itself.',
      'Tom kept his camera off and was monosyllabic. He\'s done the same in the last two standups. The pattern is real — worth a 1:1 check-in this week.',
    ],
    insight:
      'Standups are doing their operational job. The latent issue is the review-latency thread: it keeps appearing, keeps getting deferred, and is now affecting morale rather than just throughput. Tom\'s withdrawal is likely correlated. Surfacing it explicitly — "I\'ve noticed we keep raising this and not addressing it. Can we name what would actually unblock it this week?" — would convert a recurring complaint into a decision.',
    unread: false,
  },
  {
    id: 'mtg-4',
    title: 'Design crit',
    team: 'Product',
    date: daysAgo(4),
    date_label: 'Last week',
    duration_min: 38,
    participants: ['Mikey Ferraris', 'Sara Williams'],
    what_was_good: [
      'You asked Sara to walk you through the system before reacting. Specifically, you said "show me how a new user gets to the second screen" rather than commenting on visual choices first. That\'s the right move with someone whose driver is Recognition.',
      'Behavioural feedback was concrete — "the spacing on the chart label drops the hierarchy" rather than "the chart feels off." Specific, named, defensible.',
    ],
    blind_spots: [
      'You praised the work twice and critiqued once, but the critique was the bigger truth. Ratio was inverse to actual conviction. Sara left believing you were 80% positive when internally you were 50/50 — that gap will surface badly later.',
      'You wrapped the real concern ("I don\'t think this onboarding sequence holds together") inside a "yes, and" — which Sara, with a high recognition driver, hears as praise. The signal didn\'t land.',
    ],
    insight:
      'You\'re calibrating well to Sara\'s recognition driver — but be honest about the bigger concern. The "yes, and" framing wrapped a real "but." Sara would rather hear the truth than be protected from it. A more useful frame: lead with the specific praise, then say "the part that\'s nagging me is X" — name it before you soften it.',
    unread: false,
  },
  {
    id: 'mtg-5',
    title: 'Hiring debrief',
    team: 'Operations',
    date: daysAgo(6),
    date_label: 'Last week',
    duration_min: 28,
    participants: ['Mikey Ferraris', 'Ben Carter', 'Priya Shah'],
    what_was_good: [
      'You named your own bias before deciding — "I\'m drawn to people I already trust." That kind of self-disclosure raises the safety in the room and Priya followed with her own bias confession.',
      'Trade-off conversation was clean: speed vs seniority. You held both sides without collapsing prematurely.',
    ],
    blind_spots: [
      'Priya raised a culture-fit concern at 11:40. The room moved to logistics within 90 seconds. Whether intentional or not, the deflection signalled "that concern isn\'t weighty here."',
      'Decision was made before all three of you said the same thing back. You said "let\'s go with X." Ben nodded. Priya said nothing. That\'s not alignment — that\'s acquiescence.',
    ],
    insight:
      'You make hiring decisions fast and confidently — that\'s a strength when speed matters. The cost is that culture-fit signals get less air time, especially from quieter voices. One discipline to try: before closing any hire, ask each person in the room "if we hire this person and it doesn\'t work, what\'s the most likely reason?" Forces the dissent into the open before the decision lands.',
    unread: false,
  },
];

// ─── Weekly insight + growth edge ─────────────────────────────────────
// Surfaces the pattern across the week so the user doesn't have to read
// every meeting reflection. Pinned at the top of /home.
export const weeklyInsight = {
  id: 'weekly',
  week_label: 'This week',
  pattern_title: 'You\'re proposing before peers finish thinking',
  pattern_body:
    'Across 3 of 4 meetings this week you proposed a solution before the other person finished their thought. Twice you summarised alone at the end. The pattern is consistent and rising — same signal flagged last week and the week before.',
  evidence: [
    { label: 'Meetings analysed', value: '4' },
    { label: 'Times you finished a sentence', value: '7' },
    { label: 'Threads parked w/o return', value: '3' },
  ],
  growth_edge_title: 'Hold one extra breath',
  growth_edge_body:
    'After you state your view, ask one open question and wait. Treat the silence as data, not absence. This single move converts the acquiescence pattern Ben and Priya are showing into real alignment.',
  unread_count: meetings.filter((m) => m.unread).length,
  generated_at: today.toISOString(),
};

// Backward-compatible alias used by the older banner.
export const latestInsight = {
  id: weeklyInsight.id,
  title: weeklyInsight.pattern_title,
  summary: weeklyInsight.pattern_body,
  unread_count: weeklyInsight.unread_count,
  generated_at: weeklyInsight.generated_at,
};

// ─── Per-team insight ─────────────────────────────────────────────────
export interface TeamInsight {
  pattern_title: string;
  pattern_body: string;
  growth_edge_title: string;
  growth_edge_body: string;
}
export const teamInsights: Record<string, TeamInsight> = {
  product: {
    pattern_title: 'Sara is leading with conviction — Priya is leaving thoughts unfinished',
    pattern_body:
      'Across the last 4 product meetings, Sara closed 80% of decisions confidently. Priya raised concerns twice and was redirected before finishing both times. Decisions are landing fast but the quietest voice is shrinking.',
    growth_edge_title: 'Make space for Priya to finish',
    growth_edge_body:
      'In the next product sync, ask Priya to speak first on the auth-flow thread. Hold the silence — even if it feels long. Her PM judgement is currently being absorbed instead of expressed.',
  },
  marketing: {
    pattern_title: 'Energy is rising but direction is splintering',
    pattern_body:
      'Three different campaign directions surfaced in the last two weeks (positioning refresh, founder-led content, paid LinkedIn). Each got a green-light moment and none have a single owner. Momentum is real; focus is not.',
    growth_edge_title: 'Pick one bet for the next 6 weeks',
    growth_edge_body:
      'Block 30 minutes with Leo to choose a single primary motion. Park the other two with explicit "not now" tags so they stop pulling oxygen.',
  },
  operations: {
    pattern_title: 'Operations is steady — but you and Ben aren\'t actually disagreeing in public',
    pattern_body:
      'In 5 of the last 7 ops meetings, the surface alignment between you and Ben masked a real divergence on hiring pace. The runway debate from March still hasn\'t been resolved on a calendar — it\'s recurring as polite consensus.',
    growth_edge_title: 'Name the disagreement out loud',
    growth_edge_body:
      'Open Thursday\'s 1:1 with: "I think we\'re still disagreeing on hiring pace and pretending we\'re not." Then let Ben respond before you keep going. The honesty is the unlock.',
  },
};

// ─── Calendar (Granola-style) ─────────────────────────────────────────
export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  team: string;
  participants: string[];
  type: 'meeting' | 'focus' | '1-on-1';
  highlighted?: boolean;
}

const at = (daysFromNow: number, hour: number, min = 0) => {
  const d = new Date(today);
  d.setDate(today.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

// ─── Calendar (synced — last 2 months + 10 days ahead) ───────────────
// Generated as a recurring weekly cadence so any moving "today" still has a
// full 8-week history, mimicking a synced Google/Outlook calendar.
const recurringEvents: Omit<CalEvent, 'id' | 'start' | 'end'>[] = [
  // Mondays (weekday index 1)
  { title: 'Weekly product sync',       team: 'Product',    participants: ['Sara Williams', 'Priya Shah'], type: 'meeting' },
  { title: '1:1 with Ben',              team: 'Operations', participants: ['Ben Carter'], type: '1-on-1' },
  // Tuesdays
  { title: 'Marketing standup',         team: 'Marketing',  participants: ['Leo Park'], type: 'meeting' },
  { title: 'Coach SOPHIA reflection',   team: 'Operations', participants: [], type: '1-on-1' },
  { title: 'Design crit',               team: 'Product',    participants: ['Sara Williams', 'Priya Shah'], type: 'meeting' },
  // Wednesdays
  { title: 'Operations review',         team: 'Operations', participants: ['Ben Carter', 'Tom Davis'], type: 'meeting' },
  { title: '1:1 with Sara',             team: 'Product',    participants: ['Sara Williams'], type: '1-on-1' },
  // Thursdays
  { title: 'Founders 1:1 with Ben',     team: 'Operations', participants: ['Ben Carter'], type: '1-on-1' },
  { title: 'Content review',            team: 'Marketing',  participants: ['Leo Park'], type: 'meeting' },
  // Fridays
  { title: 'All-hands',                 team: 'Operations', participants: ['Ben Carter', 'Sara Williams', 'Leo Park', 'Priya Shah', 'Tom Davis'], type: 'meeting' },
  { title: 'Hiring debrief',            team: 'Operations', participants: ['Ben Carter', 'Priya Shah'], type: 'meeting' },
];

// Slot the recurring template across each weekday in the last 8 weeks + 2 weeks ahead.
const buildSyncedCalendar = (): CalEvent[] => {
  const out: CalEvent[] = [];
  let id = 1;

  // Anchor on Monday of *this* week.
  const monday = (() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  })();

  // Week-by-week slot plan: [dayOffsetFromMonday, hour, durationMin, templateIndex]
  const weekPlan: [number, number, number, number][] = [
    [0, 10,    45,  0], // Mon - Weekly product sync
    [0, 14,    45,  1], // Mon - 1:1 with Ben
    [1,  9,    30,  2], // Tue - Marketing standup
    [1, 11,    30,  3], // Tue - SOPHIA reflection
    [1, 15,    60,  4], // Tue - Design crit
    [2, 11,    60,  5], // Wed - Operations review
    [2, 14,    30,  6], // Wed - 1:1 with Sara
    [3, 10,    60,  7], // Thu - Founders 1:1 with Ben
    [3, 14,    45,  8], // Thu - Content review
    [4, 10,    45,  9], // Fri - All-hands
    [4, 14,    45, 10], // Fri - Hiring debrief
  ];

  // Past 8 weeks (-8 .. -1) + this week (0) + 2 ahead (+1, +2)
  for (let w = -8; w <= 2; w++) {
    for (const [dayOffset, hour, durationMin, templateIdx] of weekPlan) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + w * 7 + dayOffset);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(start.getMinutes() + durationMin);
      const tpl = recurringEvents[templateIdx];
      out.push({
        id: `e${id++}`,
        title: tpl.title,
        start: start.toISOString(),
        end: end.toISOString(),
        team: tpl.team,
        participants: tpl.participants,
        type: tpl.type,
      });
    }
  }

  // One-off and ad-hoc meetings (recent + upcoming) — pull richness up.
  const oneOffs: Array<[number, number, number, string, string, string[], CalEvent['type']]> = [
    // [dayOffsetFromToday, hour, durationMin, title, team, participants, type]
    [0, 11, 90, 'Deep work — strategy',           '—',          [],                           'focus'],
    [0, 16, 60, 'Design review — onboarding',     'Product',    ['Sara Williams'],            'meeting'],
    [1,  9, 120,'Deep work — pricing',            '—',          [],                           'focus'],
    [1, 13, 60, 'Lunch w/ advisor (Maya)',        '—',          [],                           'meeting'],
    [2, 15, 90, 'Pricing workshop',               'Operations', ['Ben Carter', 'Priya Shah'], 'meeting'],
    [3, 16, 30, 'Investor catch-up',              '—',          [],                           'meeting'],
    [4, 17, 30, 'Friday reset',                   '—',          [],                           'focus'],
    [5, 11, 120,'Saturday family time',           '—',          [],                           'focus'],
    [6, 18, 60, 'Sunday planning',                '—',          [],                           'focus'],
    [7, 14, 90, 'Product roadmap review',         'Product',    ['Sara Williams', 'Priya Shah'], 'meeting'],
    [8, 10, 30, '1:1 with Priya',                 'Product',    ['Priya Shah'],               '1-on-1'],
    [8, 14, 60, 'Marketing planning',             'Marketing',  ['Leo Park'],                 'meeting'],
    [9, 11, 60, 'Customer interview — Ada',       'Product',    ['Sara Williams'],            'meeting'],
    [10, 13, 30,'1:1 with Leo',                   'Marketing',  ['Leo Park'],                 '1-on-1'],
    // ─── Past 2 months — extras to pad density ───
    [-3,  10, 30, '1:1 with Sara',                'Product',    ['Sara Williams'],            '1-on-1'],
    [-5,  11, 60, 'Brand workshop',               'Marketing',  ['Leo Park'],                 'meeting'],
    [-9,  14, 60, 'Investor pitch — Acme Capital','Operations', ['Ben Carter'],               'meeting'],
    [-11, 10, 45, 'Customer interview — Theo',    'Product',    ['Sara Williams'],            'meeting'],
    [-14, 13, 60, 'Quarterly review',             'Operations', ['Ben Carter', 'Sara Williams', 'Leo Park', 'Priya Shah', 'Tom Davis'], 'meeting'],
    [-17, 16, 30, 'Coffee w/ Ada (advisor)',      '—',          [],                           'meeting'],
    [-20, 11, 90, 'Pricing experiments review',   'Product',    ['Sara Williams', 'Priya Shah'], 'meeting'],
    [-23, 10, 60, 'Customer interview — Mei',     'Product',    ['Priya Shah'],               'meeting'],
    [-26, 15, 60, 'Marketing site walkthrough',   'Marketing',  ['Leo Park'],                 'meeting'],
    [-30, 14, 60, 'Founders offsite — day 1',     'Operations', ['Ben Carter'],               'meeting'],
    [-31, 10, 60, 'Founders offsite — day 2',     'Operations', ['Ben Carter'],               'meeting'],
    [-34, 11, 60, 'Customer interview — Jordan',  'Product',    ['Sara Williams'],            'meeting'],
    [-37, 16, 30, 'Investor update — Q3',         'Operations', [],                           'meeting'],
    [-41, 14, 90, 'Brand identity review',        'Marketing',  ['Leo Park', 'Sara Williams'], 'meeting'],
    [-45, 10, 60, 'Hiring panel — senior PM',     'Operations', ['Ben Carter', 'Priya Shah'], 'meeting'],
    [-48, 11, 45, 'Coach SOPHIA reflection',      'Operations', [],                           '1-on-1'],
    [-52, 14, 60, 'Customer interview — Sam',     'Product',    ['Priya Shah'],               'meeting'],
    [-55, 10, 30, 'Board prep',                   'Operations', ['Ben Carter'],               'meeting'],
    [-58, 16, 60, 'Marketing planning — Q1',      'Marketing',  ['Leo Park'],                 'meeting'],
  ];

  for (const [d, h, dur, title, team, participants, type] of oneOffs) {
    const start = at(d, h);
    const endD = new Date(start);
    endD.setMinutes(endD.getMinutes() + dur);
    out.push({
      id: `e${id++}`,
      title,
      start,
      end: endD.toISOString(),
      team,
      participants,
      type,
    });
  }

  // Mark the next-up meeting after `now` as highlighted.
  const now = Date.now();
  const upcoming = out
    .filter((e) => new Date(e.start).getTime() >= now && e.type !== 'focus')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  if (upcoming) upcoming.highlighted = true;

  return out;
};

export const calendarEvents: CalEvent[] = buildSyncedCalendar();

// ─── Studio recordings ────────────────────────────────────────────────
export interface Recording {
  id: string;
  title: string;
  date: string;
  duration_min: number;
  team: string;
  source: 'mic' | 'meeting' | 'fireflies' | 'otter' | 'granola' | 'teams' | 'meet' | 'zoom' | 'upload';
  participants: string[];
  status: 'processed' | 'processing' | 'failed';
}

export const recordings: Recording[] = [
  { id: 'r1', title: 'Weekly product sync',     date: daysAgo(0),  duration_min: 42, team: 'Product',    source: 'fireflies', participants: ['Mikey', 'Sara', 'Priya'], status: 'processed' },
  { id: 'r2', title: 'Founders 1:1 with Ben',   date: daysAgo(1),  duration_min: 55, team: 'Operations', source: 'granola',   participants: ['Mikey', 'Ben'],           status: 'processed' },
  { id: 'r3', title: 'Operations standup',      date: daysAgo(2),  duration_min: 18, team: 'Operations', source: 'meet',      participants: ['Ben', 'Leo', 'Tom'],      status: 'processed' },
  { id: 'r4', title: 'Design crit',             date: daysAgo(4),  duration_min: 38, team: 'Product',    source: 'mic',       participants: ['Mikey', 'Sara'],          status: 'processed' },
  { id: 'r5', title: 'Hiring debrief',          date: daysAgo(6),  duration_min: 28, team: 'Operations', source: 'otter',     participants: ['Mikey', 'Ben', 'Priya'],  status: 'processed' },
  { id: 'r6', title: 'Investor prep',           date: daysAgo(8),  duration_min: 65, team: 'Operations', source: 'zoom',      participants: ['Mikey', 'Ben'],           status: 'processed' },
  { id: 'r7', title: 'Brand workshop',          date: daysAgo(11), duration_min: 60, team: 'Marketing',  source: 'teams',     participants: ['Mikey', 'Leo'],           status: 'processed' },
];

// ─── Integrations ─────────────────────────────────────────────────────
export interface Integration {
  id: string;
  name: string;
  blurb: string;
  connected: boolean;
  colour: string;
  letter: string;
}
export const integrations: Integration[] = [
  { id: 'fireflies', name: 'Fireflies',     blurb: 'Auto-import meeting recordings + transcripts',          connected: true,  colour: '#FF6F50', letter: 'F' },
  { id: 'granola',   name: 'Granola',       blurb: 'Sync Granola notes and meeting timelines',              connected: true,  colour: '#9DBE6E', letter: 'G' },
  { id: 'otter',     name: 'Otter.ai',      blurb: 'Pull Otter transcripts directly into Studio',           connected: false, colour: '#1FB6FF', letter: 'O' },
  { id: 'meet',      name: 'Google Meet',   blurb: 'Connect Google Workspace for live meeting capture',     connected: true,  colour: '#34A853', letter: 'M' },
  { id: 'teams',     name: 'Microsoft Teams', blurb: 'Pull Teams calls + transcripts into Studio',          connected: false, colour: '#5059C9', letter: 'T' },
  { id: 'zoom',      name: 'Zoom',          blurb: 'Auto-import Zoom cloud recordings',                     connected: false, colour: '#2D8CFF', letter: 'Z' },
];

// ─── Goals (auto-derived intentions, shown in chat right rail) ────────
export const myGoals = [
  {
    id: 'g1',
    title: 'Slow the proposal beat',
    description:
      'Give peers and direct reports one more breath of thinking time before you propose a solution. Pattern detected across four meetings this week.',
    source: 'Auto-derived from this week\'s meetings',
    progress: 0.35,
  },
  {
    id: 'g2',
    title: 'Make recognition visible',
    description:
      'Increase frequency of specific, named recognition for Sara and Priya. Recognition is their second-highest driver and your lowest.',
    source: 'From motivation profile',
    progress: 0.5,
  },
  {
    id: 'g3',
    title: 'Return to parked threads',
    description:
      'Two threads from peers were parked this week without a return point. Build a habit of revisiting before closing the meeting.',
    source: 'From meeting pattern detection',
    progress: 0.2,
  },
];
