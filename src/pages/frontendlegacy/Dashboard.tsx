import { useEffect, useState } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { AIInsightsTeamStats } from '../components/dashboard/StatsCard';
import ConversationPatterns from '../components/dashboard/ConversationPatterns';
import TeamHealthTrendChart from '../components/dashboard/TeamHealthTrendChart';
import { DashboardStats, getDashboardStats, getMeetings, Meeting } from '../services/api';
import RecentTranscript from '../components/dashboard/RecentTranscript';
import RecentTranscriptAllTeams from '../components/dashboard/RecentTranscriptAllTeams';
import DashboardInteractionTab from '@/components/DashboardInteractionTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';
import { SophiaPageHeader, SectionCard, EmptyStateCard, ContextRail, HeroInsightCard } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';
import { C } from '../theme';

const Dashboard = () => {
  const { getToken } = useAuth();
  const { organization, isLoaded: orgLoaded, memberships } = useOrganization({ memberships: { infinite: true } });
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTranscripts, setRecentTranscripts] = useState<Meeting[]>([]);
  const [railOpen, setRailOpen] = useState(true);

  // Get active tab from URL params, default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview';

  // Set default tab if not present and organization exists
  useEffect(() => {
    if (organization && !searchParams.get('tab')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', 'overview');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [organization, searchParams, setSearchParams]);

  useEffect(() => {
    const fetchStats = async () => {

      if (!organization) {
        setStats(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Get fresh token with organization ID for proper org claims
        const token = await getToken({ organizationId: organization?.id });
        if (!token) {
          throw new Error('Authentication token is required');
        }
        const data = await getDashboardStats(organization.id, token);
        setStats(data);
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        const errorMessage =
          err?.response?.data?.detail || err?.message || 'Error loading dashboard data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [organization, getToken]);

  useEffect(() => {
    const fetchRecentTranscripts = async () => {
      if (!organization) {
        setRecentTranscripts([]);
        return;
      }

      try {
        // Get fresh token with organization ID for proper org claims
        const token = await getToken({ organizationId: organization?.id });
        if (!token) {
          return;
        }
        const meetings = await getMeetings(token);
        // Get the 3 most recent transcripts (meetings are already ordered by date desc from backend)
        const recent = meetings.slice(0, 3);
        setRecentTranscripts(recent);
      } catch (err: any) {
        console.error('Error fetching recent transcripts:', err);
        // Don't set error state here, just log it
      }
    };

    fetchRecentTranscripts();
  }, [organization, getToken]);

  // Team Health Trend Chart is now a real component imported from dashboard folder

  // Helper component for AI insights placeholder
  const AiInsightsPlaceholder = () => (
    <div className="rounded-xl mt-6 p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <h2 className="mb-4 text-xl font-semibold" style={{ color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>Performance Co-Pilot</h2>
      <div className="space-y-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg p-4 animate-pulse" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="h-4 rounded w-3/4 mb-2" style={{ background: C.tealDeep }}></div>
            <div className="h-3 rounded w-1/2 mb-2" style={{ background: C.tealDeep }}></div>
            <div className="h-3 rounded w-1/4" style={{ background: C.tealDeep }}></div>
          </div>
        ))}
      </div>
    </div>
  );

  // Helper component for Debug Info
  const DebugInfo = ({ data }: { data: any }) => (
    <details className="mt-4">
      <summary className="text-white/60 cursor-pointer">Debug Info</summary>
      <pre className="mt-2 text-xs text-white/40 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );

  // Helper component for Error Message
  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="rounded-xl p-8" style={{ background: C.card }}>
      <p className="text-red-400 mb-4">{message}</p>
      <DebugInfo data={{ organization, stats, error }} />
      <div className="mt-4">
        <p className="text-white/60 mb-2">
          Note: The dashboard requires the backend API to be running.
        </p>
        <p className="text-white/60 text-sm">
          Check the browser console for more details about the error.
        </p>
      </div>
    </div>
  );

  // Loading state
  if (!orgLoaded) {
    return (
      <div className="flex-1 space-y-8">
        <SophiaPageHeader title="Dashboard" />
        <div className="space-y-6">
          <SectionCard><Skeleton className="h-64 w-full" /></SectionCard>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[3fr_2fr]">
            <SectionCard><Skeleton className="h-48 w-full" /></SectionCard>
            <SectionCard><div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-32 w-full" /></div></SectionCard>
          </div>
        </div>
      </div>
    );
  }

  // 2. "All Teams" View
  if (!organization) {
    return (
      <div className="flex-1 space-y-8">
        <SophiaPageHeader title="Dashboard" />
        <div className="flex flex-col gap-6 pt-2">
          <SectionCard title="Team Health Trend">
            <div className="flex items-center justify-center h-64 rounded-lg" style={{ background: C.bgSub, border: `1px solid ${C.border}` }}>
              <p className="text-sm" style={{ color: C.textDim }}>Select a team to view health trends</p>
            </div>
          </SectionCard>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr]">
            <SectionCard><RecentTranscriptAllTeams /></SectionCard>
            <SectionCard><AIInsightsTeamStats /></SectionCard>
          </div>
        </div>
      </div>
    );
  }

  // Error state for single team view
  if (error && !stats) {
    return (
      <div className="flex-1 space-y-8">
        <SophiaPageHeader title="Dashboard" />
        <SectionCard>
          <EmptyStateCard
            icon={<AlertCircle size={48} />}
            title="Failed to load dashboard"
            description={error || 'Error loading dashboard data'}
            action={<button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg transition hover-teal" style={{ background: C.teal, color: C.white }}>Try Again</button>}
          />
        </SectionCard>
        <DebugInfo data={{ organization, stats, error }} />
      </div>
    );
  }

  // 3. "Single Team" View
  return (
    <div className="flex-1">
      <SophiaPageHeader title="Dashboard" />
      <div style={{ display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set('tab', value);
              setSearchParams(newSearchParams, { replace: true });
            }}
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="conversation-patterns">Conversation Patterns</TabsTrigger>
              <TabsTrigger value="interaction-dynamics">Interaction Dynamics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="flex flex-col gap-6 pt-2">
                <SectionCard><TeamHealthTrendChart teamId={organization.id} /></SectionCard>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[3fr_2fr]">
                  <SectionCard><RecentTranscript /></SectionCard>
                  <SectionCard><AIInsightsTeamStats /></SectionCard>
                </div>
                {stats && <DebugInfo data={{ organization, stats }} />}
              </div>
            </TabsContent>

            <TabsContent value="conversation-patterns" className="mt-6">
              <SectionCard>
                <ConversationPatterns
                  key={organization?.id || 'no-org'}
                  data={stats?.meetings_history || []}
                  latestOwnership={stats?.average_ownership || 0}
                  latestInvitation={stats?.average_invitation || 0}
                  latestOwnershipDistribution={stats?.latest_ownership_distribution}
                  latestInvitationDistribution={stats?.latest_invitation_distribution}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="interaction-dynamics" className="mt-6">
              <SectionCard>{organization && <DashboardInteractionTab key={organization.id} teamId={organization.id} />}</SectionCard>
            </TabsContent>
          </Tabs>
        </div>
        <ContextRail open={railOpen} onToggle={() => setRailOpen(o => !o)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>
            Coaching Tips
          </div>
          {recentTranscripts.length > 0 ? (
            <HeroInsightCard
              title="Latest Meeting Insight"
              subtitle="Review your team's conversation patterns from the last meeting"
              onTap={() => navigate('/meetings')}
            />
          ) : (
            <div style={{ fontSize: 12, color: C.textDim }}>Upload a meeting to see insights</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'Josefin Sans', sans-serif", marginTop: 8 }}>
            Team Activity
          </div>
          {recentTranscripts.length > 0 ? (
            recentTranscripts.slice(0, 3).map(t => (
              <SectionCard key={t.meeting_id}>
                <div style={{ fontSize: 13, color: C.text }}>{t.title || 'Meeting'}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{new Date(t.meeting_date).toLocaleDateString()}</div>
              </SectionCard>
            ))
          ) : (
            <div style={{ fontSize: 12, color: C.textDim }}>No recent team activity</div>
          )}
        </ContextRail>
      </div>
    </div>
  );
};

export default Dashboard;
