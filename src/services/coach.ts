/**
 * Coach API service for Personal AI Coaching.
 * 
 * Uses TanStack Query patterns for data fetching.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types
export type TrackType = 'sophia' | 'execution' | 'performance' | 'leadership' | 'communication' | 'wellbeing';
export type ModeType = 'support' | 'challenge' | 'coaching';
export type ConsentLevel = 'none' | 'aggregated' | 'private_coaching';

export interface Question {
    id: string;
    section?: string; // v1 only
    type: 'single_choice' | 'multi_choice' | 'likert' | 'text' | 'textarea' | 'rating' | 'radio' | 'checkbox';
    text: string;
    options?: (string | { value: string; label: string })[];
    placeholder?: string;
    required: boolean;
    conditional_on?: Record<string, string | string[]>;
    validation?: Record<string, unknown>;
}

// V2 section with nested questions
export interface QuestionnaireSection {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
}

// Support both v1 (flat) and v2 (nested) formats
export interface Questionnaire {
    version: number;
    schema_date?: string;
    // V1: flat arrays
    sections?: string[];
    questions?: Question[];
    // V2: nested sections with questions
    nested_sections?: QuestionnaireSection[];
}

export interface QuestionnaireResponse {
    version: number;
    questionnaire: Questionnaire;
}

export interface DraftResponse {
    id: string;
    version: number;
    responses: Record<string, unknown>;
    current_section?: string;
    updated_at: string;
}

export interface CoachProfile {
    id: string;
    user_id: string;
    profile: Record<string, unknown>;
    preferences: {
        never_ask_downshift: boolean;
        response_format?: string;
        custom_preferences?: Record<string, unknown>;
    };
    motivation: Record<string, unknown>;
    job_drivers: Record<string, unknown>;
    consent: {
        schema_version: number;
        meeting_trendlines: ConsentLevel;
        scope_window: string;
    };
    updated_at: string;
}

export interface CoachSession {
    id: string;
    track: TrackType;
    mode: ModeType;
    started_at: string;
    ended_at?: string;
    message_count: number;
    title?: string | null;  // AI-generated after 3rd message
}

export interface CoachMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    message_type?: 'regular' | 'brief' | 'proactive_opener';
    meeting_id?: number | null;
    created_at: string;
}

export interface MessageResponse {
    id: string;
    response: string;
    mode: ModeType;
    downshift_suggested: boolean;
}

// Helper to get auth header -- throws on missing Clerk session (BUG-15)
async function getAuthHeaders(): Promise<HeadersInit> {
    // Get token from Clerk (window.Clerk is injected by Clerk SDK)
    const clerkWindow = window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } };
    const clerkSession = clerkWindow.Clerk?.session;
    if (!clerkSession) {
        throw new Error('Clerk session unavailable — cannot authenticate coach request');
    }
    const token = await clerkSession.getToken();
    if (!token) {
        throw new Error('Failed to get auth token from Clerk session');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

// Questionnaire APIs
export async function getQuestionnaire(): Promise<QuestionnaireResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/questionnaire`, { headers });
    if (!res.ok) throw new Error('Failed to fetch questionnaire');
    return res.json();
}

export async function getDraft(): Promise<DraftResponse | null> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/questionnaire/draft`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch draft');
    return res.json();
}

export async function saveDraft(responses: Record<string, unknown>, currentSection?: string): Promise<DraftResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/questionnaire/draft`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ responses, current_section: currentSection }),
    });
    if (!res.ok) throw new Error('Failed to save draft');
    return res.json();
}

export async function submitQuestionnaire(version: number, responses: Record<string, unknown>): Promise<{ success: boolean; profile_id: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/questionnaire/response`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ version, responses }),
    });
    if (!res.ok) throw new Error('Failed to submit questionnaire');
    return res.json();
}

// Onboarding API
export async function submitOnboarding(data: {
    role: string;
    team_size?: string;
    industry?: string;
    key_goal: string;
}): Promise<{ success: boolean; profile_id: string; message: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/onboarding/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit onboarding');
    return res.json();
}

// Profile APIs
export async function getProfile(): Promise<CoachProfile> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/profile`, { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
}

export async function checkProfileExists(): Promise<{ exists: boolean; has_completed_onboarding: boolean }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/profile/exists`, { headers });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to check profile: ${res.status} — ${body}`);
    }
    return res.json();
}

export async function deleteProfile(): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/profile`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete profile');
}

// Session APIs
export async function startSession(track: TrackType, mode: ModeType = 'support'): Promise<CoachSession> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ track, mode }),
    });
    if (!res.ok) throw new Error('Failed to start session');
    return res.json();
}

export async function sendMessage(
    sessionId: string,
    content: string,
    orgName?: string,
    allOrgs?: { id: string; name: string }[],
): Promise<MessageResponse> {
    const headers = await getAuthHeaders();
    const body: Record<string, unknown> = { content };
    if (orgName) body.org_name = orgName;
    if (allOrgs?.length) {
        body.all_org_names = allOrgs.map(o => o.name);
        body.all_orgs = allOrgs;
    }
    const res = await fetch(`${API_BASE}/api/v1/coach/session/${sessionId}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
}

// ─── Plan 22-07: SSE streaming message send ───

export interface SSEEvent {
    type: 'status' | 'tool_use' | 'tool_result' | 'text_delta' | 'done' | 'error';
    payload: unknown;
}

export interface StreamTextDelta extends SSEEvent {
    type: 'text_delta';
    payload: string;
}

export interface StreamToolUse extends SSEEvent {
    type: 'tool_use';
    payload: { name: string; id: string };
}

export interface StreamToolResult extends SSEEvent {
    type: 'tool_result';
    payload: { tool_use_id: string; ok: boolean };
}

export interface StreamDone extends SSEEvent {
    type: 'done';
    payload: { message_id: string };
}

export interface StreamError extends SSEEvent {
    type: 'error';
    payload: { message: string; code?: string };
}

/**
 * Stream a coach message response via server-sent events.
 *
 * Uses fetch + ReadableStream (EventSource doesn't support POST or auth headers).
 * onEvent is invoked once per parsed SSE frame.
 *
 * Throws on non-2xx responses BEFORE the stream starts. Once streaming has
 * begun, parse errors surface as {type:'error'} events to onEvent (not thrown).
 */
export async function sendMessageStream(
    sessionId: string,
    content: string,
    onEvent: (event: SSEEvent) => void,
    orgName?: string,
    allOrgs?: { id: string; name: string }[],
): Promise<void> {
    const headers = await getAuthHeaders();
    const body: Record<string, unknown> = { content };
    if (orgName) body.org_name = orgName;
    if (allOrgs?.length) {
        body.all_org_names = allOrgs.map(o => o.name);
        body.all_orgs = allOrgs;
    }

    const response = await fetch(
        `${API_BASE}/api/v1/coach/session/${sessionId}/message/stream`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
        throw new Error('Streaming not supported: response.body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE frames terminate with a blank line (\n\n). Keep the tail in
            // `buffer` in case the last frame is split across chunks.
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
                const line = frame.trim();
                if (!line.startsWith('data: ')) continue;
                try {
                    const event = JSON.parse(line.slice(6)) as SSEEvent;
                    onEvent(event);
                } catch {
                    onEvent({ type: 'error', payload: { message: 'SSE parse error' } } as StreamError);
                }
            }
        }

        // Flush any trailing frame in the buffer (server should terminate with
        // \n\n but be defensive against backend/proxy quirks).
        const tail = buffer.trim();
        if (tail.startsWith('data: ')) {
            try {
                const event = JSON.parse(tail.slice(6)) as SSEEvent;
                onEvent(event);
            } catch {
                /* noop — malformed trailing frame */
            }
        }
    } finally {
        try { reader.releaseLock(); } catch { /* noop */ }
    }
}


export async function overrideSession(sessionId: string, track?: TrackType, mode?: ModeType): Promise<{ current_track: TrackType; current_mode: ModeType }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/${sessionId}/override`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ track, mode }),
    });
    if (!res.ok) throw new Error('Failed to override session');
    return res.json();
}

export async function listSessions(): Promise<CoachSession[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/sessions`, { headers });
    if (!res.ok) throw new Error('Failed to list sessions');
    return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/${sessionId}`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete session');
}

export interface SessionMessagesResponse {
    session_id: string;
    track: TrackType;
    mode: ModeType;
    messages: CoachMessage[];
}

export async function getSessionMessages(sessionId: string): Promise<SessionMessagesResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/${sessionId}/messages`, { headers });
    if (!res.ok) throw new Error('Failed to fetch session messages');
    return res.json();
}

// Growth Rings API
export interface GrowthRingData {
    dimension: string;
    relative_size: number;
    direction: 'up' | 'down' | 'flat';
}

export interface GrowthRingsResponse {
    rings: GrowthRingData[];
    has_data: boolean;
}

export async function getGrowthRings(): Promise<GrowthRingsResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/growth-rings`, { headers });
    if (!res.ok) throw new Error('Failed to fetch growth rings');
    return res.json();
}

// Rail Insights API (Phase 08.9 -- Dashboard Context Rail)
export interface RailInsightCard {
    date: string;
    date_label: string;
    meeting_title: string;
    meeting_id: number;
    qualitative_observation: string | null;
    start_items: string[];
    stop_items: string[];
}

export interface RailInsightsResponse {
    period: string;
    insights: RailInsightCard[];
}

export async function getRailInsights(period: 'weeks' | 'months' | 'quarters' = 'weeks'): Promise<RailInsightsResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/rail-insights?period=${period}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch rail insights');
    return res.json();
}

// Persistent Session API
export interface PersistentSessionResponse {
    id: string;
    track: string;
    mode: string;
    started_at: string;
    message_count: number;
    title?: string | null;
}

export async function getPersistentSession(): Promise<PersistentSessionResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/persistent`, { headers });
    if (!res.ok) throw new Error('Failed to fetch persistent session');
    return res.json();
}

