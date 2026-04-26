/**
 * Mock API server for design preview.
 * Intercepts fetch + axios calls to localhost:8000 and returns canned data.
 * Keeps the UI happy with no real backend.
 */

import {
  me,
  myGoals,
  teams,
  meetings,
  teamTrends,
  calendarEvents,
  myDrivers,
} from './mock-data';

// Stub window.Clerk — coach.ts reads it directly to build auth headers.
(window as any).Clerk = {
  session: { getToken: async () => 'stub-token' },
  user: { id: me.id },
  organization: { id: 'innersystems' },
};

const API_HOSTS = ['localhost:8000', '127.0.0.1:8000'];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ---- Profile ----
const fakeProfile = {
  id: 'profile-mikey',
  user_id: me.id,
  role_title: me.role_title,
  role_description: me.role_description,
  goals: myGoals.map((g) => ({ title: g.title, description: g.description })),
  motivation_json: {
    goals: myGoals.map((g) => ({ title: g.title, description: g.description })),
    drivers: myDrivers,
  },
  job_drivers_json: myDrivers,
  consent: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---- Sessions / messages ----
const fakeSessions = [
  {
    id: 'session-1',
    title: 'This week reflection',
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    last_message_at: new Date(Date.now() - 3_600_000).toISOString(),
    is_persistent: true,
  },
  {
    id: 'session-2',
    title: 'Hiring strategy',
    created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    last_message_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    is_persistent: false,
  },
];

const fakeMessages = [
  {
    id: 'msg-1',
    session_id: 'session-1',
    role: 'assistant',
    content: "Welcome back, Mikey. What's on your mind?",
    created_at: new Date(Date.now() - 3_700_000).toISOString(),
  },
];

// ---- Insights for chat right rail (legacy shape) ----
const fakeRailInsights = {
  period: 'weeks',
  insights: meetings.slice(0, 3).map((m) => ({
    date: m.date,
    date_label: m.date_label,
    meeting_title: m.title,
    meeting_id: parseInt(m.id.replace(/\D/g, ''), 10) || 0,
    qualitative_observation: m.insight,
    start_items: m.what_was_good.slice(0, 2),
    stop_items: m.blind_spots.slice(0, 2),
  })),
};

const fakeCommitments = [
  { id: 'c-1', text: 'Block 2h Friday for deep work', status: 'active', created_at: new Date().toISOString() },
];

// ---- Route table ----
type Handler = (url: URL, init?: RequestInit) => unknown;
const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  // Legacy consent
  { method: 'GET', pattern: /\/api\/v1\/users\/consent$/, handler: () => ({ recording: true, patterns: true, coaching: true, aggregation: true, all_accepted: true }) },
  { method: 'POST', pattern: /\/api\/v1\/users\/consent$/, handler: () => ({ recording: true, patterns: true, coaching: true, aggregation: true, all_accepted: true }) },

  // Coach consent (new) — auto-accepted so chat goes straight in
  { method: 'GET', pattern: /\/api\/v1\/coach\/consent$/, handler: () => ({ consented: true, granted_at: new Date().toISOString(), revoked_at: null }) },
  { method: 'POST', pattern: /\/api\/v1\/coach\/consent$/, handler: () => ({ consented: true, granted_at: new Date().toISOString(), revoked_at: null }) },
  { method: 'DELETE', pattern: /\/api\/v1\/coach\/consent$/, handler: () => ({ consented: false, granted_at: null, revoked_at: new Date().toISOString() }) },

  // Calibration auto-complete
  { method: 'GET', pattern: /\/api\/v1\/coach\/calibration$/, handler: () => ({ directness: 'balanced', accountability: 'friendly', memory_level: 'commitments', calibration_completed: true }) },
  { method: 'POST', pattern: /\/api\/v1\/coach\/calibration$/, handler: () => ({ directness: 'balanced', accountability: 'friendly', memory_level: 'commitments', calibration_completed: true }) },

  // Profile
  { method: 'GET', pattern: /\/api\/v1\/coach\/profile\/exists$/, handler: () => ({ exists: true }) },
  { method: 'GET', pattern: /\/api\/v1\/coach\/profile$/, handler: () => fakeProfile },
  { method: 'POST', pattern: /\/api\/v1\/coach\/profile$/, handler: () => fakeProfile },

  // Sessions / messages
  { method: 'GET', pattern: /\/api\/v1\/coach\/sessions$/, handler: () => fakeSessions },
  { method: 'GET', pattern: /\/api\/v1\/coach\/session\/persistent$/, handler: () => fakeSessions[0] },
  { method: 'GET', pattern: /\/api\/v1\/coach\/session\/[^/]+\/messages$/, handler: () => fakeMessages },
  { method: 'GET', pattern: /\/api\/v1\/coach\/session\/[^/]+\/history$/, handler: () => fakeMessages },
  { method: 'GET', pattern: /\/api\/v1\/coach\/session\/[^/]+$/, handler: () => fakeSessions[0] },
  { method: 'POST', pattern: /\/api\/v1\/coach\/session\/start$/, handler: () => ({ session_id: 'session-new' }) },
  { method: 'POST', pattern: /\/api\/v1\/coach\/session\/[^/]+\/message$/, handler: () => ({ id: 'msg-new', role: 'assistant', content: 'Stubbed response.' }) },

  // Insights / commitments / preferences / role
  { method: 'GET', pattern: /\/api\/v1\/coach\/insights$/, handler: () => [] },
  { method: 'GET', pattern: /\/api\/v1\/coach\/rail-insights/, handler: () => fakeRailInsights },
  { method: 'GET', pattern: /\/api\/v1\/coach\/growth-rings$/, handler: () => ({ rings: [], total: 0 }) },
  { method: 'GET', pattern: /\/api\/v1\/coach\/commitments$/, handler: () => fakeCommitments },
  { method: 'GET', pattern: /\/api\/v1\/coach\/preferences$/, handler: () => ({ tone: 'warm', frequency: 'weekly' }) },
  { method: 'GET', pattern: /\/api\/v1\/coach\/role$/, handler: () => ({ role_title: me.role_title, role_description: me.role_description }) },
  { method: 'GET', pattern: /\/api\/v1\/coach\/questionnaire/, handler: () => ({ questions: [] }) },

  // Teams
  { method: 'GET', pattern: /\/api\/v1\/teams\/?$/, handler: () => teams },
  { method: 'GET', pattern: /\/api\/v1\/teams\/[^/]+\/members$/, handler: () => [] },
  { method: 'GET', pattern: /\/api\/v1\/teams\/[^/]+\/scores/, handler: (url: URL) => {
      const id = url.pathname.split('/')[4] || 'innersystems';
      return teamTrends[id] || teamTrends.innersystems;
    } },
  { method: 'GET', pattern: /\/api\/v1\/teams\/[^/]+\/insights/, handler: () => meetings.slice(0, 3) },
  { method: 'GET', pattern: /\/api\/v1\/teams\/[^/]+$/, handler: (url: URL) => {
      const id = url.pathname.split('/').pop();
      return teams.find((t) => t.team_id === id) || teams[0];
    } },

  // Meetings
  { method: 'GET', pattern: /\/api\/v1\/meetings\/?$/, handler: () => meetings },
  { method: 'GET', pattern: /\/api\/v1\/meetings\/[^/]+$/, handler: (url: URL) => {
      const id = url.pathname.split('/').pop();
      return meetings.find((m) => m.id === id) || null;
    } },
  { method: 'GET', pattern: /\/api\/v1\/meetings\/[^/]+\/transcript$/, handler: () => ({ turns: [] }) },

  { method: 'GET', pattern: /\/api\/v1\/calendar\/events/, handler: () => calendarEvents },
  { method: 'GET', pattern: /\/api\/v1\/voiceprints\/?$/, handler: () => [] },
];

const matchRoute = (method: string, url: URL): Handler | null => {
  for (const r of routes) {
    if (r.method.toUpperCase() === method.toUpperCase() && r.pattern.test(url.pathname)) {
      return r.handler;
    }
  }
  return null;
};

const isMockableUrl = (url: string | URL): URL | null => {
  try {
    const u = typeof url === 'string' ? new URL(url, window.location.origin) : url;
    if (API_HOSTS.some((h) => u.host === h)) return u;
    return null;
  } catch {
    return null;
  }
};

// ---- Streaming SSE response for coach messages ----
const buildStreamingResponse = (_userText: string): Response => {
  const encoder = new TextEncoder();
  const replies = [
    "I hear you. ",
    "Before we go to the answer — ",
    "what's actually true for you about this right now? ",
    "What would 'enough' look like by the end of the week?",
  ];
  const messageId = `msg-${Date.now()}`;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      send({ type: 'status', payload: { state: 'thinking' } });
      await wait(150);
      for (const chunk of replies) {
        send({ type: 'text_delta', payload: chunk });
        await wait(220);
      }
      send({ type: 'done', payload: { message_id: messageId } });
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
};

// ---- Fetch interceptor ----
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const reqUrl = input instanceof Request ? input.url : (input as string | URL);
  const url = isMockableUrl(reqUrl);
  if (!url) return realFetch(input, init);

  const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();

  if (method === 'POST' && /\/api\/v1\/coach\/session\/[^/]+\/message\/stream$/.test(url.pathname)) {
    let userText = '';
    try {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      userText = body.content || '';
    } catch { /* ignore */ }
    return buildStreamingResponse(userText);
  }

  const handler = matchRoute(method, url);
  if (handler) return json(handler(url, init) ?? {});

  console.info(`[mock-server] unmatched ${method} ${url.pathname} — returning {}`);
  return json({});
};

console.info('[mock-server] active — all calls to localhost:8000 are mocked.');

export {};
