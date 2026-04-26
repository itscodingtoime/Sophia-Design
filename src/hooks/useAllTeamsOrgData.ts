import { useEffect, useState } from 'react';
import { useOrganizationList } from '@clerk/clerk-react';

export type OrgChartNode = {
  id: string;
  parentId: string;
  name: string;
  role: string;
  imageUrl?: string;
  type: 'root' | 'team' | 'member';
  memberCount?: number;
};

export function useAllTeamsOrgData() {
  const { userMemberships, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [data, setData] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function buildOrgData() {
      setLoading(true);

      const teams = userMemberships.data?.map((mem) => mem.organization) || [];
      const nodes: OrgChartNode[] = [];

      // Root node - Organisation
      nodes.push({
        id: 'root',
        parentId: '',
        name: 'Organisation',
        role: `${teams.length} Team${teams.length !== 1 ? 's' : ''}`,
        type: 'root',
      });

      // Fetch members for each team
      for (const org of teams) {
        try {
          const memberships = await org.getMemberships();

          if (cancelled) return;

          // Add team node
          nodes.push({
            id: `team-${org.id}`,
            parentId: 'root',
            name: org.name,
            role: `${memberships.data.length} Member${memberships.data.length !== 1 ? 's' : ''}`,
            imageUrl: org.imageUrl || undefined,
            type: 'team',
            memberCount: memberships.data.length,
          });

          // Add member nodes
          for (const m of memberships.data) {
            const memberName = `${m.publicUserData?.firstName ?? ''} ${m.publicUserData?.lastName ?? ''}`.trim() 
              || m.publicUserData?.identifier 
              || 'Unknown';

            nodes.push({
              id: `member-${org.id}-${m.publicUserData?.userId || m.id}`,
              parentId: `team-${org.id}`,
              name: memberName,
              role: m.role === 'org:admin' ? 'Admin' : 'Member',
              imageUrl: m.publicUserData?.imageUrl || undefined,
              type: 'member',
            });
          }
        } catch (error) {
          console.error(`Error fetching members for ${org.name}:`, error);
          // Still add the team node even if members fetch fails
          nodes.push({
            id: `team-${org.id}`,
            parentId: 'root',
            name: org.name,
            role: '0 Members',
            imageUrl: org.imageUrl || undefined,
            type: 'team',
            memberCount: 0,
          });
        }
      }

      if (!cancelled) {
        setData(nodes);
        setLoading(false);
      }
    }

    buildOrgData();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userMemberships.data]);

  return { data, loading, teamCount: userMemberships.data?.length || 0 };
}

