import axios from 'axios';

const userCache: {
  data: UserProfile | null;
  timestamp: number | null;
  promise: Promise<UserProfile> | null;
} = {
  data: null,
  timestamp: null,
  promise: null,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 mins

export function normalizeApiBaseUrl(url: string): string {
  let u = url.replace(/\/+$/, ''); // trim trailing slashes

  // If it contains /api/v1/... (any endpoint), trim everything after /api
  if (u.includes('/api/v1/')) {
    u = u.split('/api/v1/')[0] + '/api';
  } else if (u.endsWith('/api/v1')) {
    u = u.slice(0, -3);
  } else if (!u.endsWith('/api')) {
    // Only append /api if it's just a domain or doesn't have it
    u = `${u}/api`;
  }
  return u;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export interface LabelDistribution {
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
}

export interface MeetingStat {
  meeting_id: number;
  generated_at: string;
  ownership_score: number;
  invitation_score: number;
  ownership_distribution: LabelDistribution;
  invitation_distribution: LabelDistribution;
  title: string;
}

export interface DashboardStats {
  team_name: string;
  latest_health_score: number;
  total_meetings: number;
  meetings_history: MeetingStat[];
  average_ownership: number;
  average_invitation: number;
  latest_ownership_distribution?: LabelDistribution;
  latest_invitation_distribution?: LabelDistribution;
}

export const getDashboardStats = async (teamId?: string, token?: string | null): Promise<DashboardStats> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const url = teamId ? `/v1/dashboard/stats?team_id=${teamId}` : '/v1/dashboard/stats';
  const response = await api.get<DashboardStats>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export interface Team {
  team_id: string;
  team_name: string;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export const getTeams = async (token?: string | null): Promise<Team[]> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.get<Team[]>('/v1/teams', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createTeam = async (teamName: string, token?: string | null): Promise<Team> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.post<Team>(
    '/v1/teams',
    { team_name: teamName },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const addMember = async (teamId: string, email: string, role: string, token?: string | null): Promise<void> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  await api.post(
    `/v1/teams/${teamId}/members`,
    { email, role },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const getTeamMembers = async (teamId: string, token?: string | null): Promise<TeamMember[]> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.get<TeamMember[]>(`/v1/teams/${teamId}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteTeam = async (teamId: string, token?: string | null): Promise<void> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  // Teams router is mounted at /api/teams (not under /v1/)
  // But our axios baseURL already includes /api, so we use /teams/
  await api.delete(`/teams/${teamId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const deleteMeeting = async (meetingId: number, token?: string | null): Promise<void> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  await api.delete(`/v1/meetings/${meetingId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateMeetingTeam = async (meetingId: number, orgId: string, token?: string | null): Promise<void> => {
  if (!token) throw new Error('Authentication token is required');
  await api.patch(`/v1/meetings/${meetingId}/team`, { org_id: orgId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const renameMeeting = async (meetingId: number, title: string, token?: string | null): Promise<void> => {
  if (!token) throw new Error('Authentication token is required');
  await api.patch(`/v1/meetings/${meetingId}/title`, { title }, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const reprocessMeeting = async (meetingId: number, token?: string | null): Promise<{ success: boolean; meeting_id: number; status: string }> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.post<{ success: boolean; meeting_id: number; status: string }>(
    `/v1/meetings/${meetingId}/reprocess`, {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const removeMember = async (teamId: string, userId: string, token?: string | null): Promise<void> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  await api.delete(`/v1/teams/${teamId}/members/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getCurrentUser = async (token?: string | null): Promise<UserProfile> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }

  // return cached data if still fresh
  if (
    userCache.data &&
    userCache.timestamp &&
    Date.now() - userCache.timestamp < CACHE_DURATION
  ) {
    return userCache.data;
  }

  // If a request is already in flight, return that promise to prevent duplicate simultaneous requests
  if (userCache.promise) {
    return userCache.promise;
  }

  // make the request
  userCache.promise = api.get<UserProfile>('/v1/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(response => {
    userCache.data = response.data;
    userCache.timestamp = Date.now();
    userCache.promise = null;
    return response.data;
  }).catch(error => {
    userCache.promise = null;
    throw error;
  });

  return userCache.promise;
};

// clear cache when user logs out
export const clearUserCache = () => {
  userCache.data = null;
  userCache.timestamp = null;
  userCache.promise = null;
};

// Calendar Types
export interface CalendarEventDTO {
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

export interface ProviderStatus {
  enabled: boolean;
  disabled_reason?: string | null;
  connected: boolean;
  last_sync: string | null;
  last_full_sync: string | null;
}

export interface CalendarStatusResponse {
  providers: Record<string, ProviderStatus>;
}

export interface CalendarSyncResponse {
  success: boolean;
  providers: Record<string, {
    ok?: boolean;
    error?: string;
    fetched?: number;
    upserted?: number;
  }>;
}

// Calendar API Functions
export const getCalendarStatus = async (token?: string | null): Promise<CalendarStatusResponse> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.get<CalendarStatusResponse>('/v1/calendar/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const connectCalendar = async (provider: string, token?: string | null): Promise<{ auth_url: string }> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.post<{ auth_url: string }>(`/v1/calendar/${provider}/connect`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const syncCalendars = async (token?: string | null, days: number = 30): Promise<CalendarSyncResponse> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.post<CalendarSyncResponse>(`/v1/calendar/sync?days=${days}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getCalendarEvents = async (
  token?: string | null,
  startDate?: string,
  endDate?: string,
  includeCancelled: boolean = false
): Promise<CalendarEventDTO[]> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (includeCancelled) params.append('include_cancelled', 'true');

  const response = await api.get<CalendarEventDTO[]>(`/v1/calendar/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const disconnectCalendar = async (provider: string, token?: string | null): Promise<void> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  await api.delete(`/v1/calendar/${provider}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Meeting Types
export interface Meeting {
  meeting_id: number;
  org_id: string;
  created_by: string;
  meeting_date: string;
  source_platform: string;
  title: string | null;
  file_path: string | null;
  processed_status: string;
  sentence_count?: number;
}

export const getMeetings = async (token?: string | null): Promise<Meeting[]> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const response = await api.get<Meeting[]>('/v1/meetings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const uploadMeeting = async (file: File, title: string, token?: string | null, teamId?: string | null, meetingDate?: string | null): Promise<Meeting> => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  if (teamId) formData.append('team_id', teamId);
  if (meetingDate) formData.append('meeting_date', meetingDate);
  const response = await api.post<Meeting>('/v1/meetings/upload', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const submitTranscript = async (
  text: string,
  title: string,
  token?: string | null,
  meeting_date?: string | null,
): Promise<{ meeting_id: number; message: string; status: string }> => {
  if (!token) throw new Error('Authentication token is required');
  const body: Record<string, string> = { text, title };
  if (meeting_date) body.meeting_date = meeting_date;
  const response = await api.post('/v1/process/transcript', body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Voiceprint API
export interface VoiceprintStatus {
  enrolled: boolean;
  enrolled_at: string | null;
}

export const getVoiceprintStatus = async (token?: string | null): Promise<VoiceprintStatus> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.get<VoiceprintStatus>('/v1/voiceprints/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const enrolVoiceprint = async (
  audioBlob: Blob,
  token?: string | null,
  displayName?: string,
  imageUrl?: string,
): Promise<{ status: string; enrolled_at: string }> => {
  if (!token) throw new Error('Authentication token is required');
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voiceprint.wav');
  if (displayName) formData.append('display_name', displayName);
  if (imageUrl) formData.append('image_url', imageUrl);
  const response = await api.post('/v1/voiceprints/enrol', formData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const deleteVoiceprint = async (token?: string | null): Promise<void> => {
  if (!token) throw new Error('Authentication token is required');
  await api.delete('/v1/voiceprints/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Voiceprint self-check
export const selfCheckVoiceprint = async (
  audioBlob: Blob,
  token?: string | null,
): Promise<{ passed: boolean; similarity: number }> => {
  if (!token) throw new Error('Authentication token is required');
  const formData = new FormData();
  formData.append('audio', audioBlob, 'self-check.wav');
  const response = await api.post<{ passed: boolean; similarity: number }>(
    '/v1/voiceprints/self-check',
    formData,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Voiceprint quality
export interface VoiceprintQuality {
  enrolled: boolean;
  tier: string | null;
  sample_count: number;
  next_milestone: number | null;
}

export const getVoiceprintQuality = async (token?: string | null): Promise<VoiceprintQuality> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.get<VoiceprintQuality>('/v1/voiceprints/me/quality', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Enrol from meeting (create voiceprint from meeting speaker)
export const enrolFromMeeting = async (
  meetingId: number,
  speakerLabel: string,
  displayName: string,
  token?: string | null,
): Promise<{ status: string; voiceprint_id: string; display_name: string; sample_count: number }> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.post(
    '/v1/voiceprints/enrol-from-meeting',
    { meeting_id: meetingId, speaker_label: speakerLabel, display_name: displayName },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Merge voiceprints
export const mergeVoiceprints = async (
  sourceId: string,
  targetId: string,
  token?: string | null,
): Promise<{ status: string; voiceprint_id: string; sample_count: number }> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.post(
    '/v1/voiceprints/merge',
    { source_voiceprint_id: sourceId, target_voiceprint_id: targetId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Unmatched speakers for a meeting (matches backend speaker_confirmation.py response)
export interface UnmatchedSpeaker {
  speaker_label: string;
  current_name: string | null;
  voiceprint_suggestions: Array<{ id: string; display_name: string; user_id: string }>;
}

export interface AvailableVoiceprint {
  id: string;
  display_name: string;
  user_id: string;
}

export interface UnmatchedSpeakersResponse {
  unmatched_speakers: UnmatchedSpeaker[];
}

export const getUnmatchedSpeakers = async (
  meetingId: number,
  token?: string | null,
): Promise<UnmatchedSpeakersResponse> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.get<UnmatchedSpeakersResponse>(
    `/v1/speaker-confirmation/meetings/${meetingId}/unmatched-speakers`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Confirm speaker identity
export const confirmSpeaker = async (
  meetingId: number,
  speakerLabel: string,
  voiceprintId: string,
  token?: string | null,
): Promise<{ status: string; turns_updated: number }> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.post(
    `/v1/speaker-confirmation/meetings/${meetingId}/confirm-speaker`,
    { speaker_label: speakerLabel, voiceprint_id: voiceprintId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Reject speaker match
export const rejectSpeaker = async (
  meetingId: number,
  speakerLabel: string,
  voiceprintId: string | null,
  correctName: string | null,
  token?: string | null,
): Promise<{ status: string }> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.post(
    `/v1/speaker-confirmation/meetings/${meetingId}/reject-speaker`,
    { speaker_label: speakerLabel, voiceprint_id: voiceprintId, correct_name: correctName },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Notification Types & API
export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  meeting_id: number | null;
  created_at: string;
}

export interface NotificationsResponse {
  count: number;
  notifications: NotificationItem[];
}

export const getUnreadNotifications = async (token?: string | null): Promise<NotificationsResponse> => {
  if (!token) throw new Error('Authentication token is required');
  const response = await api.get<NotificationsResponse>('/v1/notifications/unread', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const markNotificationRead = async (id: string, token?: string | null): Promise<void> => {
  if (!token) throw new Error('Authentication token is required');
  await api.post(`/v1/notifications/${id}/read`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ─── Team Health & Trends (scoring-engine backed) ───

export interface TeamHealthResponse {
  org_id: string;
  collective_score: number | null;
  warmth: number | null;
  direction: "up" | "down" | "flat";
  participation_balance: number | null;
  collective_inquiry: number | null;
  conflict_trajectory: number | null;
  decision_completion: number | null;
  participant_count: number;
  qualitative_observations: string | null;
  features: Record<string, number>;
  total_meetings: number;
}

export interface TrendPoint {
  period_key: string | null;
  date: string;
  avg_score: number | null;
  count: number;
}

// Phase 8.5: Trend detail types
export interface TrendMeetingDetail {
  meeting_id: number;
  title: string | null;
  meeting_date: string;
  collective_score: number | null;
  qualitative_observations: string | null;
}

export interface TrendDetailResponse {
  org_id: string;
  period_key: string;
  meetings: TrendMeetingDetail[];
}

export interface TeamTrendsResponse {
  org_id: string;
  period: string;
  trends: TrendPoint[];
}

export const getTeamHealth = async (orgId: string, token: string): Promise<TeamHealthResponse> => {
  const response = await api.get<TeamHealthResponse>(`/v1/dashboard/team/${orgId}/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getTeamTrends = async (orgId: string, period: string, token: string): Promise<TeamTrendsResponse> => {
  const response = await api.get<TeamTrendsResponse>(`/v1/dashboard/team/${orgId}/trends`, {
    params: { period },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getTrendDetail = async (
  orgId: string,
  periodKey: string,
  token: string,
  period: string = 'week',
): Promise<TrendDetailResponse> => {
  const response = await api.get<TrendDetailResponse>(
    `/v1/dashboard/team/${orgId}/trends/detail?period_key=${encodeURIComponent(periodKey)}&period=${period}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// ─── Voiceprint Batch Status ───

export const getBatchVoiceprintStatus = async (
  userIds: string[],
  token: string,
): Promise<Record<string, boolean>> => {
  const response = await api.post<{ statuses: Record<string, boolean> }>(
    '/v1/voiceprints/status/batch',
    { user_ids: userIds },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data.statuses;
};

// ─── Team Scoring Weights ───

export interface WeightConfigResponse {
  weights: Record<string, number>;  // {"A": 0.10, ..., "J": 0.10}
  is_default: boolean;
  updated_by: string | null;
}

export const getTeamWeights = async (orgId: string, token: string): Promise<WeightConfigResponse> => {
  const response = await api.get<WeightConfigResponse>(`/v1/dashboard/team/${orgId}/weights`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateTeamWeights = async (
  orgId: string,
  weights: Record<string, number>,
  token: string,
): Promise<WeightConfigResponse> => {
  const response = await api.put<WeightConfigResponse>(
    `/v1/dashboard/team/${orgId}/weights`,
    { weights },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export default api;
