import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Meeting } from '../../services/api';
import { API_BASE_URL } from '../../services/api';
import { C } from '../../theme';

export default function RecentTranscriptAllTeams() {
  const { getToken } = useAuth();
  const { memberships } = useOrganization({ memberships: { infinite: true } });
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    memberships?.data?.forEach(m => {
      const userData = m.publicUserData;
      if (userData?.userId) {
        const name = userData.firstName
          ? `${userData.firstName} ${userData.lastName || ''}`.trim()
          : userData.identifier || 'Unknown';
        map.set(userData.userId, name);
      }
    });
    return map;
  }, [memberships?.data]);

  const teamNameMap = useMemo(() => {
    const map = new Map<string, string>();
    userMemberships?.data?.forEach(m => map.set(m.organization.id, m.organization.name));
    return map;
  }, [userMemberships?.data]);

  const fetchMeetings = useCallback(async () => {
    const orgs = userMemberships?.data ?? [];
    if (orgs.length === 0) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const byId = new Map<number, Meeting>();
      for (const { organization: org } of orgs) {
        try {
          const token = await getToken({ organizationId: org.id });
          if (!token) continue;
          const response = await fetch(`${API_BASE_URL}/v1/meetings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            const list = Array.isArray(data) ? data : [];
            list.forEach((m: Meeting) => byId.set(m.meeting_id, m));
          }
        } catch {
          // skip org on error
        }
      }
      const all = Array.from(byId.values());
      const recent = all
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
        .slice(0, 3);
      setMeetings(recent);
    } catch (error) {
      console.error('Failed to fetch recent transcripts (all teams):', error);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMemberships?.data?.length]); // getToken is stable, only refetch when orgs change

  useEffect(() => {
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMemberships?.data?.length]); // Only run when memberships load

  useEffect(() => {
    const handleUpdated = () => fetchMeetings();
    window.addEventListener('meetings:updated', handleUpdated);
    return () => window.removeEventListener('meetings:updated', handleUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Event listener doesn't need to change

  const getMeetingName = (meeting: Meeting): string => {
    if (meeting.title?.trim()) return meeting.title.trim();
    if (meeting.file_path) {
      const fileName = meeting.file_path.split(/[/\\]/).pop() || '';
      if (fileName) return fileName.replace(/\.[^/.]+$/, '');
    }
    return `Meeting ${meeting.meeting_id}`;
  };

  const getUploaderName = (userId: string): string => userNameMap.get(userId) || 'Unknown';
  const getTeamName = (orgId: string): string => teamNameMap.get(orgId) || 'Unknown team';
  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  if (loading) {
    return (
      <div className="rounded-xl p-6" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: C.text }}>Recent Transcripts</h2>
          <Link
            to="/meetings?tab=files"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover-bg transition-colors"
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: C.border, color: C.text }}
          >
            <FileText size={14} />
            View All
          </Link>
        </div>
        <div className="text-center py-8 text-sm" style={{ color: C.textDim }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: C.text }}>Recent Transcripts</h2>
        <Link
          to="/meetings?tab=files"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover-bg transition-colors"
          style={{ borderWidth: 1, borderStyle: 'solid', borderColor: C.border, color: C.text }}
        >
          <FileText size={14} />
          View All
        </Link>
      </div>
      <div className="space-y-2">
        {meetings.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: C.textDim }}>
            No transcripts available
          </div>
        ) : (
          meetings.map((meeting) => (
            <div
              key={meeting.meeting_id}
              className="rounded-lg p-4 hover-card transition-colors"
              style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}
            >
              <div className="font-semibold text-sm mb-1" style={{ color: C.text }}>
                {getMeetingName(meeting)}
              </div>
              <div className="text-xs mb-1" style={{ color: C.textDim }}>
                {getTeamName(meeting.org_id)}
              </div>
              <div className="text-xs mb-1" style={{ color: C.textDim }}>
                {getUploaderName(meeting.created_by)}
              </div>
              <div className="text-xs" style={{ color: C.textDim }}>
                {formatDate(meeting.meeting_date)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
