import { useEffect } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import AllTeamsView from '../../components/teams/AllTeamsView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { C } from '../../theme';
import TeamManagementTab from '../TeamManagementTab';
import TeamSettingsTab from '../TeamSettingsTab';

const TeamPage = () => {
  const { organization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
        <h1 className="text-xl font-semibold" style={{ color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>Teams</h1>
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

  return (
    <div className="space-y-6">
      {activeTab === 'management' && <TeamManagementTab />}
      {activeTab === 'settings' && <TeamSettingsTab />}
    </div>
  );
};

export default TeamPage;