// Clear session history
export async function clearSessionHistory(sessionId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/session/${sessionId}/history`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to clear history');
}

// Preference APIs
export async function updatePreference(
    key: string,
    value: unknown,
    scope: 'global' | 'session' = 'global',
    sessionId?: string
): Promise<{ success: boolean; promoted_to_profile: boolean }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key, value, scope, session_id: sessionId }),
    });
    if (!res.ok) throw new Error('Failed to update preference');
    return res.json();
}

// Role APIs
export async function updateRole(
    title: string,
    description: string,
    orgId?: string
): Promise<{ success: boolean }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/role`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, description, org_id: orgId }),
    });
    if (!res.ok) throw new Error('Failed to update role');
    return res.json();
}

export async function getTeamRoles(
    orgId: string,
    userIds: string[]
): Promise<Record<string, { role_title: string; role_description: string }>> {
    const headers = await getAuthHeaders();
    const res = await fetch(
        `${API_BASE}/api/v1/coach/team-roles/${orgId}?user_ids=${userIds.join(',')}`,
        { headers }
    );
    if (!res.ok) throw new Error('Failed to fetch team roles');
    return res.json();
}

// ─── Phase 20: Consent, Calibration, Commitments, Insights ───

// Types
export interface ConsentStatus {
    consented: boolean;
    granted_at: string | null;
    revoked_at: string | null;
}

export interface CalibrationSettings {
    directness: 'gentle' | 'balanced' | 'direct';
    accountability: 'strict' | 'friendly' | 'on_request';
    memory_level: 'session_only' | 'commitments' | 'commitments_preferences' | 'full';
}

export interface CalibrationResponse extends CalibrationSettings {
    calibration_completed: boolean;
}

export interface CommitmentItem {
    id: string;
    user_id: string;
    action: string;
    done_when: string | null;
    due_date: string | null;
    status: 'pending' | 'in_progress' | 'done' | 'overdue';
    session_id: string | null;
    created_at: string;
}

export interface InsightItem {
    id: string;
    user_id: string;
    observation: string;
    session_id: string | null;
    approved_at: string;
}

// Consent APIs
export async function getConsentStatus(): Promise<ConsentStatus> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/consent`, { headers });
    if (!res.ok) throw new Error('Failed to fetch consent status');
    return res.json();
}

export async function grantConsent(): Promise<ConsentStatus> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/consent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ consent_type: 'coaching_consent' }),
    });
    if (!res.ok) throw new Error('Failed to grant consent');
    return res.json();
}

export async function revokeConsent(): Promise<ConsentStatus> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/consent`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to revoke consent');
    return res.json();
}

// Calibration APIs
export async function getCalibration(): Promise<CalibrationResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/calibration`, { headers });
    if (!res.ok) throw new Error('Failed to fetch calibration');
    return res.json();
}

export async function saveCalibration(settings: CalibrationSettings): Promise<CalibrationResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/calibration`, {
        method: 'POST',
        headers,
        body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save calibration');
    return res.json();
}

export async function updateCalibration(update: Partial<CalibrationSettings>): Promise<CalibrationResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/calibration`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(update),
    });
    if (!res.ok) throw new Error('Failed to update calibration');
    return res.json();
}

// Commitments APIs
export async function getCommitments(): Promise<{ commitments: CommitmentItem[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/commitments`, { headers });
    if (!res.ok) throw new Error('Failed to fetch commitments');
    return res.json();
}

export async function createCommitment(data: {
    action: string;
    done_when?: string;
    due_date?: string;
    session_id?: string;
}): Promise<CommitmentItem> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/commitments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create commitment');
    return res.json();
}

export async function updateCommitment(id: string, data: {
    status?: string;
    due_date?: string;
}): Promise<CommitmentItem> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/commitments/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update commitment');
    return res.json();
}

export async function deleteCommitment(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/commitments/${id}`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete commitment');
}

// Insights APIs
export async function getInsights(): Promise<{ insights: InsightItem[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/insights`, { headers });
    if (!res.ok) throw new Error('Failed to fetch insights');
    return res.json();
}

export async function createInsight(data: {
    observation: string;
    session_id?: string;
}): Promise<InsightItem> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create insight');
    return res.json();
}

export async function deleteInsight(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/coach/insights/${id}`, {
        method: 'DELETE',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete insight');
}
