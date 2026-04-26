import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrganization, useUser } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import AllTeamsView from '../components/teams/AllTeamsView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import TeamManagementTab from './TeamManagementTab';
import TeamSettingsTab from './TeamSettingsTab';
import AddMemberModal from '../components/teams/AddMemberModal';
import Button from '@/generic/Button';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { SophiaPageHeader } from '@/components/composition';
import { C } from '../theme';

const TeamPage = () => {
  const { user } = useUser();
  const { userProfile } = useCurrentUser();
  const { organization, memberships } = useOrganization({ memberships: { infinite: true } });
  const [searchParams, setSearchParams] = useSearchParams();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Get active tab from URL params
  const activeTab = searchParams.get('tab') || (organization ? 'management' : 'team-list');

  // Set default tab if not present
  useEffect(() => {
    if (!searchParams.get('tab')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('tab', organization ? 'management' : 'team-list');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [organization, searchParams, setSearchParams]);

  // All Teams mode - no organization selected: show Team List / Org Chart tabs
  if (!organization) {
    const allTeamsTab = activeTab === 'org-chart' ? 'org-chart' : 'team-list';
    return (
      <div className="space-y-6">
        <SophiaPageHeader title="Teams" />
        <Tabs
          value={allTeamsTab}
          onValueChange={(value) => {
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('tab', value);
            setSearchParams(newSearchParams, { replace: true });
          }}
        >
          <TabsList>
            <TabsTrigger value="team-list">Team List</TabsTrigger>
            <TabsTrigger value="org-chart">Org Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="team-list" className="mt-6">
            <AllTeamsView view="list" />
          </TabsContent>
          <TabsContent value="org-chart" className="mt-6">
            <AllTeamsView view="chart" />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const singleTeamTab = activeTab === 'settings' ? 'settings' : 'management';

  const canManageTeam = () => {
    const isSystemAdmin = userProfile?.role === 'admin' || user?.primaryEmailAddress?.emailAddress === 'oliverdubois10@gmail.com';
    const currentMembership = memberships?.data?.find(m => m.publicUserData?.userId === user?.id);
    const isTeamAdmin = currentMembership?.role === 'org:admin';
    return !!isSystemAdmin || !!isTeamAdmin;
  };

  return (
    <div className="space-y-6">
      <SophiaPageHeader
        title="Teams"
        actions={
          singleTeamTab !== 'settings' && canManageTeam() ? (
            <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>
              <Plus size={18} className="mr-2 inline" />
              Invite Member
            </Button>
          ) : undefined
        }
      />
      <AddMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <Tabs
        value={singleTeamTab}
        onValueChange={(value) => {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('tab', value);
          setSearchParams(newSearchParams, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="management">Team Management</TabsTrigger>
          <TabsTrigger value="settings">Team Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="management" className="mt-6">
          <TeamManagementTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <TeamSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamPage;