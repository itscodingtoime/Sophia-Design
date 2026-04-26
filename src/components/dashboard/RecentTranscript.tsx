import { Meeting, getMeetings } from '../../services/api';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { C } from '../../theme';

export default function RecentTranscript() {
  const { getToken } = useAuth();
  const { organization, memberships } = useOrganization({ memberships: { infinite: true } });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user lookup map from Clerk memberships (same as TranscriptsPage)
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

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    try {
      // Get fresh token with organization ID for proper org claims
      const token = await getToken({ organizationId: organization?.id });
      const data = await getMeetings(token);
      // Sort by date descending and take the 5 most recent
      const recentMeetings = data
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
        .slice(0, 3);
      setMeetings(recentMeetings);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  }, [organization, getToken]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Helper function to get meeting name (same as TranscriptsPage)
  const getMeetingName = (meeting: Meeting): string => {
    if (meeting.title && meeting.title.trim()) {
      return meeting.title.trim();
    }

    if (meeting.file_path) {
      const fileName =
        meeting.file_path.split('/').pop() || meeting.file_path.split('\\').pop() || '';
      if (fileName) {
        return fileName.replace(/\.[^/.]+$/, '');
      }
    }

    return `Meeting ${meeting.meeting_id}`;
  };

  // Helper function to get uploader name (same as TranscriptsPage)
  const getUploaderName = (userId: string): string => {
    return userNameMap.get(userId) || 'Unknown';
  };

  // Format date as dd/mm/yyyy in Australia (AEST/AEDT)
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

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
            <ArrowUpRight size={14} />
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
          <ArrowUpRight size={14} />
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
