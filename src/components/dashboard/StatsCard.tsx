import { useEffect, useState } from 'react';
import { useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { getMeetings } from '../../services/api';
import { C } from '../../theme';

import { FileIcon, UserIcon, UsersIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: string;
}

const StatsCard = ({ title, value, trend }: StatsCardProps) => {
  return (
    <div className="rounded-lg h-32 w-full p-6" style={{ background: `linear-gradient(to bottom, ${C.card}, ${C.bg})`, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: C.text }}>{title}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: C.teal }}>{value}</p>
      {trend && <p className="mt-1 text-sm text-white/60">{trend}</p>}
    </div>
  );
};

export const OwnershipStateCard = () => {
  return <StatsCard title="Ownership" value="—" />;
};

export const InquiryStateCard = () => {
  return <StatsCard title="Inquiry" value="—" />;
};

export const CollaborationStateCard = () => {
  return <StatsCard title="Participation Balance" value="—" />;
};

export const EmotionalToneStateCard = () => {
  return <StatsCard title="Conversation Flow" value="—" />;
};

// Total Active Members Card Component
export const TotalActiveMembersCard = () => {
  const { organization, memberships } = useOrganization({
    memberships: { infinite: true },
  });
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [totalMembers, setTotalMembers] = useState<number>(0);

  useEffect(() => {
    const calculateTotalMembers = async () => {
      // "All teams" tab
      if (!organization) {
        const uniqueMemberIds = new Set<string>(); // set to store unique members
        if (userMemberships?.data) {
          for (const membership of userMemberships.data) {
            try {
              const orgMembers = await membership.organization.getMemberships();
              if (orgMembers.data) {
                orgMembers.data.forEach((member) => { // add to set
                  // Use identifier as unique key (email or username, unique per user)
                  // If identifier is not available, use membership ID as fallback
                  const uniqueKey = member.publicUserData?.identifier || member.id;
                  if (uniqueKey) {
                    uniqueMemberIds.add(uniqueKey);
                  }
                });
              }
            } catch (error) {
              console.error(`Error fetching members for ${membership.organization.name}:`, error);
              // Fallback: use membersCount if available (less accurate but better than nothing)
              if (membership.organization.membersCount) {
                const fallbackCount = membership.organization.membersCount;
                for (let i = 0; i < fallbackCount; i++) {
                  uniqueMemberIds.add(`fallback-${membership.organization.id}-${i}`);
                }
              }
            }
          }
        }
        setTotalMembers(uniqueMemberIds.size);
      } else {
        // Specific org selected
        setTotalMembers(memberships?.data?.length || 0);
      }
    };

    calculateTotalMembers();
  }, [organization, memberships, userMemberships]);

  return <StatsCard title="Total Active Members" value={totalMembers} />;
};

// Start of this week (Monday 00:00) and end (Sunday 23:59:59.999)
function getThisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  // Monday = 1, Sunday = 0 -> days since Monday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// Meetings Analysed This Week Card Component
export const MeetingsAnalysedThisWeekCard = () => {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetingsThisWeek = async () => {
      try {
        setLoading(true);
        // Get fresh token with organization ID for proper org claims
        const token = await getToken({ organizationId: organization?.id });
        if (!token) {
          setCount(0);
          return;
        }
        const meetings = await getMeetings(token);
        const { start, end } = getThisWeekRange();
        const thisWeek = meetings.filter((m) => {
          const d = new Date(m.meeting_date);
          return d >= start && d <= end;
        });
        setCount(thisWeek.length);
      } catch (err) {
        console.error('Error fetching meetings for this week:', err);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingsThisWeek();
  }, [organization, getToken]);

  const value = loading ? '…' : (count ?? 0);
  return <StatsCard title="Meetings This Week" value={value} />;
};

// Opt-In Rate Card Component
export const OptInRateCard = () => {
  // TODO: Replace with actual API data
  return <StatsCard title="Opt-In Rate" value="—" />;
};

// AI Insights team stats: meetings analysed, teams, members
export const AIInsightsTeamStats = () => {
  const { getToken } = useAuth();
  const { organization, memberships } = useOrganization({
    memberships: { infinite: true },
  });
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [meetingsCount, setMeetingsCount] = useState<number>(0);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetingsCount = async () => {
      try {
        // Get fresh token with organization ID for proper org claims
        const token = await getToken({ organizationId: organization?.id });
        if (!token) return;
        const meetings = await getMeetings(token);
        setMeetingsCount(meetings.length);
      } catch (err) {
        console.error('Error fetching meetings count:', err);
        setMeetingsCount(0);
      }
    };
    fetchMeetingsCount();
  }, [organization, getToken]);

  useEffect(() => {
    const calculateMembers = async () => {
      if (!organization) {
        let count = 0;
        if (userMemberships?.data) {
          const uniqueMemberIds = new Set<string>();
          for (const membership of userMemberships.data) {
            try {
              const orgMembers = await membership.organization.getMemberships();
              if (orgMembers.data) {
                orgMembers.data.forEach((member) => {
                  const uniqueKey = member.publicUserData?.identifier || member.id;
                  if (uniqueKey) uniqueMemberIds.add(uniqueKey);
                });
              }
            } catch {
              if (membership.organization.membersCount) {
                for (let i = 0; i < membership.organization.membersCount; i++) {
                  uniqueMemberIds.add(`fallback-${membership.organization.id}-${i}`);
                }
              }
            }
          }
          count = uniqueMemberIds.size;
        }
        setMembersCount(count);
      } else {
        setMembersCount(memberships?.data?.length || 0);
      }
      setLoading(false);
    };
    calculateMembers();
  }, [organization, memberships, userMemberships]);

  const teamsCount = organization ? 1 : (userMemberships?.data?.length ?? 0);

  const statBlock = (label: string, value: number | string, icon: React.ReactNode) => (
    <div className="rounded-lg p-4 flex flex-col items-center text-center" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
      <div className="mb-2" style={{ color: C.teal }}>{icon}</div>
      <p className="text-xl font-bold" style={{ color: C.text }}>{loading && typeof value === 'number' ? '…' : value}</p>
      <p className="text-sm" style={{ color: C.textSec }}>{label}</p>
    </div>
  );

  return (
    <div className="rounded-xl p-6" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
      <h2 className="mb-4 text-xl font-semibold" style={{ color: C.text }}>
        Workspace Overview
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:grid-rows-1">
        <div>{statBlock('Meetings', meetingsCount, <FileIcon className="w-6 h-6" />)}</div>
        <div>{statBlock('Teams', teamsCount, <UsersIcon className="w-6 h-6" />)}</div>
        <div>{statBlock('Members', membersCount, <UserIcon className="w-6 h-6" />)}</div>
      </div>
    </div>
  );
};

export default StatsCard;

